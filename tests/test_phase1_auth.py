import sys
import unittest
from pathlib import Path
from fastapi import Response, HTTPException

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database.connection import SessionLocal, init_db
from app.database import models
from app.services.auth_service import auth_service
from app.routes import auth, projects
from app.schemas import models as s_models

class TestPhase1AuthAndIsolation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        # Clean up test accounts if present
        self.email_a = "user_a@test.com"
        self.email_b = "user_b@test.com"
        for email in [self.email_a, self.email_b, "bad_email"]:
            u = auth_service.get_user_by_email(self.db, email)
            if u:
                self.db.delete(u)
        self.db.commit()

    def tearDown(self):
        for email in [self.email_a, self.email_b]:
            u = auth_service.get_user_by_email(self.db, email)
            if u:
                self.db.delete(u)
        self.db.commit()

    def test_01_password_hashing(self):
        plain = "SuperSecretPassword123"
        hashed = auth_service.hash_password(plain)
        self.assertNotEqual(plain, hashed)
        self.assertTrue(auth_service.verify_password(plain, hashed))
        self.assertFalse(auth_service.verify_password("WrongPassword", hashed))

    def test_02_registration_validation(self):
        # Invalid email
        with self.assertRaises(ValueError):
            auth_service.register_user(self.db, "invalid-email", "password123")

        # Short password
        with self.assertRaises(ValueError):
            auth_service.register_user(self.db, "valid@email.com", "123")

        # Password mismatch
        with self.assertRaises(ValueError):
            auth_service.register_user(self.db, "valid@email.com", "pass123", confirm_password="diff")

        # Valid registration
        user = auth_service.register_user(
            self.db,
            self.email_a,
            "ValidPassword123",
            confirm_password="ValidPassword123",
            full_name="User Alpha"
        )
        self.assertIsNotNone(user.id)
        self.assertEqual(user.email, self.email_a)
        self.assertNotEqual(user.hashed_password, "ValidPassword123")

        # Duplicate email
        with self.assertRaises(ValueError):
            auth_service.register_user(self.db, self.email_a, "ValidPassword123")

    def test_03_login_and_token_flow(self):
        user = auth_service.register_user(self.db, self.email_a, "Password123")
        
        # Wrong password
        auth_failed = auth_service.authenticate_user(self.db, self.email_a, "WrongPass")
        self.assertIsNone(auth_failed)

        # Successful auth
        auth_ok = auth_service.authenticate_user(self.db, self.email_a, "Password123")
        self.assertIsNotNone(auth_ok)
        self.assertEqual(auth_ok.id, user.id)

        # Token creation and verification
        token = auth_service.create_access_token({"sub": str(user.id), "email": user.email})
        self.assertIsInstance(token, str)
        payload = auth_service.decode_access_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["sub"], str(user.id))

    def test_04_user_project_isolation(self):
        # Register User A and User B
        user_a = auth_service.register_user(self.db, self.email_a, "PassA123", full_name="User A")
        user_b = auth_service.register_user(self.db, self.email_b, "PassB123", full_name="User B")

        # User A creates a private project
        proj_a = projects.create_project(
            data=s_models.ProjectCreate(name="Project Alpha", description="User A confidential manuscript"),
            current_user=user_a,
            db=self.db
        )
        self.assertEqual(proj_a.user_id, str(user_a.id))

        # User B creates a private project
        proj_b = projects.create_project(
            data=s_models.ProjectCreate(name="Project Beta", description="User B confidential manuscript"),
            current_user=user_b,
            db=self.db
        )
        self.assertEqual(proj_b.user_id, str(user_b.id))

        # User A listing projects: MUST see Project Alpha, MUST NOT see Project Beta
        list_a = projects.list_projects(current_user=user_a, db=self.db)
        a_project_ids = [str(p.id) for p in list_a]
        self.assertIn(str(proj_a.id), a_project_ids)
        self.assertNotIn(str(proj_b.id), a_project_ids)

        # User B listing projects: MUST see Project Beta, MUST NOT see Project Alpha
        list_b = projects.list_projects(current_user=user_b, db=self.db)
        b_project_ids = [str(p.id) for p in list_b]
        self.assertIn(str(proj_b.id), b_project_ids)
        self.assertNotIn(str(proj_a.id), b_project_ids)

        # User A attempts direct access to User B's project: MUST raise 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            projects.get_project(project_id=str(proj_b.id), current_user=user_a, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # User B attempts direct deletion of User A's project: MUST raise 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            projects.delete_project(project_id=str(proj_a.id), current_user=user_b, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # User A can delete their own project
        res_del = projects.delete_project(project_id=str(proj_a.id), current_user=user_a, db=self.db)
        self.assertEqual(res_del["status"], "deleted")

        # Cleanup Project Beta
        projects.delete_project(project_id=str(proj_b.id), current_user=user_b, db=self.db)

if __name__ == "__main__":
    unittest.main()
