from app.analyzer.hotspots import calculate_hotspot_score

def test_calculate_hotspot_score_limits():
    # Max limits
    score, category = calculate_hotspot_score(1_000_000, 100, False)
    assert score == 1.0
    assert category == "high"

def test_calculate_hotspot_score_low():
    # Zero activity, small size, is test
    score, category = calculate_hotspot_score(100, 0, True)
    assert score < 0.4
    assert category == "low"
    
def test_calculate_hotspot_score_penalty():
    # Missing tests increases score
    s1, c1 = calculate_hotspot_score(50_000, 25, True)
    s2, c2 = calculate_hotspot_score(50_000, 25, False)
    assert s2 > s1
