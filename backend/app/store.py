from typing import Dict
from app.models.schemas import RepositoryResponse

# In-memory store for repositories mapped by repository_id
# repository_id format: owner-repo
REPOSITORIES: Dict[str, RepositoryResponse] = {}

# session_id format: secure random hex string
SESSIONS: Dict[str, dict] = {}

# CSRF state store for OAuth
OAUTH_STATES: Dict[str, bool] = {}
