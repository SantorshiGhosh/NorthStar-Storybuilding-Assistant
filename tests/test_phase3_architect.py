import sys
import unittest
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database.connection import SessionLocal, init_db
from app.database import models
from app.routes import architect, projects
from app.schemas import models as s_models
from app.services.memory_service import memory_service

class TestPhase3StoryArchitect(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.db = SessionLocal()
        # Create a test project
        cls.project = models.Project(
            id=models.gen_uuid(),
            name="Architect Test Project",
            description="Testing Story Architect multi-canvas and groups"
        )
        cls.db.add(cls.project)
        cls.db.commit()
        cls.db.refresh(cls.project)

    @classmethod
    def tearDownClass(cls):
        # Cleanup
        cls.db.delete(cls.project)
        cls.db.commit()
        cls.db.close()

    def test_01_create_and_manage_canvases(self):
        # 1. Create Canvas
        c1 = architect.create_canvas(
            project_id=str(self.project.id),
            data=s_models.CanvasCreate(name="Act 1 Canvas", view_type="relationship"),
            db=self.db
        )
        self.assertIsNotNone(c1.id)
        self.assertEqual(c1.name, "Act 1 Canvas")

        # 2. Add an entity to project
        ent = memory_service.save_or_update_entity(
            db=self.db,
            project_id=str(self.project.id),
            name="Aria Vance",
            entity_type="character",
            description="Mysterious protagonist"
        )

        # 3. Save Node Coordinates on Canvas
        res_nodes = architect.update_canvas_node_positions(
            canvas_id=str(c1.id),
            nodes=[s_models.CanvasNodeUpdate(entity_id=str(ent.id), x=150.0, y=220.0)],
            db=self.db
        )
        self.assertEqual(res_nodes["status"], "ok")

        # 4. Verify Canvas Details
        details = architect.get_canvas_details(canvas_id=str(c1.id), db=self.db)
        self.assertEqual(details["name"], "Act 1 Canvas")
        self.assertIn(str(ent.id), details["node_coords"])
        self.assertEqual(details["node_coords"][str(ent.id)]["x"], 150.0)

        # 5. Duplicate Canvas
        dup = architect.duplicate_canvas(canvas_id=str(c1.id), db=self.db)
        self.assertEqual(dup.name, "Act 1 Canvas (Copy)")
        dup_details = architect.get_canvas_details(canvas_id=str(dup.id), db=self.db)
        self.assertIn(str(ent.id), dup_details["node_coords"])

        # 6. Delete Canvas (MUST NOT delete underlying entity!)
        architect.delete_canvas(canvas_id=str(dup.id), db=self.db)
        ent_still_exists = self.db.query(models.Entity).filter(models.Entity.id == ent.id).first()
        self.assertIsNotNone(ent_still_exists, "Deleting canvas must not delete underlying entities!")

    def test_02_nested_groups_and_safe_deletion(self):
        # Create Root Group
        root_grp = architect.create_group(
            project_id=str(self.project.id),
            data=s_models.NarrativeGroupCreate(name="Eldoria Kingdom", group_type="kingdom"),
            db=self.db
        )
        # Create Subgroup
        sub_grp = architect.create_group(
            project_id=str(self.project.id),
            data=s_models.NarrativeGroupCreate(
                name="Citadel Faction",
                group_type="faction",
                parent_group_id=str(root_grp.id)
            ),
            db=self.db
        )
        self.assertEqual(str(sub_grp.parent_group_id), str(root_grp.id))

        # Safe Delete Root Group -> Subgroup must have parent_group_id set to None (promoted to root)
        architect.delete_group(group_id=str(root_grp.id), db=self.db)
        sub_reloaded = self.db.query(models.NarrativeGroup).filter(models.NarrativeGroup.id == sub_grp.id).first()
        self.assertIsNotNone(sub_reloaded)
        self.assertIsNone(sub_reloaded.parent_group_id, "Child group must be reparented safely on group deletion!")

        # Cleanup sub_grp
        architect.delete_group(group_id=str(sub_grp.id), db=self.db)

if __name__ == "__main__":
    unittest.main()
