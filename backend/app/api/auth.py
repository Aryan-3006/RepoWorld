import os
import secrets
import httpx
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse
from app.store import SESSIONS, OAUTH_STATES

router = APIRouter()

def get_client_id():
    return os.getenv("GITHUB_CLIENT_ID", "")

def get_client_secret():
    return os.getenv("GITHUB_CLIENT_SECRET", "")

def get_redirect_uri():
    return os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/api/auth/github/callback")

def get_frontend_url():
    return os.getenv("FRONTEND_URL", "http://localhost:5173")

@router.get("/auth/github")
async def github_login():
    """Starts the GitHub OAuth flow."""
    client_id = get_client_id()
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub Client ID not configured.")
        
    state = secrets.token_hex(16)
    OAUTH_STATES[state] = True
    
    redirect_uri = get_redirect_uri()
    scope = os.getenv("GITHUB_OAUTH_SCOPE", "repo")
    
    auth_url = f"https://github.com/login/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&scope={scope}&state={state}"
    return RedirectResponse(url=auth_url)

@router.get("/auth/github/callback")
async def github_callback(code: str = None, state: str = None, error: str = None):
    """Handles the GitHub OAuth callback."""
    frontend_url = get_frontend_url()
    
    try:
        if error:
            # User denied access or other error
            return RedirectResponse(url=f"{frontend_url}?error={error}")
            
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code or state")
            
        if state not in OAUTH_STATES:
            raise HTTPException(status_code=400, detail="Invalid state parameter. Possible CSRF.")
            
        # Remove state after single use
        del OAUTH_STATES[state]
        
        # Exchange code for access token
        token_url = "https://github.com/login/oauth/access_token"
        payload = {
            "client_id": get_client_id(),
            "client_secret": get_client_secret(),
            "code": code,
            "redirect_uri": get_redirect_uri(),
            "state": state
        }
        headers = {"Accept": "application/json"}
        
        async with httpx.AsyncClient(follow_redirects=True) as client:
            token_response = await client.post(token_url, json=payload, headers=headers)
            if token_response.status_code != 200:
                raise HTTPException(status_code=502, detail="Failed to exchange token with GitHub")
                
            try:
                token_data = token_response.json()
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"GitHub returned non-JSON token response: {token_response.text}")
                
            access_token = token_data.get("access_token")
            
            if not access_token:
                raise HTTPException(status_code=502, detail=f"GitHub returned an invalid token response: {token_data}")
                
            # Fetch user info
            user_url = "https://api.github.com/user"
            user_headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json"
            }
            user_response = await client.get(user_url, headers=user_headers)
            if user_response.status_code != 200:
                raise HTTPException(status_code=502, detail="Failed to fetch GitHub user profile")
                
            user_data = user_response.json()
            
        # Create server-side session
        session_id = secrets.token_hex(32)
        SESSIONS[session_id] = {
            "github_access_token": access_token,
            "github_user": {
                "id": user_data.get("id"),
                "login": user_data.get("login"),
                "avatar_url": user_data.get("avatar_url")
            }
        }
        
        # Set HttpOnly cookie and redirect
        response = RedirectResponse(url=frontend_url)
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            samesite="none",
            secure=True,
            max_age=86400 * 7 # 7 days
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unhandled internal error: {str(e)}")

@router.get("/auth/status")
async def auth_status(request: Request):
    """Returns the current authentication status and user profile."""
    session_id = request.cookies.get("session_id")
    
    if session_id and session_id in SESSIONS:
        session = SESSIONS[session_id]
        return {
            "authenticated": True,
            "github_user": session["github_user"]
        }
        
    return {
        "authenticated": False,
        "github_user": None
    }

@router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    """Logs the user out by clearing the session."""
    session_id = request.cookies.get("session_id")
    if session_id and session_id in SESSIONS:
        del SESSIONS[session_id]
        
    response.delete_cookie(key="session_id")
    return {"status": "success"}
