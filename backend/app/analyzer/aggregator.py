from typing import List, Dict, Any
from app.models.schemas import FileIntelligence, DistrictIntelligence, RepositoryStatistics

def aggregate_districts(files: List[FileIntelligence]) -> List[DistrictIntelligence]:
    districts_map: Dict[str, Dict[str, Any]] = {}
    
    for f in files:
        did = f.district
        if did not in districts_map:
            districts_map[did] = {
                "name": did,
                "file_count": 0,
                "total_lines": 0,
                "total_size_bytes": 0,
                "total_activity": 0.0,
                "total_hotspot_score": 0.0,
                "test_file_count": 0,
                "languages": set()
            }
            
        d = districts_map[did]
        d["file_count"] += 1
        d["total_lines"] += f.line_count
        d["total_size_bytes"] += f.size_bytes
        d["total_activity"] += f.activity_score
        d["total_hotspot_score"] += f.hotspot_score
        if f.is_test:
            d["test_file_count"] += 1
        if f.language and f.language != "Unknown":
            d["languages"].add(f.language)
            
    # Finalize DistrictIntelligence
    results = []
    for did, d in districts_map.items():
        count = d["file_count"]
        results.append(DistrictIntelligence(
            district_id=did,
            name=d["name"],
            file_count=count,
            total_lines=d["total_lines"],
            total_size_bytes=d["total_size_bytes"],
            average_activity=round(d["total_activity"] / count, 2) if count > 0 else 0.0,
            average_hotspot_score=round(d["total_hotspot_score"] / count, 2) if count > 0 else 0.0,
            test_file_count=d["test_file_count"],
            languages=list(d["languages"])
        ))
        
    return results

def aggregate_repository(files: List[FileIntelligence], districts: List[DistrictIntelligence], dependency_count: int) -> RepositoryStatistics:
    total_files = len(files)
    total_source_files = sum(1 for f in files if not f.is_test)
    total_test_files = sum(1 for f in files if f.is_test)
    total_lines = sum(f.line_count for f in files)
    total_size_bytes = sum(f.size_bytes for f in files)
    
    languages = set(f.language for f in files if f.language and f.language != "Unknown")
    
    total_activity = sum(f.activity_score for f in files)
    total_hotspot = sum(f.hotspot_score for f in files)
    
    return RepositoryStatistics(
        total_files=total_files,
        total_source_files=total_source_files,
        total_test_files=total_test_files,
        total_lines=total_lines,
        total_size_bytes=total_size_bytes,
        languages=list(languages),
        district_count=len(districts),
        dependency_count=dependency_count,
        average_activity=round(total_activity / total_files, 2) if total_files > 0 else 0.0,
        average_hotspot_score=round(total_hotspot / total_files, 2) if total_files > 0 else 0.0
    )
