import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.api import analyze, repository, ask, explain, auth

load_dotenv()

app = FastAPI(title="Repo City Backend")

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(repository.router, prefix="/api", tags=["repository"])
app.include_router(ask.router, prefix="/api", tags=["ask"])
app.include_router(explain.router, prefix="/api", tags=["explain"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "repo-city-backend"}

@app.get("/")
async def root():
    return {"message": "Welcome to Repo City Backend API"}
