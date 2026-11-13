import sys
sys.path.insert(0, 'backend')
from app.main import app, seed_demo_manuscript
from app.database.connection import SessionLocal
from app.database import models

db = SessionLocal()
res = seed_demo_manuscript(db)
print('Seed response:', res)

# Verify chapters
chaps = db.query(models.Chapter).all()
print(f'Chapters count: {len(chaps)}')
for c in chaps:
    print(f'  Ch {c.chapter_number}: {c.title} ({c.word_count} words)')

# Verify entities
ents = db.query(models.Entity).all()
print(f'Entities count: {len(ents)}')
for e in ents:
    print(f'  {e.entity_type.upper()}: {e.name} - {len(e.facts)} facts, traits: {e.traits}')

# Verify issues
issues = db.query(models.ContinuityIssue).all()
print(f'Continuity Issues count: {len(issues)}')
for iss in issues:
    print(f'  [{iss.severity.upper()}] {iss.issue_type} (Ch {iss.new_chapter_number}): {iss.explanation}')
    print(f'    Earlier passage (Ch {iss.earlier_chapter_number}): "{iss.earlier_passage}"')
    print(f'    New passage: "{iss.new_passage}"')
    print(f'    Suggestions: {iss.suggestions}')
