import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.services.auth_service import auth_service
from app.config import settings

logger = logging.getLogger("auth_router")

router = APIRouter(prefix="/auth", tags=["Authentication"])

COOKIE_NAME = "northstar_session"
COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

def set_auth_cookie(response: Response, token: str):
    """Set secure HTTP-only session cookie."""
    is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        expires=COOKIE_MAX_AGE,
        httponly=True,
        secure=is_prod,
        samesite="lax" if not is_prod else "none",
        path="/"
    )

def clear_auth_cookie(response: Response):
    """Clear session cookie."""
    is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=is_prod,
        samesite="lax" if not is_prod else "none",
        path="/"
    )

def get_token_from_request(request: Request) -> Optional[str]:
    """Extract token from Authorization header or HTTP-only cookie."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1].strip()
    # Check cookie
    cookie_token = request.cookies.get(COOKIE_NAME)
    if cookie_token:
        return cookie_token.strip()
    return None

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> models.User:
    """Dependency: retrieve currently authenticated user or raise 401."""
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = auth_service.decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = auth_service.get_user_by_id(db, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def get_optional_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """Dependency: retrieve user if authenticated, else None."""
    token = get_token_from_request(request)
    if not token:
        return None
    payload = auth_service.decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    return auth_service.get_user_by_id(db, payload["sub"])

def require_project_access(
    project_id: str,
    user: models.User,
    db: Session,
    require_write: bool = False
) -> models.Project:
    """
    Enforces project-level isolation at database level.
    Validates ownership or active membership.
    Demo projects are read-only for other users unless owned.
    """
    project = db.query(models.Project).filter(models.Project.id == str(project_id)).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    # Project owner has full access
    if str(project.user_id) == str(user.id):
        return project

    # Check project membership
    membership = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == str(project_id),
        models.ProjectMember.user_id == str(user.id)
    ).first()
    if membership:
        if require_write and membership.role == "viewer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Viewer role is read-only for this project."
            )
        return project

    # Demo projects can be viewed by anyone, but not modified by other users
    if project.is_demo:
        if require_write and not user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Demo project is read-only. Duplicate or create your own project to edit."
            )
        return project

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You do not have permission to access this project."
    )

# --- Routes ---

@router.post("/register", response_model=s_models.AuthResponse)
def register(data: s_models.UserRegister, response: Response, db: Session = Depends(get_db)):
    try:
        user = auth_service.register_user(
            db=db,
            email=data.email,
            password=data.password,
            confirm_password=data.confirm_password,
            full_name=data.full_name
        )
        token = auth_service.create_access_token({"sub": str(user.id), "email": user.email})
        set_auth_cookie(response, token)
        return s_models.AuthResponse(
            user=s_models.UserOut.from_orm(user),
            token=token,
            message="User registration successful."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Registration failed.")

@router.post("/login", response_model=s_models.AuthResponse)
def login(data: s_models.UserLogin, response: Response, db: Session = Depends(get_db)):
    user = auth_service.authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    token = auth_service.create_access_token({"sub": str(user.id), "email": user.email})
    set_auth_cookie(response, token)
    return s_models.AuthResponse(
        user=s_models.UserOut.from_orm(user),
        token=token,
        message="Login successful."
    )

@router.post("/logout")
def logout(response: Response):
    clear_auth_cookie(response)
    return {"status": "ok", "message": "Signed out successfully."}

@router.get("/me", response_model=s_models.UserOut)
def get_current_user_profile(user: models.User = Depends(get_current_user)):
    return s_models.UserOut.from_orm(user)

@router.post("/guest", response_model=s_models.AuthResponse)
def guest_login(response: Response, db: Session = Depends(get_db)):
    """One-click instant author access for quick testing without manual registration."""
    guest_user = auth_service.get_or_create_guest_user(db)
    token = auth_service.create_access_token({"sub": str(guest_user.id), "email": guest_user.email})
    set_auth_cookie(response, token)
    return s_models.AuthResponse(
        user=s_models.UserOut.from_orm(guest_user),
        token=token,
        message="Guest author session established."
    )
