import re
import os
import httpx
from urllib.parse import urlparse
from fastapi import HTTPException

GITHUB_API_URL = "https://api.github.com"

# Extensions mapped to language names
LANGUAGE_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".java": "Java",
    ".cpp": "C++",
    ".c": "C",
    ".go": "Go",
    ".rs": "Rust",
    ".php": "PHP",
    ".html": "HTML",
    ".css": "CSS",
    ".json": "JSON",
    ".md": "Markdown",
    ".yaml": "YAML",
    ".yml": "YAML",
}

IGNORE_DIRS = {
    ".git", "node_modules", "dist", "build", "venv", ".venv", 
    "__pycache__", "coverage", ".next", ".cache", "target", "vendor"
}

IGNORE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", 
    ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".class"
}

def get_headers(token: str | None = None):
    # Fallback to server-side token if none provided by the user session
    auth_token = token or os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    return headers

def parse_github_url(url: str) -> tuple[str, str]:
    """
    Parses a GitHub URL and returns (owner, repo).
    Raises HTTPException if invalid.
    """
    try:
        parsed = urlparse(url.strip())
        if parsed.netloc not in ("github.com", "www.github.com"):
            raise ValueError("Not a github.com URL")
        
        path_parts = [p for p in parsed.path.split("/") if p]
        if len(path_parts) < 2:
            raise ValueError("URL does not contain owner and repo")
            
        owner = path_parts[0]
        repo = path_parts[1]
        
        # Remove trailing .git if present
        if repo.endswith(".git"):
            repo = repo[:-4]
            
        return owner, repo
    except Exception as e:
        raise HTTPException(status_code=422, detail="Invalid GitHub URL format.")

def generate_file_id(path: str) -> str:
    """Creates a stable file ID from the path."""
    return re.sub(r'[^a-zA-Z0-9]', '-', path).strip('-').lower()

def detect_language(path: str) -> str:
    _, ext = os.path.splitext(path)
    return LANGUAGE_MAP.get(ext.lower(), "Unknown")

def is_test_file(path: str) -> bool:
    path_lower = path.lower()
    if "test" in path_lower or "spec" in path_lower:
        basename = os.path.basename(path_lower)
        if basename.startswith("test_") or basename.endswith("_test.py") \
            or basename.endswith(".test.js") or basename.endswith(".test.ts") \
            or basename.endswith(".test.tsx") or basename.endswith(".spec.js") \
            or basename.endswith(".spec.ts") or basename.endswith(".spec.tsx"):
            return True
        # Check directories
        parts = path_lower.split("/")
        if "tests" in parts or "__tests__" in parts:
            return True
    return False

def filter_file(path: str, type_str: str) -> bool:
    if type_str != "blob":
        return False
        
    parts = path.split("/")
    
    # Check ignored directories
    for part in parts[:-1]:
        if part in IGNORE_DIRS:
            return False
            
    # Check ignored extensions
    _, ext = os.path.splitext(path)
    if ext.lower() in IGNORE_EXTENSIONS:
        return False
        
    return True

def sort_and_limit_files(tree_items: list, limit: int = 300) -> list:
    """
    Sorts files by priority (source code > config > docs) and alphabetically,
    then returns the top N items.
    """
    def get_priority(item):
        path = item.get("path", "")
        _, ext = os.path.splitext(path)
        ext = ext.lower()
        
        # Priority 1: Source code
        if ext in {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".cpp", ".c", ".go", ".rs", ".php", ".html", ".css"}:
            return 1
            
        # Priority 2: Config/Data
        if ext in {".json", ".yaml", ".yml", ".toml", ".ini", ".env"} or "Dockerfile" in path:
            return 2
            
        # Priority 3: Docs and others
        if ext in {".md", ".txt"}:
            return 3
            
        # Priority 4: Everything else
        return 4

    # Sort by priority, then deterministically by path
    sorted_items = sorted(tree_items, key=lambda x: (get_priority(x), x.get("path", "")))
    return sorted_items[:limit]

async def fetch_repo_metadata(owner: str, repo: str, token: str | None = None) -> dict:
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, headers=get_headers(token))
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found or private.")
        if response.status_code == 403:
            raise HTTPException(status_code=429, detail="GitHub API rate limit exceeded or access forbidden.")
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Error communicating with GitHub API. Status: {response.status_code}")
            
        return response.json()

async def fetch_repo_tree(owner: str, repo: str, default_branch: str, token: str | None = None) -> list:
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, headers=get_headers(token))
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository tree not found.")
        if response.status_code == 403:
            raise HTTPException(status_code=429, detail="GitHub API rate limit exceeded.")
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Error communicating with GitHub API. Status: {response.status_code}")
            
        data = response.json()
        return data.get("tree", [])

async def fetch_blob_content(owner: str, repo: str, sha: str, token: str | None = None) -> str:
    """Fetch raw file content by its blob SHA using GitHub API."""
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/git/blobs/{sha}"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, headers=get_headers(token))
        if response.status_code == 200:
            data = response.json()
            if data.get("encoding") == "base64":
                import base64
                try:
                    return base64.b64decode(data.get("content", "")).decode("utf-8", errors="replace")
                except Exception:
                    return ""
        return ""

async def fetch_file_commits(owner: str, repo: str, path: str, token: str | None = None) -> list:
    """Fetch recent commits for a specific file to determine activity."""
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/commits?path={path}&per_page=100"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, headers=get_headers(token))
        if response.status_code == 200:
            return response.json()
        return []
