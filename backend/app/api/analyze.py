import asyncio
from typing import Dict, List
from fastapi import APIRouter, Request
from app.models.schemas import (
    AnalyzeRequest, 
    AnalyzeResponse,
    RepositoryResponse,
    Repository,
    FileIntelligence,
    Dependency
)
from app.store import REPOSITORIES, SESSIONS
from app.github.client import (
    parse_github_url,
    fetch_repo_metadata,
    fetch_repo_tree,
    fetch_blob_content,
    fetch_file_commits,
    filter_file,
    sort_and_limit_files,
    generate_file_id,
    detect_language,
    is_test_file
)
from app.analyzer.dependencies import extract_dependencies
from app.analyzer.hotspots import calculate_hotspot_score
from app.analyzer.aggregator import aggregate_districts, aggregate_repository

router = APIRouter()

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_repository(request: Request, body: AnalyzeRequest):
    owner, repo = parse_github_url(body.repo_url)
    repo_id = f"{owner}-{repo}"
    
    session_id = request.cookies.get("session_id")
    user_token = None
    if session_id and session_id in SESSIONS:
        user_token = SESSIONS[session_id].get("github_access_token")
    
    metadata = await fetch_repo_metadata(owner, repo, token=user_token)
    default_branch = metadata.get("default_branch", "main")
    
    tree = await fetch_repo_tree(owner, repo, default_branch, token=user_token)
    
    valid_items = []
    for item in tree:
        path = item.get("path", "")
        item_type = item.get("type", "")
        if filter_file(path, item_type):
            valid_items.append(item)
            
    limited_items = sort_and_limit_files(valid_items, limit=300)
    
    # Pre-map paths to IDs for dependency resolution
    path_to_id = {item["path"]: generate_file_id(item["path"]) for item in limited_items}
    
    semaphore = asyncio.Semaphore(10)
    
    async def process_file(item) -> tuple[FileIntelligence, List[Dependency]]:
        path = item.get("path", "")
        file_id = path_to_id[path]
        name = path.split("/")[-1]
        extension = f".{name.split('.')[-1]}" if "." in name else ""
        language = detect_language(path)
        is_test = is_test_file(path)
        size_bytes = item.get("size", 0)
        sha = item.get("sha", "")
        
        parts = path.split("/")
        district_name = parts[0] if len(parts) > 1 else "root"
        
        async with semaphore:
            content = await fetch_blob_content(owner, repo, sha, token=user_token)
            commits = await fetch_file_commits(owner, repo, path, token=user_token)
            
        line_count = len(content.splitlines()) if content else 0
        commit_count = len(commits) if isinstance(commits, list) else 0
        last_modified = commits[0]["commit"]["committer"]["date"] if commit_count > 0 and "commit" in commits[0] else None
        recent_commit_count = commit_count # For hackathon, just using full count as recent
        
        hotspot_score, hotspot_category = calculate_hotspot_score(size_bytes, commit_count, is_test)
        
        file_intel = FileIntelligence(
            id=file_id,
            name=name,
            path=path,
            extension=extension,
            language=language,
            size_bytes=size_bytes,
            line_count=line_count,
            is_test=is_test,
            district=district_name,
            commit_count=commit_count,
            recent_commit_count=recent_commit_count,
            last_modified=last_modified,
            activity_score=min(commit_count / 50.0, 1.0),
            hotspot_score=hotspot_score,
            hotspot_category=hotspot_category
        )
        
        deps = extract_dependencies(file_id, path, content, language, path_to_id)
        
        return file_intel, deps

    tasks = [process_file(item) for item in limited_items]
    results = await asyncio.gather(*tasks)
    
    files = [r[0] for r in results]
    dependencies = []
    for r in results:
        dependencies.extend(r[1])
        
    districts = aggregate_districts(files)
    statistics = aggregate_repository(files, districts, len(dependencies))
    
    REPOSITORIES[repo_id] = RepositoryResponse(
        repository=Repository(
            id=repo_id,
            name=metadata.get("name", repo),
            owner=owner,
            url=metadata.get("html_url", body.repo_url)
        ),
        statistics=statistics,
        districts=districts,
        files=files,
        dependencies=dependencies
    )
    
    return AnalyzeResponse(
        repository_id=repo_id,
        status="complete"
    )
