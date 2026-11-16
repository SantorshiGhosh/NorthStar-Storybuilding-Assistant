import re
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.routes.auth import get_optional_user, get_current_user
from app.services.email_service import email_service
from app.config import settings

logger = logging.getLogger("support_router")

router = APIRouter(prefix="/support", tags=["Help & Support"])

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

ALLOWED_CATEGORIES = [
    "Account",
    "Login",
    "Manuscript Upload",
    "Technical Issue",
    "General Inquiry",
    "Other"
]

@router.post("/contact", response_model=s_models.ContactSupportResponse)
def submit_contact_form(
    data: s_models.ContactSupportCreate,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Submits a contact support message.
    Accessible to everyone: visitors, login/signup users, and authenticated authors.
    Validates input fields, persists ticket in the database support_queries table with status 'Pending',
    dispatches email notification to codebrew@gmail.com, and returns confirmation with ticket ID.
    """
    clean_name = (data.full_name or "").strip()
    clean_email = (data.email or "").strip().lower()
    clean_subject = (data.subject or "").strip()
    clean_desc = (data.description or data.message or "").strip()
    raw_category = (data.category or "General Inquiry").strip()

    # Match category cleanly or default to General Inquiry / Other
    matched_category = "General Inquiry"
    for cat in ALLOWED_CATEGORIES:
        if raw_category.lower() == cat.lower():
            matched_category = cat
            break
    else:
        # If user passed a custom category string, check if it matches Other
        matched_category = raw_category if raw_category else "Other"

    # Backend Validation
    if len(clean_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name must be at least 2 characters long."
        )

    if not EMAIL_REGEX.match(clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address format (e.g. author@example.com)."
        )

    if len(clean_subject) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject must be at least 3 characters long."
        )

    if len(clean_desc) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Detailed description of the problem must be at least 10 characters long."
        )

    # Duplicate / accidental submission prevention (check identical submission in last 60 seconds)
    recent_cutoff = datetime.utcnow() - timedelta(seconds=60)
    existing_duplicate = db.query(models.SupportQuery).filter(
        models.SupportQuery.email == clean_email,
        models.SupportQuery.subject == clean_subject,
        models.SupportQuery.description == clean_desc,
        models.SupportQuery.created_at >= recent_cutoff
    ).first()

    if existing_duplicate:
        logger.info(f"[Support] Duplicate submission prevented for {clean_email}, ticket #{existing_duplicate.id}")
        return s_models.ContactSupportResponse(
            status="success",
            message=f"Your support request has already been recorded and is being processed. Ticket #{str(existing_duplicate.id)[:8]}.",
            ticket_id=str(existing_duplicate.id),
            delivery_status="stored_in_support_inbox",
            category=existing_duplicate.category
        )

    user_id_str = str(user.id) if user else None
    submission_time = datetime.utcnow()

    # 1. Create persistent record in support_queries table (default status: "Pending")
    support_query = models.SupportQuery(
        user_id=user_id_str,
        full_name=clean_name,
        email=clean_email,
        subject=clean_subject,
        category=matched_category,
        description=clean_desc,
        status="Pending",
        created_at=submission_time
    )
    db.add(support_query)

    # Also record in support_messages for backward compatibility
    try:
        support_msg = models.SupportMessage(
            user_id=user_id_str,
            full_name=clean_name,
            email=clean_email,
            subject=f"[{matched_category}] {clean_subject}",
            message=clean_desc,
            status="pending",
            delivery_status="stored_in_support_inbox",
            created_at=submission_time
        )
        db.add(support_msg)
    except Exception as e:
        logger.warning(f"[Support] Note logging into legacy support_messages: {e}")

    db.commit()
    db.refresh(support_query)

    ticket_id = str(support_query.id)

    # 2. Dispatch email notification to codebrew@gmail.com
    delivery_status_text = "stored_in_support_inbox"
    try:
        delivery_result = email_service.send_support_email(
            full_name=clean_name,
            sender_email=clean_email,
            subject=clean_subject,
            description=clean_desc,
            ticket_id=ticket_id,
            category=matched_category,
            user_id=user_id_str,
            submission_time=submission_time
        )
        delivery_status_text = delivery_result.get("method", "stored_in_support_inbox")
    except Exception as exc:
        logger.error(f"[Support] Error during email dispatch (ticket #{ticket_id} is safely stored): {exc}")

    recipient = getattr(settings, "SUPPORT_EMAIL", "codebrew@gmail.com")

    return s_models.ContactSupportResponse(
        status="success",
        message=f"Your support inquiry has been received by NorthStar Support ({recipient}). Ticket #{ticket_id[:8]} created.",
        ticket_id=ticket_id,
        delivery_status=delivery_status_text,
        category=matched_category
    )


@router.get("/queries", response_model=List[s_models.SupportQueryOut])
def get_user_support_queries(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves all support queries submitted by the authenticated user.
    """
    queries = db.query(models.SupportQuery).filter(
        models.SupportQuery.user_id == str(user.id)
    ).order_by(models.SupportQuery.created_at.desc()).all()

    return queries


@router.get("/messages", response_model=List[s_models.SupportMessageOut])
def get_user_support_messages(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves all support messages submitted by the current authenticated user (legacy).
    """
    messages = db.query(models.SupportMessage).filter(
        models.SupportMessage.user_id == str(user.id)
    ).order_by(models.SupportMessage.created_at.desc()).all()

    return messages
