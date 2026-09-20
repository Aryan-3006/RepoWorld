from fastapi.testclient import TestClient
from app.main import app
from app.store import SESSIONS, OAUTH_STATES

client = TestClient(app)

def test_github_login_redirect(monkeypatch):
    monkeypatch.setenv("GITHUB_CLIENT_ID", "test_client_id")
    
    response = client.get("/api/auth/github", follow_redirects=False)
    assert response.status_code == 307
    location = response.headers.get("location")
    assert "https://github.com/login/oauth/authorize" in location
    assert "client_id=test_client_id" in location
    assert "state=" in location
    
    # State should be saved in OAUTH_STATES
    state_param = location.split("state=")[1].split("&")[0]
    assert state_param in OAUTH_STATES

def test_github_callback_missing_params():
    response = client.get("/api/auth/github/callback")
    assert response.status_code == 400
    assert "Missing code or state" in response.json()["detail"]

def test_github_callback_invalid_state():
    response = client.get("/api/auth/github/callback?code=123&state=invalid_state")
    assert response.status_code == 400
    assert "Invalid state parameter" in response.json()["detail"]

def test_auth_status_unauthenticated():
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "github_user": None}

def test_auth_status_authenticated():
    SESSIONS["test_session"] = {
        "github_access_token": "fake_token",
        "github_user": {"id": 1, "login": "testuser"}
    }
    
    client.cookies.set("session_id", "test_session")
    response = client.get("/api/auth/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] == True
    assert data["github_user"]["login"] == "testuser"
    # Token shouldn't be exposed
    assert "github_access_token" not in data
    
    client.cookies.delete("session_id")
    del SESSIONS["test_session"]

def test_auth_logout():
    SESSIONS["test_session"] = {
        "github_access_token": "fake_token",
        "github_user": {"id": 1, "login": "testuser"}
    }
    
    client.cookies.set("session_id", "test_session")
    response = client.post("/api/auth/logout")
    
    assert response.status_code == 200
    assert "test_session" not in SESSIONS
