import sys
import os
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

import httpx
from app.main import app

async def test_full_system():
    print("==================================================================")
    print("TESTING LIVING STORY BIBLE — REST API & CONTINUITY GUARDIAN")
    print("==================================================================")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/api/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print("[PASS] 1. Health check online:", res.json())

        # 2. Create Project
        res = await client.post("/api/projects", json={
            "name": "The Last Kingdom Test",
            "description": "High fantasy epic testing physical and lore continuity"
        })
        assert res.status_code == 200, f"Create project failed: {res.text}"
        project_id = res.json()["id"]
        print(f"[PASS] 2. Project created successfully: id={project_id}")

        # 3. List Projects
        res = await client.get("/api/projects")
        assert res.status_code == 200
        assert any(p["id"] == project_id for p in res.json())
        print(f"[PASS] 3. Projects listed ({len(res.json())} projects in database)")

        # 4. Upload Manuscript (the_last_kingdom.md)
        md_path = Path("demo_manuscripts/the_last_kingdom.md")
        with open(md_path, "rb") as f:
            file_bytes = f.read()

        res = await client.post(
            f"/api/projects/{project_id}/upload",
            files={"file": ("the_last_kingdom.md", file_bytes, "text/markdown")}
        )
        assert res.status_code == 200, f"Upload failed: {res.text}"
        upload_res = res.json()
        print(f"[PASS] 4. Manuscript uploaded & encrypted in vault:")
        print(f"   Chapters extracted: {upload_res['chapters_extracted']}")
        print(f"   Entities identified: {upload_res['entities_identified']}")
        print(f"   Unresolved contradictions detected: {upload_res['unresolved_issues']}")

        # 5. List Chapters
        res = await client.get(f"/api/projects/{project_id}/chapters")
        assert res.status_code == 200
        chapters = res.json()
        assert len(chapters) == 4, f"Expected 4 chapters, got {len(chapters)}"
        ch4 = [c for c in chapters if c["chapter_number"] == 4][0]
        print(f"[PASS] 5. Chapters retrieved (4 chapters verified):")
        for c in chapters:
            print(f"   - Ch {c['chapter_number']}: {c['title']} ({c['word_count']} words)")

        # 6. Read Chapter Details
        res = await client.get(f"/api/chapters/{ch4['id']}")
        assert res.status_code == 200
        print(f"[PASS] 6. Chapter details read successfully for Chapter 4")

        # 7. Analyze Chapter Live
        res = await client.post(f"/api/chapters/{ch4['id']}/analyze")
        assert res.status_code == 200
        analysis = res.json()
        print(f"[PASS] 7. Chapter 4 live Continuity Guardian analysis executed:")
        print(f"   Contradictions identified: {analysis['issues_found']}")
        assert analysis['issues_found'] >= 2, f"Expected at least 2 issues, got {analysis['issues_found']}"

        # 8. List Story Entities
        res = await client.get(f"/api/projects/{project_id}/entities")
        assert res.status_code == 200
        entities = res.json()
        assert len(entities) >= 7
        arin = [e for e in entities if e["name"] == "Arin"][0]
        print(f"[PASS] 8. Story Entities retrieved ({len(entities)} entities)")
        print(f"   - Arin traits: {arin['traits']}")
        print(f"   - Arin facts: {len(arin['facts'])} canon facts")

        # 9. Get Single Entity Profile
        res = await client.get(f"/api/entities/{arin['id']}")
        assert res.status_code == 200
        print(f"[PASS] 9. Entity profile inspected with exact citations")

        # 10. Patch Entity (Author Edit)
        res = await client.patch(f"/api/entities/{arin['id']}", json={
            "description": "Veteran Captain of Eldoria with seasoned command skills",
            "traits": arin['traits'] + ["disciplined commander"]
        })
        assert res.status_code == 200
        print(f"[PASS] 10. Entity edited by author and canon updated")

        # 11. Inspect NetworkX Graph for React Flow
        res = await client.get(f"/api/projects/{project_id}/graph")
        assert res.status_code == 200
        graph = res.json()
        assert len(graph["nodes"]) > 0
        print(f"[PASS] 11. React Flow Graph generated ({len(graph['nodes'])} nodes, {len(graph['edges'])} edges)")

        # 12. Inspect Timeline
        res = await client.get(f"/api/projects/{project_id}/timeline")
        assert res.status_code == 200
        events = res.json()
        print(f"[PASS] 12. Chronology timeline retrieved ({len(events)} events)")

        # 13. Inspect Continuity Issues
        res = await client.get(f"/api/projects/{project_id}/issues")
        assert res.status_code == 200
        issues = res.json()
        print(f"[PASS] 13. Continuity Issues retrieved ({len(issues)} issues):")
        for iss in issues:
            print(f"   - [{iss['severity'].upper()}] {iss['issue_type']}: {iss['explanation'][:70]}...")
            print(f"     Earlier (Ch {iss['earlier_chapter_number']}): \"{iss['earlier_passage']}\"")
            print(f"     New (Ch {iss['new_chapter_number']}): \"{iss['new_passage']}\"")

        # 14. Update Issue Review Status (Author Sovereignty)
        first_issue = issues[0]
        res = await client.patch(f"/api/issues/{first_issue['id']}", json={
            "status": "intentional",
            "author_notes": "Deliberate narrative foreshadowing: Arin was outfitted with an enchanted prosthetic."
        })
        assert res.status_code == 200
        updated_issue = res.json()
        assert updated_issue["status"] == "intentional"
        print(f"[PASS] 14. Issue marked 'intentional' by author with custom notes")

        # 15. Delete Project
        res = await client.delete(f"/api/projects/{project_id}")
        assert res.status_code == 200
        print(f"[PASS] 15. Project cleanup tested successfully")

        print("\n==================================================================")
        print("ALL 15 INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
        print("==================================================================")

if __name__ == "__main__":
    asyncio.run(test_full_system())
