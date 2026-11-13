import os
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database.connection import init_db, get_db
from app.database import models
from app.agents.orchestrator import orchestrator
from app.routes import projects, manuscripts, chapters, entities, continuity

# Initialize Database tables
init_db()

app = FastAPI(
    title="Living Story Bible — AI Continuity Guardian",
    description="Browser-based intelligent writing workspace with persistent, evidence-backed narrative memory.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
if "*" not in origins:
    origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[ERROR] {request.method} {request.url.path} failed: {exc}")
    traceback.print_exc()
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# Health & Root endpoints
@app.get("/")
@app.get("/api/health")
@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "Living Story Bible — AI Continuity Guardian",
        "environment": settings.ENVIRONMENT,
        "database": "connected"
    }

# Seed Demo Endpoint: Loads 'The Last Kingdom' for instant testing
@app.post("/api/seed-demo")
@app.post("/seed-demo")
def seed_demo_manuscript(db: Session = Depends(get_db)):
    demo_path = Path(__file__).resolve().parent.parent.parent / "demo_manuscripts" / "the_last_kingdom.md"
    if not demo_path.exists():
        return {"error": "Demo manuscript file not found on disk."}

    # Check if project already exists
    existing = db.query(models.Project).filter(models.Project.name == "The Last Kingdom").first()
    if existing:
        return {
            "status": "already_seeded",
            "project_id": existing.id,
            "message": "Demo project 'The Last Kingdom' is already loaded."
        }

    # Create project
    project = models.Project(
        name="The Last Kingdom",
        description="Epic fantasy saga exploring the kingdom of Eldoria, the siege of Blackstone, and the Citadel."
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    with open(demo_path, "rb") as f:
        file_bytes = f.read()

    vault_path = os.path.join(settings.VAULT_STORAGE_DIRECTORY, f"{project.id}_the_last_kingdom.md.vault")

    manuscript = orchestrator.process_uploaded_manuscript(
        db=db,
        project_id=project.id,
        filename="the_last_kingdom.md",
        file_bytes=file_bytes,
        file_ext="md",
        vault_path=vault_path
    )

    return {
        "status": "success",
        "project_id": project.id,
        "manuscript_id": manuscript.id,
        "message": "Demo project 'The Last Kingdom' successfully processed into narrative memory!"
    }

# Mount routers with /api prefix as well as root
app.include_router(projects.router, prefix="/api")
app.include_router(manuscripts.router, prefix="/api")
app.include_router(chapters.router, prefix="/api")
app.include_router(entities.router, prefix="/api")
app.include_router(continuity.router, prefix="/api")

# Also mount under root to strictly adhere to roadmap endpoint table
app.include_router(projects.router)
app.include_router(manuscripts.router)
app.include_router(chapters.router)
app.include_router(entities.router)
app.include_router(continuity.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
