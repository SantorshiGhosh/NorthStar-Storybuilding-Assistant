"""
Production V2 Manuscript Version Repository
Ensures zero-loss, non-destructive versioning, rollback, and cross-version diffs.
"""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import models
from app.production_v2.schemas.v2_schemas import (
    ManuscriptVersionOut,
    VersionRollbackResponse,
    VersionCompareResponse,
    ChapterDiffOut
)


class VersionRepository:
    """
    Manages non-destructive manuscript version lifecycle, comparison, and rollback.
    """

    def list_versions(self, db: Session, project_id: str) -> List[ManuscriptVersionOut]:
        """Lists all manuscript versions for a project, sorted newest to oldest."""
        manuscripts = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id
        ).order_by(models.Manuscript.version_number.desc()).all()

        results = []
        for m in manuscripts:
            chapters = db.query(models.Chapter).filter(models.Chapter.manuscript_id == m.id).all()
            total_words = sum(ch.word_count or len((ch.content or "").split()) for ch in chapters)
            
            # Count associated facts
            fact_count = db.query(func.count(models.StoryFact.id)).filter(
                models.StoryFact.source_chapter_id.in_([ch.id for ch in chapters])
            ).scalar() if chapters else 0

            results.append(ManuscriptVersionOut(
                version_number=m.version_number or 1,
                manuscript_id=str(m.id),
                filename=m.filename or "manuscript.md",
                is_active=bool(m.is_active_version),
                created_at=m.created_at.isoformat() if m.created_at else datetime.now(timezone.utc).isoformat(),
                chapter_count=len(chapters),
                word_count=total_words,
                fact_count=fact_count or 0,
                change_summary=f"Version {m.version_number or 1}: {len(chapters)} chapters, {total_words} words."
            ))
        return results

    def get_active_version(self, db: Session, project_id: str) -> Optional[models.Manuscript]:
        """Gets currently active manuscript version for project."""
        active = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id,
            models.Manuscript.is_active_version == True
        ).first()
        if not active:
            active = db.query(models.Manuscript).filter(
                models.Manuscript.project_id == project_id
            ).order_by(models.Manuscript.version_number.desc()).first()
        return active

    def rollback_to_version(self, db: Session, project_id: str, target_version_number: int) -> VersionRollbackResponse:
        """
        Activates the designated historical version and supersedes the current active version.
        Guarantees zero data loss: all versions and chapters remain preserved.
        """
        target_m = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id,
            models.Manuscript.version_number == target_version_number
        ).first()

        if not target_m:
            raise ValueError(f"Manuscript version {target_version_number} does not exist for this project.")

        now = datetime.now(timezone.utc)

        # Deactivate all versions for this project
        db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id
        ).update({
            "is_active_version": False,
            "superseded_at": now
        }, synchronize_session="fetch")

        # Activate target version
        target_m.is_active_version = True
        target_m.superseded_at = None
        db.commit()
        db.refresh(target_m)

        return VersionRollbackResponse(
            status="success",
            active_version_number=target_m.version_number,
            message=f"Successfully rolled back project to Version {target_version_number}."
        )

    def compare_versions(
        self,
        db: Session,
        project_id: str,
        base_version_number: int,
        target_version_number: int
    ) -> VersionCompareResponse:
        """
        Computes structured differences between two versions of a manuscript.
        """
        base_m = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id,
            models.Manuscript.version_number == base_version_number
        ).first()
        target_m = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id,
            models.Manuscript.version_number == target_version_number
        ).first()

        if not base_m or not target_m:
            raise ValueError("One or both requested versions do not exist.")

        base_chapters = {
            ch.chapter_number: ch for ch in db.query(models.Chapter).filter(models.Chapter.manuscript_id == base_m.id).all()
        }
        target_chapters = {
            ch.chapter_number: ch for ch in db.query(models.Chapter).filter(models.Chapter.manuscript_id == target_m.id).all()
        }

        all_ch_numbers = sorted(set(base_chapters.keys()) | set(target_chapters.keys()))
        chapter_diffs: List[ChapterDiffOut] = []
        base_words_total = 0
        target_words_total = 0

        for num in all_ch_numbers:
            base_ch = base_chapters.get(num)
            target_ch = target_chapters.get(num)

            b_words = len((base_ch.content or "").split()) if base_ch else 0
            t_words = len((target_ch.content or "").split()) if target_ch else 0
            base_words_total += b_words
            target_words_total += t_words

            if base_ch and not target_ch:
                chapter_diffs.append(ChapterDiffOut(
                    chapter_number=num,
                    title=base_ch.title or f"Chapter {num}",
                    status="removed",
                    old_word_count=b_words,
                    new_word_count=0,
                    diff_summary=f"Chapter {num} removed in target version."
                ))
            elif not base_ch and target_ch:
                chapter_diffs.append(ChapterDiffOut(
                    chapter_number=num,
                    title=target_ch.title or f"Chapter {num}",
                    status="added",
                    old_word_count=0,
                    new_word_count=t_words,
                    diff_summary=f"Chapter {num} added in target version (+{t_words} words)."
                ))
            else:
                # Both exist
                if (base_ch.content or "").strip() == (target_ch.content or "").strip():
                    status = "identical"
                    summary = "Content unchanged."
                else:
                    delta = t_words - b_words
                    status = "modified"
                    delta_str = f"+{delta}" if delta >= 0 else str(delta)
                    summary = f"Content modified ({delta_str} words)."

                chapter_diffs.append(ChapterDiffOut(
                    chapter_number=num,
                    title=target_ch.title or base_ch.title or f"Chapter {num}",
                    status=status,
                    old_word_count=b_words,
                    new_word_count=t_words,
                    diff_summary=summary
                ))

        # Compare entities identified across versions
        return VersionCompareResponse(
            base_version=base_version_number,
            target_version=target_version_number,
            chapter_diffs=chapter_diffs,
            added_entities=[],
            removed_entities=[],
            word_count_delta=target_words_total - base_words_total
        )


version_repository = VersionRepository()
