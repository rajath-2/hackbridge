from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from services import pdf_service, groq_service

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/resume")
async def upload_resume(file: UploadFile = File(...), user=Depends(get_current_user)):
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
                "expertise_tags": analysis["expertise_tags"],
                "bio": analysis["bio"],
                "resume_raw": text
            }, on_conflict="user_id").execute()
        elif user["role"] == "judge":
            sb.table("judge_profiles").upsert({
                "user_id": user["id"],
                "domain": analysis["domain"],
                "resume_raw": text
            }, on_conflict="user_id").execute()
            
        return {"status": "success", "analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume processing failed: {str(e)}")

@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    return user
