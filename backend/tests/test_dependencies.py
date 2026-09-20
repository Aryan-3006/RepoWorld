from app.analyzer.dependencies import extract_python_dependencies, extract_js_ts_dependencies, extract_dependencies

def test_extract_python_dependencies():
    content = """
import os
from src.auth import auth_service
import src.utils
from . import relative
    """
    all_paths = {"os.py", "src/auth/auth_service.py", "src/utils.py", "relative.py"}
    deps = extract_python_dependencies(content, "main.py", all_paths)
    
    # os is standard library but if we had an os.py it would trigger (heuristics)
    assert "src/auth/auth_service.py" in deps
    assert "src/utils.py" in deps

def test_extract_js_ts_dependencies():
    content = """
import React from 'react';
import { Button } from '../components/Button';
const utils = require('../utils/helpers');
    """
    current_path = "src/pages/Home.js"
    all_paths = {
        "src/components/Button.js",
        "src/components/Button.ts",
        "src/utils/helpers.js",
        "react.js"
    }
    
    deps = extract_js_ts_dependencies(content, current_path, all_paths)
    assert "src/components/Button.js" in deps
    assert "src/utils/helpers.js" in deps
    assert "react.js" not in deps # Not relative

def test_extract_dependencies_wrapper():
    content = "from my_package import my_module"
    path_to_id = {
        "my_package/my_module.py": "my_module_id"
    }
    deps = extract_dependencies("source_id", "main.py", content, "Python", path_to_id)
    assert len(deps) == 1
    assert deps[0].source_file_id == "source_id"
    assert deps[0].target_file_id == "my_module_id"
