import pytest
from fastapi import HTTPException
from app.github.client import (
    parse_github_url,
    generate_file_id,
    detect_language,
    is_test_file,
    filter_file
)

def test_parse_github_url():
    # Valid urls
    assert parse_github_url("https://github.com/facebook/react") == ("facebook", "react")
    assert parse_github_url("https://github.com/facebook/react/") == ("facebook", "react")
    assert parse_github_url("https://github.com/facebook/react.git") == ("facebook", "react")
    assert parse_github_url("https://www.github.com/facebook/react") == ("facebook", "react")
    assert parse_github_url("https://github.com/facebook/react/tree/main") == ("facebook", "react")
    assert parse_github_url("https://github.com/facebook/react/blob/main/file.py") == ("facebook", "react")

def test_parse_github_url_invalid():
    with pytest.raises(HTTPException):
        parse_github_url("https://gitlab.com/user/repo")
    
    with pytest.raises(HTTPException):
        parse_github_url("not-a-url")

def test_filter_file():
    # Excluded directories
    assert filter_file("node_modules/package/index.js", "blob") == False
    assert filter_file(".git/config", "blob") == False
    assert filter_file("dist/bundle.js", "blob") == False
    assert filter_file("src/node_modules/test.js", "blob") == False 
    
    # Excluded extensions
    assert filter_file("assets/image.png", "blob") == False
    assert filter_file("build/app.exe", "blob") == False
    
    # Valid files
    assert filter_file("src/main.py", "blob") == True
    assert filter_file("package.json", "blob") == True
    
    # Invalid types
    assert filter_file("src", "tree") == False

def test_stable_ids():
    assert generate_file_id("src/auth/auth_service.py") == "src-auth-auth-service-py"
    assert generate_file_id("package.json") == "package-json"
    assert generate_file_id(".env.example") == "env-example"

def test_detect_language():
    assert detect_language("main.py") == "Python"
    assert detect_language("src/app.tsx") == "TypeScript"
    assert detect_language("index.js") == "JavaScript"
    assert detect_language("unknown.xyz") == "Unknown"

def test_is_test_file():
    assert is_test_file("test_auth.py") == True
    assert is_test_file("auth_test.py") == True
    assert is_test_file("login.test.ts") == True
    assert is_test_file("auth.spec.js") == True
    assert is_test_file("tests/main.py") == True
    assert is_test_file("__tests__/app.tsx") == True
    
    assert is_test_file("src/main.py") == False
    assert is_test_file("auth.py") == False

def test_sort_and_limit_files():
    from app.github.client import sort_and_limit_files
    
    items = [
        {"path": "README.md"},        # Priority 3
        {"path": "package.json"},     # Priority 2
        {"path": "src/main.py"},      # Priority 1
        {"path": "Dockerfile"},       # Priority 2
        {"path": "unknown.xyz"}       # Priority 4
    ]
    
    sorted_items = sort_and_limit_files(items, limit=3)
    
    # Verify limit
    assert len(sorted_items) == 3
    
    # Verify order: Priority 1 (main.py) > Priority 2 (Dockerfile, package.json)
    assert sorted_items[0]["path"] == "src/main.py"
    # Alphabetical tie break for Priority 2
    assert sorted_items[1]["path"] == "Dockerfile"
    assert sorted_items[2]["path"] == "package.json"
