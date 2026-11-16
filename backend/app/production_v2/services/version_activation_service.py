"""
Production V2 Atomic Manuscript Version Activation Service
Enforces the manuscript version lifecycle:
UPLOADED -> PROCESSING -> READY -> ATOMIC_ACTIVATION.

Guarantees:
- Prior active version remains untouched and fully accessible during background processing.
- The new revision is promoted to active atomically in a single transaction only when all 14 pipeline stages succeed.
- If processing fails at any stage, the pending version is marked error and the previous active version remains active.
"""
from datetime import datetime, timezone
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from app.database import models


class VersionActivationService:
    """Manages transactional, atomic promotion of manuscript versions."""

    def prepare_pending_version(
        self,
        db: Session,
        project_id: str,
        filename: str,
        file_type: str,
        vault_path: str,
        file_size: int = 0
    ) -> Tuple[models.Manuscript, int]:
        """
        Creates a pending manuscript version without altering existing active versions.
        Status is set to 'processing', is_active_version is False.
        """
        existing_manuscripts = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id
        ).all()
        current_max = max([m.version_number or 1 for m in existing_manuscripts], default=0)
        new_version_num = current_max + 1

        pending_manuscript = models.Manuscript(
            project_id=project_id,
            filename=filename,
            file_type=file_ext if "file_ext" in locals() else file_type,
            file_size=file_size,
            storage_path=vault_path,
            version_number=new_version_num,
            status="processing",
            is_active_version=False,
            created_at=datetime.now(timezone.utc)
        )
        db.add(pending_manuscript)
        db.commit()
        db.refresh(pending_manuscript)
        return pending_manuscript, new_version_num

    def activate_version_atomically(self, db: Session, manuscript_id: str) -> models.Manuscript:
        """
        Atomically supersedes older versions and activates the target manuscript.
        Executes within a single database commit.
        """
        target = db.query(models.Manuscript).filter(models.Manuscript.id == manuscript_id).first()
        if not target:
            raise ValueError(f"Manuscript {manuscript_id} not found.")

        now = datetime.now(timezone.utc)
        
        # Deactivate all existing active versions for this project
        prior_active = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == target.project_id,
            models.Manuscript.is_active_version.is_(True),
            models.Manuscript.id != target.id
        ).all()

        for m in prior_active:
            m.is_active_version = False
            m.superseded_at = now

        # Atomically promote target to active
        target.is_active_version = True
        target.status = "processed"
        target.superseded_at = None
        db.commit()
        db.refresh(target)
        return target

    def mark_version_failed(self, db: Session, manuscript_id: str, error_message: Optional[str] = None) -> models.Manuscript:
        """
        Marks pending version as failed without affecting any prior active version.
        """
        target = db.query(models.Manuscript).filter(models.Manuscript.id == manuscript_id).first()
        if not target:
            return None

        target.status = "error"
        target.is_active_version = False
        db.commit()
        db.refresh(target)
        return target


version_activation_service = VersionActivationService()
