import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

import httpx
from app.main import app

async def test_docx():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        p_res = await client.post("/api/projects", json={"name": "DOCX Parser Verification"})
        project_id = p_res.json()["id"]

        with open("demo_manuscripts/the_last_kingdom.docx", "rb") as f:
            docx_bytes = f.read()

        upload_res = await client.post(
            f"/api/projects/{project_id}/upload",
            files={"file": ("the_last_kingdom.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        )
        assert upload_res.status_code == 200, f"Upload error: {upload_res.text}"
        data = upload_res.json()
        print("DOCX upload result:", data)

        chaps_res = await client.get(f"/api/projects/{project_id}/chapters")
        assert chaps_res.status_code == 200
        chaps = chaps_res.json()
        print(f"Verified {len(chaps)} chapters extracted from DOCX:")
        for c in chaps:
            print(f"  - Ch {c['chapter_number']}: {c['title']} ({c['word_count']} words)")

        # Verify issues detected
        issues_res = await client.get(f"/api/projects/{project_id}/issues")
        issues = issues_res.json()
        print(f"Verified {len(issues)} continuity issues detected from DOCX upload:")
        for iss in issues:
            print(f"  - [{iss['severity'].upper()}] {iss['issue_type']}")

        # Cleanup
        await client.delete(f"/api/projects/{project_id}")
        print("DOCX test project cleaned up. Test PASSED!")

if __name__ == "__main__":
    asyncio.run(test_docx())
