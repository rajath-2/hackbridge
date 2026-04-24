import sys
from unittest.mock import MagicMock

# Monkeypatch for systems with restricted DLL loading (e.g. matplotlib blocked by policy)
try:
    import matplotlib
    import matplotlib.pyplot
except (ImportError, Exception):
    sys.modules["matplotlib"] = MagicMock()
    sys.modules["matplotlib.pyplot"] = MagicMock()

# Ensure pkg_resources is available (for copydetect)
try:
    import pkg_resources
except ImportError:
    sys.modules["pkg_resources"] = MagicMock()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from routers import events, teams, commits, integrity, users, scores, notifications, mentor_match, collaboration

app = FastAPI(title="HackBridge API", version="1.5.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
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
app.include_router(collaboration.router)

from fastapi.responses import HTMLResponse

@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <html>
        <head>
            <title>HackBridge API</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; margin-top: 10%; background-color: #121212; color: #ffffff; }
                h1 { color: #4CAF50; font-size: 3em; margin-bottom: 10px; }
                p { font-size: 1.2em; color: #b3b3b3; line-height: 1.6; }
                .container { max-width: 700px; margin: auto; background: #1e1e1e; padding: 40px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #333; }
                .btn { display: inline-block; margin-top: 25px; padding: 15px 30px; background-color: #4CAF50; color: white; text-decoration: none; font-weight: bold; border-radius: 8px; transition: background 0.3s; }
                .btn:hover { background-color: #45a049; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 HackBridge API</h1>
                <p>The Ultimate Hackathon Management Backend</p>
                <p>Seamless hackathon management, team building, AI-powered mentor matching, and code integrity tracking.</p>
                <a href="/docs" class="btn">View API Documentation</a>
            </div>
        </body>
    </html>
    """

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.5.0"}
