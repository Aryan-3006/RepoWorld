from fastapi import APIRouter, HTTPException
from app.models.schemas import RepositoryResponse
from app.store import REPOSITORIES

router = APIRouter()

@router.get("/repository/{repository_id}", response_model=RepositoryResponse)
async def get_repository(repository_id: str):
    if repository_id not in REPOSITORIES:
        raise HTTPException(status_code=404, detail="Repository not found.")
    return REPOSITORIES[repository_id]
