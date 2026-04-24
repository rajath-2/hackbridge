import httpx
from core.config import settings
from typing import List, Dict, Tuple, Optional, Any

BASE = "https://api.github.com"

def _headers():
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if settings.github_token:
        h["Authorization"] = f"Bearer {settings.github_token}"
    return h

def _parse_repo_url(repo_url: str) -> Tuple[str, str]:
    """Extract owner/repo from GitHub URL."""
    # Handle cases like https://github.com/owner/repo or owner/repo
    clean_url = repo_url.rstrip("/").replace("https://github.com/", "").replace("http://github.com/", "")
    parts = clean_url.split("/")
    if len(parts) < 2:
        raise ValueError(f"Cannot parse repo URL: {repo_url}")
    return parts[0], parts[1]

async def get_file_tree(repo_url: str) -> str:
    owner, repo = _parse_repo_url(repo_url)
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE}/repos/{owner}/{repo}/git/trees/HEAD?recursive=1", headers=_headers(), timeout=15)
        resp.raise_for_status()
        tree = resp.json().get("tree", [])
        return "\n".join(item["path"] for item in tree if item["type"] == "blob")

async def get_readme(repo_url: str) -> str:
    owner, repo = _parse_repo_url(repo_url)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{BASE}/repos/{owner}/{repo}/readme", headers=_headers(), timeout=10)
            resp.raise_for_status()
            import base64
            return base64.b64decode(resp.json()["content"]).decode("utf-8", errors="replace")
        except Exception:
            return ""

async def get_commits(repo_url: str, since: Optional[str] = None) -> List[Dict]:
    """Fetch commits. `since` is ISO8601 string."""
    owner, repo = _parse_repo_url(repo_url)
    params = {}
    if since:
        params["since"] = since
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE}/repos/{owner}/{repo}/commits", headers=_headers(), params=params, timeout=15)
        resp.raise_for_status()
        result = []
        for c in resp.json():
            result.append({
                "sha": c["sha"],
                "message": c["commit"]["message"],
                "timestamp": c["commit"]["author"]["date"],
                "author": c["commit"]["author"]["name"],
            })
        return result

async def get_commit_diff(repo_url: str, sha: str) -> Dict[str, Any]:
    """Fetch single commit diff data."""
    owner, repo = _parse_repo_url(repo_url)
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE}/repos/{owner}/{repo}/commits/{sha}", headers=_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return {
            "stats": data["stats"], # {total, additions, deletions}
            "files": [f["filename"] for f in data["files"]]
        }
