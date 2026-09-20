from app.analyzer.aggregator import aggregate_districts, aggregate_repository
from app.models.schemas import FileIntelligence

def test_aggregate_districts():
    files = [
        FileIntelligence(
            id="f1", name="f1.py", path="src/f1.py", extension=".py", language="Python",
            size_bytes=1000, line_count=100, is_test=False, district="src",
            commit_count=10, recent_commit_count=10, activity_score=0.5, hotspot_score=0.5, hotspot_category="medium"
        ),
        FileIntelligence(
            id="f2", name="f2.py", path="src/f2.py", extension=".py", language="Python",
            size_bytes=500, line_count=50, is_test=True, district="src",
            commit_count=2, recent_commit_count=2, activity_score=0.1, hotspot_score=0.1, hotspot_category="low"
        )
    ]
    
    districts = aggregate_districts(files)
    assert len(districts) == 1
    d = districts[0]
    assert d.name == "src"
    assert d.file_count == 2
    assert d.total_lines == 150
    assert d.total_size_bytes == 1500
    assert d.test_file_count == 1
    assert d.languages == ["Python"]

def test_aggregate_repository():
    files = [
        FileIntelligence(
            id="f1", name="f1.py", path="src/f1.py", extension=".py", language="Python",
            size_bytes=1000, line_count=100, is_test=False, district="src",
            commit_count=10, recent_commit_count=10, activity_score=0.5, hotspot_score=0.5, hotspot_category="medium"
        )
    ]
    districts = aggregate_districts(files)
    stats = aggregate_repository(files, districts, dependency_count=5)
    
    assert stats.total_files == 1
    assert stats.total_source_files == 1
    assert stats.total_test_files == 0
    assert stats.district_count == 1
    assert stats.dependency_count == 5
    assert stats.languages == ["Python"]
