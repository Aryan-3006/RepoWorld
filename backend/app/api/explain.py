import os
import json
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException
# pyrefly: ignore [missing-import]
from groq import Groq
from app.models.schemas import ExplainRequest, ExplainResponse
from app.store import REPOSITORIES

router = APIRouter()

def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    return Groq(api_key=api_key)

@router.post("/explain", response_model=ExplainResponse)
async def explain_file(request: ExplainRequest):
    if request.repository_id not in REPOSITORIES:
        raise HTTPException(status_code=404, detail="Repository not found.")
        
    repo_data = REPOSITORIES[request.repository_id]
    
    # Find the file
    target_file = None
    for f in repo_data.files:
        if f.id == request.file_id:
            target_file = f
            break
            
    if not target_file:
        raise HTTPException(status_code=404, detail="File not found in repository.")
        
    client = get_groq_client()
    if not client:
        return ExplainResponse(
            file_id=request.file_id,
            summary=f"This is {target_file.path}. Groq API not configured for full explanation.",
            keyComponents=[],
            potentialIssues=[]
        )
        
    prompt = f"""
You are an AI assistant analyzing a specific file in a codebase.

File Details:
Path: {target_file.path}
Language: {target_file.language}
Lines of Code: {target_file.line_count}
Changes (Activity): {target_file.commit_count}

Explain this file's likely purpose based on its path and details. 
Provide a summary, a list of likely key components (functions/classes/sections), and any potential issues or observations.
Respond in pure JSON format matching this schema exactly:
{{
  "summary": "Detailed explanation of what this file probably does.",
  "keyComponents": ["Component 1", "Component 2"],
  "potentialIssues": ["Observation 1", "Observation 2"]
}}
Do not include markdown blocks, just the raw JSON.
"""

    try:
        completion = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        response_text = completion.choices[0].message.content
        data = json.loads(response_text)
        
        return ExplainResponse(
            file_id=request.file_id,
            summary=data.get("summary", "No summary generated."),
            keyComponents=data.get("keyComponents", []),
            potentialIssues=data.get("potentialIssues", [])
        )
    except Exception as e:
        print(f"Groq API Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to explain file via AI.")
