import os
import sys
import unittest
import io
import hashlib
from starlette.datastructures import UploadFile as StarletteUploadFile

# Ensure backend is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "backend"))

from app.config import settings
from app.database.connection import SessionLocal
from app.database import models
from app.services.auth_service import auth_service
from app.services.encryption_service import encryption_service
from app.routes import architect, entities, projects


class TestPhase4EntitiesAndAttachments(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        # Seed test user
        cls.user_email = "vault_tester@example.com"
        cls.user = cls.db.query(models.User).filter(models.User.email == cls.user_email).first()
        if not cls.user:
            cls.user = auth_service.register_user(cls.db, cls.user_email, "VaultSecret123!")

        # Create test project
        cls.project = models.Project(
            id=models.gen_uuid(),
            user_id=cls.user.id,
            name="Vault & Entity Test Universe",
            description="Testing Phase 4 attachments and entity profiles"
        )
        cls.db.add(cls.project)
        cls.db.commit()
        cls.db.refresh(cls.project)

    @classmethod
    def tearDownClass(cls):
        # Clean up test project attachments and entities
        cls.db.query(models.EntityAttachmentLink).filter().delete()
        cls.db.query(models.EntityAttachment).filter(models.EntityAttachment.project_id == cls.project.id).delete()
        cls.db.query(models.Relationship).filter(models.Relationship.project_id == cls.project.id).delete()
        cls.db.query(models.Entity).filter(models.Entity.project_id == cls.project.id).delete()
        cls.db.query(models.Project).filter(models.Project.id == cls.project.id).delete()
        cls.db.commit()
        cls.db.close()

    def test_01_attachment_upload_and_aes_encryption(self):
        """Test file upload, AES-256-GCM encryption, integrity check, preview, and download"""
        import asyncio

        test_bytes = b"TOP SECRET: Ancient Blueprint of the Citadel of Valoria with Sacred Runes."
        test_sha = hashlib.sha256(test_bytes).hexdigest()

        file_obj = io.BytesIO(test_bytes)
        upload_file = StarletteUploadFile(file=file_obj, filename="citadel_blueprint.png", headers={"content-type": "image/png"})

        # Upload via route handler
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        created_list = loop.run_until_complete(
            architect.upload_attachment_files(
                project_id=str(self.project.id),
                files=[upload_file],
                description="Rare blueprint of the southern gates",
                tags="blueprint, citadel, lore",
                db=self.db
            )
        )
        loop.close()

        self.assertEqual(len(created_list), 1)
        att = created_list[0]
        self.assertEqual(att.filename, "citadel_blueprint.png")
        self.assertEqual(att.file_type, "image")
        self.assertEqual(att.file_size, len(test_bytes))
        self.assertIn("blueprint", att.tags)

        # Verify on-disk file is encrypted and does NOT contain raw plaintext
        self.assertTrue(os.path.exists(att.storage_path))
        with open(att.storage_path, "rb") as f:
            raw_disk_bytes = f.read()
        self.assertNotIn(test_bytes, raw_disk_bytes)
        self.assertNotIn(b"Citadel of Valoria", raw_disk_bytes)

        # Verify preview response decrypts back to exact original content
        preview_resp = architect.preview_attachment(attachment_id=str(att.id), db=self.db)
        self.assertEqual(preview_resp.body, test_bytes)
        self.assertEqual(preview_resp.media_type, "image/png")

        # Verify download response decrypts and performs SHA-256 integrity check
        download_resp = architect.download_attachment(attachment_id=str(att.id), db=self.db)
        self.assertEqual(download_resp.body, test_bytes)
        self.assertEqual(hashlib.sha256(download_resp.body).hexdigest(), test_sha)

    def test_02_attachment_quota_calculation(self):
        """Test project vault storage quota calculation"""
        quota_data = architect.get_attachment_quota(project_id=str(self.project.id), db=self.db)
        self.assertEqual(quota_data["project_id"], str(self.project.id))
        self.assertGreaterEqual(quota_data["total_files"], 1)
        self.assertGreaterEqual(quota_data["used_bytes"], 10)
        self.assertGreater(quota_data["quota_bytes"], 0)
        self.assertIn("image", quota_data["by_type"])
        self.assertGreaterEqual(quota_data["by_type"]["image"]["count"], 1)

    def test_03_entity_attachment_linking_and_unlinking(self):
        """Test non-destructive linking and unlinking of vault attachments to entities"""
        # Create an entity
        ent = models.Entity(
            id=models.gen_uuid(),
            project_id=self.project.id,
            name="Lord Commander Vane",
            entity_type="Character",
            description="Keeper of the Citadel",
            canon_status="established"
        )
        self.db.add(ent)
        self.db.commit()

        # Get existing attachment
        att = self.db.query(models.EntityAttachment).filter(
            models.EntityAttachment.project_id == self.project.id
        ).first()
        self.assertIsNotNone(att)

        # Link attachment to entity
        link_res = architect.link_entity_attachment(
            entity_id=str(ent.id),
            attachment_id=str(att.id),
            role="equipment_ref",
            db=self.db
        )
        self.assertEqual(link_res["status"], "linked")

        # Verify entity appears in list_attachments
        att_list = architect.list_attachments(project_id=str(self.project.id), entity_id=str(ent.id), db=self.db)
        self.assertEqual(len(att_list), 1)
        self.assertEqual(att_list[0].id, str(att.id))

        # Unlink from entity
        unlink_res = architect.unlink_entity_attachment(
            entity_id=str(ent.id),
            attachment_id=str(att.id),
            db=self.db
        )
        self.assertEqual(unlink_res["status"], "unlinked")

        # Verify attachment still exists in the vault!
        vault_atts = architect.list_attachments(project_id=str(self.project.id), db=self.db)
        self.assertTrue(any(a.id == str(att.id) for a in vault_atts))
        self.assertTrue(os.path.exists(att.storage_path))

    def test_04_dynamic_custom_properties_and_inheritance(self):
        """Test dynamic custom properties, hierarchical parent inheritance and override"""
        # 1. Create parent entity (e.g. Realm / Location)
        parent_loc = models.Entity(
            id=models.gen_uuid(),
            project_id=self.project.id,
            name="Kingdom of Valoria",
            entity_type="Location",
            description="The high sun kingdom",
            custom_properties={
                "Climate": "Temperate Mediterranean",
                "Ruling Dynasty": "Solaris",
                "Magic Level": "High",
                "_meta": {
                    "sections": ["Environment", "Politics"]
                }
            }
        )
        self.db.add(parent_loc)
        self.db.commit()

        # 2. Create child entity (e.g. Sub-location) with its own properties and parent pointer
        child_loc = models.Entity(
            id=models.gen_uuid(),
            project_id=self.project.id,
            name="Valoria Sunspire Fortress",
            entity_type="Location",
            description="Citadel outpost of Valoria",
            custom_properties={
                "Garrison Size": 1200,
                "Climate": "Sub-tropical Alpine",  # Overrides parent's Climate
                "_parent_id": str(parent_loc.id),
                "_meta": {
                    "parentId": str(parent_loc.id),
                    "sections": ["Fortifications"]
                }
            }
        )
        self.db.add(child_loc)
        self.db.commit()

        # 3. Call resolved properties endpoint
        resolved = entities.get_resolved_entity_properties(entity_id=str(child_loc.id), db=self.db)

        self.assertEqual(resolved["entity_name"], "Valoria Sunspire Fortress")
        self.assertEqual(resolved["parent_name"], "Kingdom of Valoria")

        # Verify inherited properties contains non-meta parent attributes
        self.assertIn("Ruling Dynasty", resolved["inherited_properties"])
        self.assertEqual(resolved["inherited_properties"]["Ruling Dynasty"], "Solaris")
        self.assertIn("Magic Level", resolved["inherited_properties"])
        self.assertEqual(resolved["inherited_properties"]["Magic Level"], "High")

        # Verify child override takes precedence in merged properties
        self.assertEqual(resolved["merged_properties"]["Climate"], "Sub-tropical Alpine")
        self.assertEqual(resolved["merged_properties"]["Garrison Size"], 1200)
        self.assertEqual(resolved["merged_properties"]["Ruling Dynasty"], "Solaris")


if __name__ == "__main__":
    unittest.main()
