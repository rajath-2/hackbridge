from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Optional
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from services import pdf_service, groq_service

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/resume")
async def upload_resume(
    file: UploadFile = File(...), 
    event_id: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Upload PDF resume, extract text via opendataloader-pdf, and analyze via Groq."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    content = await file.read()
    try:
        # 1. Extract text
        text = pdf_service.extract_text(content)
        if not text:
            raise ValueError("Failed to extract text from PDF")
            
        # 2. Analyze via AI
        analysis = await groq_service.analyse_resume(text)
        
        # 3. Update profile based on role
        sb = get_supabase()
        if user["role"] == "mentor":
            sb.table("mentor_profiles").upsert({
                "user_id": user["id"],
                "event_id": event_id,
                "expertise_tags": analysis["expertise_tags"],
                "bio": analysis["bio"],
                "resume_raw": text
            }, on_conflict="user_id").execute()
        elif user["role"] == "judge":
            sb.table("judge_profiles").upsert({
                "user_id": user["id"],
                "event_id": event_id,
                "domain": analysis["domain"],
                "resume_raw": text
            }, on_conflict="user_id").execute()
            
        return {"status": "success", "analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume processing failed: {str(e)}")

@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    return user

@router.get("/me/cli-token")
async def get_my_cli_token(user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("users").select("cli_token, cli_linked_at").eq("id", user["id"]).execute()
    return res.data[0] if res.data else {"cli_token": None, "cli_linked_at": None}

@router.post("/validate-cli-token/{token}")
async def validate_cli_token(token: str):
    """CLI initialization endpoint — validates a personal token and returns team context."""
    sb = get_supabase()
    # 1. Find user by token
    user_res = sb.table("users").select("id, name").eq("cli_token", token).execute()
    if not user_res.data:
        raise HTTPException(status_code=401, detail="Invalid personal CLI token")
    
    user_id = user_res.data[0]["id"]
    
    # 2. Find their team
    team_res = sb.table("team_members").select("team_id, teams(*, events(event_code, start_time))").eq("user_id", user_id).execute()
    if not team_res.data:
        raise HTTPException(status_code=404, detail="User is not part of any team")
        
    team = team_res.data[0]["teams"]
    
    return {
        "user_id": user_id,
        "user_name": user_res.data[0]["name"],
        "team_id": team["id"],
        "team_code": team["team_code"],
        "event_id": team["event_id"],
        "event_code": team["events"]["event_code"],
        "event_start_time": team["events"].get("start_time") # Use existing data from the join
    }
