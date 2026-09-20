import re
import posixpath
from typing import List, Dict, Set
from app.models.schemas import Dependency

def extract_python_dependencies(content: str, current_path: str, all_paths: Set[str]) -> List[str]:
    """Extracts python imports and resolves them to potential repo paths."""
    deps = []
    # Match: from x.y import z
    # Match: import x.y.z
    import_regex = re.compile(r'^\s*(?:from\s+([\w\.]+)\s+import\s+([\w\., \t\*]+)|import\s+([\w\., \t]+))', re.MULTILINE)
    
    for match in import_regex.finditer(content):
        from_part = match.group(1)
        from_imports = match.group(2)
        import_part = match.group(3)
        
        modules_to_check = []
        if from_part and from_imports:
            # from x.y import z -> x/y/z.py or x/y.py
            base_path = from_part.replace(".", "/")
            modules_to_check.append(base_path)
            
            for mod in from_imports.split(","):
                mod = mod.strip().split(" ")[0] # handle 'from x import y as z'
                if mod and mod != "*":
                    modules_to_check.append(f"{base_path}/{mod}")
                    
        elif import_part:
            # import x, y, z -> x.py, y.py, z.py
            for mod in import_part.split(","):
                mod = mod.strip().split(" ")[0] # handle 'import x as y'
                modules_to_check.append(mod.replace(".", "/"))
                
        for mod in modules_to_check:
            # Check potential file paths
            potential_paths = [
                f"{mod}.py",
                f"{mod}/__init__.py",
                # Relative imports are harder, this is a basic heuristic
            ]
            for p in potential_paths:
                if p in all_paths:
                    deps.append(p)
                    break
                    
    return deps

def extract_js_ts_dependencies(content: str, current_path: str, all_paths: Set[str]) -> List[str]:
    """Extracts JS/TS imports and resolves them to potential repo paths."""
    deps = []
    # Match: import X from 'path'
    # Match: import { X } from "path"
    # Match: require('path')
    import_regex = re.compile(r'(?:import\s+.*?from\s+|require\s*\(\s*)[\'"]([^\'"]+)[\'"]', re.MULTILINE)
    
    current_dir = posixpath.dirname(current_path)
    
    for match in import_regex.finditer(content):
        import_path = match.group(1)
        
        # Only resolve relative imports for repository files
        if import_path.startswith("."):
            resolved_base = posixpath.normpath(posixpath.join(current_dir, import_path))
            
            # Check common JS/TS extensions
            potential_paths = [
                f"{resolved_base}.js",
                f"{resolved_base}.ts",
                f"{resolved_base}.jsx",
                f"{resolved_base}.tsx",
                f"{resolved_base}/index.js",
                f"{resolved_base}/index.ts"
            ]
            
            for p in potential_paths:
                if p in all_paths:
                    deps.append(p)
                    break
                    
    return deps

def extract_dependencies(file_id: str, path: str, content: str, language: str, path_to_id: Dict[str, str]) -> List[Dependency]:
    """Parses source code to find dependencies matching known repository files."""
    all_paths = set(path_to_id.keys())
    resolved_paths = []
    
    if language == "Python":
        resolved_paths = extract_python_dependencies(content, path, all_paths)
    elif language in ["JavaScript", "TypeScript", "React", "React Native"]:
        resolved_paths = extract_js_ts_dependencies(content, path, all_paths)
        
    # Create unique Dependencies
    unique_target_ids = set()
    dependencies = []
    for r_path in resolved_paths:
        target_id = path_to_id.get(r_path)
        if target_id and target_id != file_id and target_id not in unique_target_ids:
            unique_target_ids.add(target_id)
            dependencies.append(Dependency(
                source_file_id=file_id,
                target_file_id=target_id
            ))
            
    return dependencies
