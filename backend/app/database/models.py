import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database.connection import Base

def gen_uuid():
    return uuid.uuid4().hex

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(64), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    manuscripts = relationship("Manuscript", back_populates="project", cascade="all, delete-orphan")
    chapters = relationship("Chapter", back_populates="project", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="project", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="project", cascade="all, delete-orphan")
    story_facts = relationship("StoryFact", back_populates="project", cascade="all, delete-orphan")
    timeline_events = relationship("TimelineEvent", back_populates="project", cascade="all, delete-orphan")
    continuity_issues = relationship("ContinuityIssue", back_populates="project", cascade="all, delete-orphan")


class Manuscript(Base):
    __tablename__ = "manuscripts"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # docx, txt, md, pdf
    file_size = Column(Integer, default=0)
    storage_path = Column(Text, nullable=True)
    encrypted = Column(Boolean, default=True)
    status = Column(String(50), default="processed")  # uploaded, processing, processed, error
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="manuscripts")
    chapters = relationship("Chapter", back_populates="manuscript")


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    manuscript_id = Column(String(36), ForeignKey("manuscripts.id", ondelete="SET NULL"), nullable=True)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="chapters")
    manuscript = relationship("Manuscript", back_populates="chapters")
    passages = relationship("Passage", back_populates="chapter", cascade="all, delete-orphan")
    issues = relationship("ContinuityIssue", back_populates="chapter", cascade="all, delete-orphan")


class Passage(Base):
    __tablename__ = "passages"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(String(36), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    passage_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    char_start = Column(Integer, default=0)
    char_end = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    chapter = relationship("Chapter", back_populates="passages")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    entity_type = Column(String(50), nullable=False)  # character, location, object, rule, faction
    description = Column(Text, nullable=True)
    traits = Column(JSON, default=list)  # list of strings
    first_appearance_chapter = Column(Integer, default=1)
    meta_info = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="entities")
    facts = relationship("StoryFact", back_populates="entity", cascade="all, delete-orphan")


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    source_entity_id = Column(String(36), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    target_entity_id = Column(String(36), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String(100), nullable=False)  # allied_with, visited, located_in, opposes
    description = Column(Text, nullable=True)
    source_chapter_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="relationships")
    source_entity = relationship("Entity", foreign_keys=[source_entity_id])
    target_entity = relationship("Entity", foreign_keys=[target_entity_id])


class StoryFact(Base):
    __tablename__ = "story_facts"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    entity_id = Column(String(36), ForeignKey("entities.id", ondelete="CASCADE"), nullable=True)
    fact = Column(Text, nullable=False)
    category = Column(String(50), default="general")  # physical_state, lore_rule, location, status, event
    source_chapter_id = Column(String(36), nullable=True)
    source_chapter_number = Column(Integer, nullable=True)
    source_quote = Column(Text, nullable=False)
    confidence = Column(Float, default=1.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="story_facts")
    entity = relationship("Entity", back_populates="facts")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    chapter_id = Column(String(36), nullable=True)
    chapter_number = Column(Integer, nullable=True)
    chronology_order = Column(Integer, default=0)
    date_or_time_label = Column(String(100), nullable=True)
    participants = Column(JSON, default=list)
    location = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="timeline_events")


class ContinuityIssue(Base):
    __tablename__ = "continuity_issues"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(String(36), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=True)
    issue_type = Column(String(100), nullable=False)  # physical_continuity, lore_rule_violation, location_conflict, death_continuity
    severity = Column(String(50), default="high")  # high, medium, low
    confidence = Column(Float, default=0.90)
    explanation = Column(Text, nullable=False)
    earlier_passage = Column(Text, nullable=True)
    new_passage = Column(Text, nullable=True)
    earlier_chapter_number = Column(Integer, nullable=True)
    new_chapter_number = Column(Integer, nullable=True)
    suggestions = Column(JSON, default=list)  # list of suggested author actions
    status = Column(String(50), default="unresolved")  # unresolved, resolved, intentional, dismissed, review_later
    author_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="continuity_issues")
    chapter = relationship("Chapter", back_populates="issues")
