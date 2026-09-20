from typing import Literal

def calculate_hotspot_score(size_bytes: int, commit_count: int, is_test: bool) -> tuple[float, Literal["low", "medium", "high"]]:
    """
    Calculates a heuristic hotspot score for 3D visualization.
    Weights: 40% Size, 40% Activity, 20% Missing Tests Penalty
    
    This is purely a visualization metric and NOT a formal code quality indicator.
    """
    # Normalize size (cap at 100KB for heuristic purposes)
    max_size = 100_000
    normalized_size = min(size_bytes / max_size, 1.0)
    
    # Normalize activity (cap at 50 commits for heuristic purposes)
    max_commits = 50
    normalized_activity = min(commit_count / max_commits, 1.0)
    
    # Test penalty (non-test files get a penalty to increase their heat)
    test_penalty = 0.0 if is_test else 1.0
    
    score = (normalized_size * 0.4) + (normalized_activity * 0.4) + (test_penalty * 0.2)
    score = min(max(score, 0.0), 1.0)
    
    if score > 0.7:
        category = "high"
    elif score > 0.4:
        category = "medium"
    else:
        category = "low"
        
    return score, category
