import sys
import unittest
from pathlib import Path
from fastapi import HTTPException

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database.connection import SessionLocal, init_db
from app.database import models
from app.services.auth_service import auth_service
from app.routes import support
from app.schemas import models as s_models

class TestSupportEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        self.test_email = "author_support_test@example.com"
        u = auth_service.get_user_by_email(self.db, self.test_email)
        if u:
            self.db.delete(u)
            self.db.commit()
        self.user = auth_service.register_user(
            db=self.db,
            email=self.test_email,
            password="StrongPassword123!",
            confirm_password="StrongPassword123!",
            full_name="Jane Test Author"
        )

    def tearDown(self):
        # Cleanup queries and messages
        self.db.query(models.SupportQuery).filter(
            models.SupportQuery.email == self.test_email
        ).delete()
        self.db.query(models.SupportMessage).filter(
            models.SupportMessage.email == self.test_email
        ).delete()
        u = auth_service.get_user_by_email(self.db, self.test_email)
        if u:
            self.db.delete(u)
        self.db.commit()

    def test_submit_contact_form_authenticated(self):
        contact_data = s_models.ContactSupportCreate(
            full_name="Jane Test Author",
            email=self.test_email,
            subject="Question regarding Knowledge Graph",
            category="Technical Issue",
            description="Hello, I would like to inquire about how relationships are indexed in the Story Architect graph."
        )

        res = support.submit_contact_form(
            data=contact_data,
            user=self.user,
            db=self.db
        )

        self.assertEqual(res.status, "success")
        self.assertTrue(res.ticket_id)
        self.assertIn("codebrew@gmail.com", res.message)

        # Verify saved in support_queries table
        saved_query = self.db.query(models.SupportQuery).filter(
            models.SupportQuery.id == res.ticket_id
        ).first()
        self.assertIsNotNone(saved_query)
        self.assertEqual(saved_query.subject, "Question regarding Knowledge Graph")
        self.assertEqual(saved_query.email, self.test_email)
        self.assertEqual(saved_query.category, "Technical Issue")
        self.assertEqual(saved_query.status, "Pending")
        self.assertEqual(saved_query.user_id, str(self.user.id))

    def test_submit_contact_form_guest_visitor(self):
        # Unauthenticated guest submission (user=None)
        guest_email = "guest_visitor_test@example.com"
        contact_data = s_models.ContactSupportCreate(
            full_name="Guest Visitor",
            email=guest_email,
            subject="Pre-registration question",
            category="General Inquiry",
            description="Can I import manuscripts in Markdown format into NorthStar before creating a paid account?"
        )

        res = support.submit_contact_form(
            data=contact_data,
            user=None,
            db=self.db
        )

        self.assertEqual(res.status, "success")
        self.assertTrue(res.ticket_id)
        self.assertIn("codebrew@gmail.com", res.message)

        # Verify saved in database with user_id None and status Pending
        saved_query = self.db.query(models.SupportQuery).filter(
            models.SupportQuery.id == res.ticket_id
        ).first()
        self.assertIsNotNone(saved_query)
        self.assertIsNone(saved_query.user_id)
        self.assertEqual(saved_query.status, "Pending")
        self.assertEqual(saved_query.full_name, "Guest Visitor")

        # Cleanup guest query
        self.db.delete(saved_query)
        self.db.commit()

    def test_contact_form_validation(self):
        # Invalid email format in handler
        invalid_email_data = s_models.ContactSupportCreate(
            full_name="Jane Test Author",
            email="not-an-email",
            subject="Help with account",
            category="Login",
            description="This is a valid length message body for the description."
        )
        with self.assertRaises(HTTPException) as ctx:
            support.submit_contact_form(data=invalid_email_data, user=self.user, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)

        # Too short description (< 10 chars)
        short_desc_data = s_models.ContactSupportCreate(
            full_name="Jane Test Author",
            email=self.test_email,
            subject="Help with account",
            category="Login",
            description="Short"
        )
        with self.assertRaises(HTTPException) as ctx:
            support.submit_contact_form(data=short_desc_data, user=self.user, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_duplicate_submission_prevention(self):
        contact_data = s_models.ContactSupportCreate(
            full_name="Jane Test Author",
            email=self.test_email,
            subject="Duplicate Test Inquiry",
            category="Account",
            description="Testing that rapid duplicate submissions return the original ticket."
        )
        res1 = support.submit_contact_form(data=contact_data, user=self.user, db=self.db)
        res2 = support.submit_contact_form(data=contact_data, user=self.user, db=self.db)

        self.assertEqual(res1.ticket_id, res2.ticket_id)
        self.assertIn("already been recorded", res2.message)

    def test_get_user_support_queries(self):
        contact_data = s_models.ContactSupportCreate(
            full_name="Jane Test Author",
            email=self.test_email,
            subject="History Verification Ticket",
            category="Manuscript Upload",
            description="Detailed inquiry regarding manuscript upload error on docx file."
        )
        res = support.submit_contact_form(data=contact_data, user=self.user, db=self.db)

        queries = support.get_user_support_queries(user=self.user, db=self.db)
        self.assertTrue(len(queries) >= 1)
        self.assertEqual(queries[0].subject, "History Verification Ticket")
        self.assertEqual(queries[0].category, "Manuscript Upload")
        self.assertEqual(queries[0].status, "Pending")

if __name__ == "__main__":
    unittest.main()
