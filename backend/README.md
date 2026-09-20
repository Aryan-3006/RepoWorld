# Repo City Backend

Repo City is an interactive 3D web application that visualizes GitHub repositories ("Google Earth for your codebase"). This directory contains the Python FastAPI backend, which handles repository parsing, GitHub REST API integration, and AI-powered natural language code exploration.

## 🚀 Implemented Features

This backend is being built in phases. The following functionality is currently implemented and tested (Phases 1-3B):

### 1. Foundation & API Contracts (Phase 1)
- **FastAPI Setup**: Core web framework, structured logically with routers and environment variables.
- **CORS**: Configured out-of-the-box to communicate with a frontend running on `http://localhost:5173`.
- **Pydantic Data Models**: Stable schemas to strictly type responses (e.g., `RepoFile`, `District`, `RepositoryResponse`), guaranteeing a predictable data contract for the 3D frontend.
- **Mock AI Endpoints**: `POST /api/ask` and `POST /api/explain` currently return correctly formatted mock JSON waiting for Groq integration.

### 2. GitHub Repository Ingestion (Phase 2 & 3A)
- **GitHub URL Parsing**: Safely extracts the `owner` and `repo` from URLs (e.g., ignores trailing `.git` or `/tree/main`).
- **OAuth Authentication**: Supports a full GitHub OAuth flow, exchanging authorization codes for access tokens to allow users to ingest their own **Private Repositories**.
- **REST Integration**: Seamlessly cascades credentials (from user session, to global `.env` token, to unauthenticated access) to recursively fetch a repository's metadata and complete file tree via `httpx`.
- **Intelligent Filtering & Prioritization**: 
  - Drops generated folders (`node_modules`, `dist`, `.git`) and binary assets.
  - Prioritizes Source Code > Config Files > Documentation.
  - Deterministically limits analysis to the top **300 files** to respect hackathon memory/rate-limit constraints.
- **Code Analysis Heuristics**: 
  - Detects if a file is a test file based on naming conventions (`test_*.py`, `*.spec.ts`, etc.).

### 3. Repository Intelligence (Phase 3B)
- **Deep Content Analysis**: Securely fetches raw file blobs using SHA hashes to analyze actual lines of code (`LOC`) instead of rough size estimates.
- **Git History Aggregation**: Fetches the commit history of individual files to determine exactly how active they are (commit counts, last modified date).
- **Static Dependency Extraction**: Uses optimized Regex heuristics to parse internal imports for Python and JS/TS (`import`, `from`, `require`) and build an interconnected internal dependency graph (roads).
- **Hotspot Heuristics**: Calculates a normalized `hotspot_score` (low, medium, high) based on a weighted formula: *File Size + Git Activity + Missing Test Penalty*. 
  > **Note:** The hotspot score is a heuristic visual indicator designed to drive 3D heatmap rendering. It is **not** a formal code-quality or security assessment.
- **Rollup Aggregation**: Flattens file-level intelligence into District (folder) averages and overall Repository Statistics (total LOC, languages, etc.).
  - Generates perfectly stable, URL-safe **File IDs** (`src-auth-login-ts`) to act as 3D building IDs for the frontend.
- **In-Memory Datastore**: Analyzed repos are immediately stored in server memory and can be queried instantly via `GET /api/repository/{id}`.
- **Testing**: A full suite of `pytest` unit tests covering the parsing, filtering, ID generation, and language detection logic.

## 🛠️ Project Structure
```text
backend/
├── app/
│   ├── api/           # FastAPI routers (analyze, ask, explain, repository)
│   ├── github/        # GitHub client (HTTP requests, tree parsing, filtering)
│   ├── models/        # Pydantic JSON schemas
│   ├── main.py        # FastAPI application entry point
│   └── store.py       # In-memory dictionary storing parsed repositories
├── tests/             # Pytest unit tests
├── requirements.txt   # Python dependencies
└── .env.example       # Environment variables template
```

## 💻 Running the Backend locally

### Prerequisites
Make sure you have Python 3.11+ installed.
The project uses `fastapi`, `uvicorn`, `httpx`, `groq`, and `pytest`.

### 1. GitHub OAuth App Setup
To enable authentication and private repository access, create a new GitHub Developer Application:
1. Go to GitHub > Settings > Developer settings > OAuth Apps > **New OAuth App**.
2. **Homepage URL**: `http://localhost:5173`
3. **Authorization callback URL**: `http://localhost:8000/api/auth/github/callback`

### 2. Setup Environment
1. Activate your virtual environment:
   ```bash
   .venv\Scripts\activate
   ```
2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Add your newly generated `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. DO NOT commit this file to version control.

### 3. Start the Server
Start the development server using Uvicorn:
```bash
uvicorn app.main:app --reload
```

### 3. Explore the Docs
FastAPI automatically generates interactive Swagger documentation.
Visit: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) to test the endpoints instantly!

## 🧪 Running Tests
To verify all GitHub parsing and filtering utilities:
```bash
python -m pytest tests/
```
