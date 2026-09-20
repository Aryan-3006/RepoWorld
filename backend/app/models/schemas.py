from typing import List, Literal, Optional
from pydantic import BaseModel

class Dependency(BaseModel):
    source_file_id: str
    target_file_id: str

class FileIntelligence(BaseModel):
    id: str
    name: str
    path: str
    extension: str
    language: str
    size_bytes: int
    line_count: int
    is_test: bool
    district: str
    commit_count: int
    recent_commit_count: int
    last_modified: Optional[str] = None
    activity_score: float
    hotspot_score: float
    hotspot_category: Literal["low", "medium", "high"]

class DistrictIntelligence(BaseModel):
    district_id: str
    name: str
    file_count: int
    total_lines: int
    total_size_bytes: int
    average_activity: float
    average_hotspot_score: float
    test_file_count: int
    languages: List[str]

class RepositoryStatistics(BaseModel):
    total_files: int
    total_source_files: int
    total_test_files: int
    total_lines: int
    total_size_bytes: int
    languages: List[str]
    district_count: int
    dependency_count: int
    average_activity: float
    average_hotspot_score: float

class Repository(BaseModel):
    id: str
    name: str
    owner: str
    url: str

class RepositoryResponse(BaseModel):
    repository: Repository
    statistics: RepositoryStatistics
    districts: List[DistrictIntelligence]
    files: List[FileIntelligence]
    dependencies: List[Dependency]


# Analyze API Models
class AnalyzeRequest(BaseModel):
    repo_url: str

class AnalyzeResponse(BaseModel):
    repository_id: str
    status: str


# Ask API Models
class AskRequest(BaseModel):
    repository_id: str
    question: str

class Target(BaseModel):
    file_id: str
    path: str
    reason: str

class AskResponse(BaseModel):
    answer: str
    targets: List[Target]


# Explain API Models
class ExplainRequest(BaseModel):
    repository_id: str
    file_id: str

class ExplainResponse(BaseModel):
    file_id: str
    summary: str
    keyComponents: List[str]
    potentialIssues: List[str]
