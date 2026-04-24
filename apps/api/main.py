from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from routers import events, teams, commits, integrity, users, scores, notifications, mentor_match

app = FastAPI(title="HackBridge API", version="1.5.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(events.router)
app.include_router(teams.router)
app.include_router(commits.router)
app.include_router(integrity.router)
app.include_router(users.router)
app.include_router(scores.router)
app.include_router(notifications.router)
app.include_router(mentor_match.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.5.0"}
