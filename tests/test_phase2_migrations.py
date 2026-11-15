import sys
import unittest
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database.connection import SessionLocal, init_db, engine
from app.database.migrations import migration_manager
from sqlalchemy import inspect

class TestPhase2Migrations(unittest.TestCase):
    def test_01_all_tables_exist(self):
        init_db()
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        
        expected_tables = [
            "users", "project_members", "projects", "manuscripts", "chapters",
            "passages", "entity_categories", "entities", "relationships",
            "story_facts", "timeline_events", "continuity_issues", "canvases",
            "canvas_nodes", "narrative_groups", "group_memberships",
            "entity_attachments", "entity_attachment_links", "audit_logs",
            "project_snapshots", "project_roles", "sensitive_approvals",
            "entity_matching_candidates", "schema_migrations"
        ]
        
        for t in expected_tables:
            self.assertIn(t, tables, f"Expected table '{t}' not found in database.")

    def test_02_migrations_recorded(self):
        applied = migration_manager.get_applied_versions()
        self.assertIn("001_core_architecture", applied)
        self.assertIn("002_story_architect_extensions", applied)
        self.assertIn("003_auth_and_isolation", applied)

    def test_03_critical_columns_exist(self):
        inspector = inspect(engine)
        p_cols = {c["name"] for c in inspector.get_columns("projects")}
        self.assertIn("is_demo", p_cols)
        self.assertIn("user_id", p_cols)

        e_cols = {c["name"] for c in inspector.get_columns("entities")}
        self.assertIn("canon_status", e_cols)
        self.assertIn("protection_level", e_cols)
        self.assertIn("custom_properties", e_cols)

if __name__ == "__main__":
    unittest.main()
