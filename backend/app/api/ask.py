import os
import json
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException
# pyrefly: ignore [missing-import]
from groq import Groq
from app.models.schemas import AskRequest, AskResponse, Target
from app.store import REPOSITORIES

router = APIRouter()

def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    return Groq(api_key=api_key)

@router.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    if request.repository_id not in REPOSITORIES:
        raise HTTPException(status_code=404, detail="Repository not found. Please analyze it first.")
        
    repo_data = REPOSITORIES[request.repository_id]
    
    client = get_groq_client()
    if not client:
        # Fallback if Groq is not configured
        return AskResponse(
            answer="Groq API key not configured. Cannot process natural language queries.",
            targets=[]
        )
        
    # Prepare context
    files_context = []
    for f in repo_data.files:
        files_context.append(f"{f.id} | {f.path} | {f.language} | {f.line_count} lines")
        
    # Limit context size to avoid token limits (top 300 files)
    context_str = "\n".join(files_context[:300])
    
    prompt = f"""
You are an AI assistant analyzing a codebase.
The user is asking a question about the repository '{repo_data.repository.name}'.

Here is a list of files in the repository (Format: ID | Path | Language | Lines):
{context_str}

User Question: {request.question}

Identify the files most relevant to answering this question. Provide a short, helpful answer, and a list of target file IDs.
Respond in pure JSON format matching this schema exactly:
{{
  "answer": "Your detailed answer here.",
  "targets": [
    {{
      "file_id": "exact_file_id_from_list",
      "path": "exact_path_from_list",
      "reason": "Why this file is relevant"
    }}
  ]
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
        
        targets = []
        for t in data.get("targets", []):
            targets.append(Target(
                file_id=t.get("file_id", ""),
                path=t.get("path", ""),
                reason=t.get("reason", "")
            ))
            
        return AskResponse(
            answer=data.get("answer", "I couldn't find a specific answer."),
            targets=targets
        )
    except Exception as e:
        print(f"Groq API Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process question via AI.")
