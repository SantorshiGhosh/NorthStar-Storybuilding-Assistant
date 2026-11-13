# Living Story Bible — AI Continuity Guardian
> **Persistent, evidence-backed narrative memory that protects stories from continuity errors.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB.svg?logo=react)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind_CSS_v4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com)
[![ChromaDB](https://img.shields.io/badge/Vector_Memory-ChromaDB-FF6F00.svg)](https://www.trychroma.com)
[![NetworkX](https://img.shields.io/badge/Graph_Engine-NetworkX-00599C.svg)](https://networkx.org)

---

## 1. Executive Summary & Vision

**Living Story Bible** is a browser-based intelligent writing workspace purpose-built for novelists, screenwriters, and creative narrative architects. While generic AI writing tools focus on generating the next sentence, Living Story Bible focuses on **remembering every sentence previously established as canon**.

As manuscripts expand across dozens of chapters, sequels, or screenplays, writers struggle to track thousands of interlocking facts, character physical states, lore rules, timelines, and relationships. Living Story Bible maintains a tri-part narrative memory (structured SQL canon, semantic ChromaDB passage vectors, and NetworkX relational graphs) to protect authors from continuity contradictions.

### Core Guarantees
1. **Author Sovereignty**: The system **never** modifies or rewrites the writer's manuscript automatically.
2. **Evidence-Backed Warnings**: Every flagged contradiction cites the verbatim earlier passage, the new conflicting passage, and chapter references.
3. **Multi-Agent Narrative Intelligence**: Modular agents coordinated by a Central Orchestrator evaluate physical states, lore laws, death continuity, and timelines.
4. **Confidential Creative Vault**: Uploaded manuscripts are encrypted at rest using authenticated **AES-256-GCM**.

---

## 2. System Architecture

```
                                  +---------------------------------------+
                                  |   React + Vite Frontend (Light UI)    |
                                  |  Dashboard | Workspace | Graph | Audit |
                                  +---------------------------------------+
                                                      |
                                           REST API / JSON (Axios)
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |            FastAPI Backend            |
                                  |  Auth | Projects | Upload | Analyze   |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |         Central AI Orchestrator       |
                                  +---------------------------------------+
                                     /            |            |         \
                                    /             |            |          \
                 +--------------------+ +-------------------+ +-------+ +----------+
                 | Narrative          | | Continuity        | | Char  | | Timeline |
                 | Extraction Agent   | | Guardian Agent    | | Intel | | Agent    |
                 +--------------------+ +-------------------+ +-------+ +----------+
                                    \             |            |          /
                                     \            |            |         /
                                  +---------------------------------------+
                                  |         Narrative Memory Layer        |
                                  +---------------------------------------+
                                    /                 |                 \
                                   /                  |                  \
                                  v                   v                   v
                     +-------------------+  +-------------------+  +-------------------+
                     |  PostgreSQL / DB  |  |     ChromaDB      |  |     NetworkX      |
                     | Structured Canon  |  |  Semantic Passages|  | Interactive Graph |
                     +-------------------+  +-------------------+  +-------------------+
```

---

## 3. Multi-Agent AI System

The architecture incorporates four specialized Python agents coordinated by the **Central AI Orchestrator**:

| Agent | Responsibility | Output / Artifact |
|---|---|---|
| **Central AI Orchestrator** | Coordinates parsing, vault encryption, DB storage, vector indexing, and pipeline scheduling. | Structured Project & Chapter Memory |
| **Narrative Extraction Agent** | Extracts characters, locations, objects, world rules, relationships, and canon facts with verbatim source quotes. | Extracted Canon Schema (Pydantic) |
| **Continuity Guardian Agent** | Cross-references new chapters against established canon facts and semantic vectors; executes hybrid deterministic + contextual evaluation. | Verified Continuity Issues with Citations |
| **Character Intelligence Agent** | Tracks character traits, arcs, relationship evolutions, and stylistic voice drift. | Character Profile & Voice Consistency |
| **Timeline Agent** | Extracts temporal references, arranges events chronologically, and flags chronology conflicts. | Chronological Event Sequence |

---

## 4. Coordinated Narrative Memory

Living Story Bible coordinates three synchronized memory tiers:

1. **Structured Memory (PostgreSQL / SQLite)**:
   - Primary source of truth for projects, manuscripts, chapters, entities, traits, relationships, timeline events, and canon facts.
   - Includes full Supabase Row Level Security (RLS) policies in `database/schema.sql`.
2. **Semantic Memory (ChromaDB)**:
   - Fine-grained chapter passages indexed as semantic vectors with project isolation (`proj_{id}`) and metadata filters.
   - Enables semantic retrieval of relevant earlier story passages.
3. **Graph Memory (NetworkX)**:
   - Constructs directed graphs from database entities and relationships.
   - Computes layout coordinates formatted for interactive visualization in **React Flow**.

---

## 5. Technology Stack

### Frontend
- **React 19** with **Vite**
- **JavaScript (ES Modules)**
- **Tailwind CSS v4** (Minimalist Google Docs & Notion light design)
- **TipTap / ProseMirror** (Rich-text writing editor with live analysis triggers)
- **React Flow** (Interactive knowledge graph with custom node cards, zoom/pan, and slide-over inspector)
- **Lucide React** (Consistent UI iconography)
- **Axios** (REST API client)

### Backend
- **Python 3.11+**
- **FastAPI** (REST API framework with automated OpenAPI / Swagger docs)
- **Pydantic v2** (Request/response schemas and structured LLM output validation)
- **SQLAlchemy 2.0** (ORM supporting PostgreSQL and SQLite)
- **python-docx** (DOCX text extraction)
- **PyMuPDF (fitz)** (PDF text extraction)
- **ChromaDB** (Vector database for passage retrieval)
- **NetworkX** (Graph construction and topological layout)
- **Cryptography** (AES-256-GCM authenticated manuscript encryption)
- **Google GenAI / Gemini API** (AI reasoning with deterministic heuristic fallback)

---

## 6. Installation & Quick Start

### Prerequisites
- **Python 3.11+** installed
- **Node.js 18+** and **npm** installed

### Step 1: Clone & Configure Environment
```bash
git clone <repository-url>
cd "Story Bible"

# Copy environment file
copy .env.example .env
```

### Step 2: Install Backend Dependencies
```bash
pip install -r backend/requirements.txt
```

### Step 3: Install Frontend Dependencies
```bash
cd frontend
npm install --legacy-peer-deps
cd ..
```

### Step 4: Run Application
You can launch both backend and frontend servers simultaneously:

**Windows Command Prompt:**
```cmd
start-dev.bat
```

**Windows PowerShell:**
```powershell
.\start-dev.ps1
```

**Or run manually in separate terminals:**
```bash
# Terminal 1: FastAPI Backend
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload

# Terminal 2: React Vite Frontend
cd frontend
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Interactive Swagger API Docs**: `http://localhost:8000/docs`

---

## 7. Sample Demonstration Walkthrough ("The Last Kingdom")

The repository includes a ready-to-use demonstration manuscript: **The Last Kingdom** (`demo_manuscripts/the_last_kingdom.docx`, `.md`, `.txt`).

### The 4 Chapters
1. **Chapter 1 — The Kingdom**:
   - Introduces **Arin** (Captain of the Royal Guard, master swordsman), **Mira** (Royal Archivist), and the kingdom of **Eldoria**.
2. **Chapter 2 — The Battle**:
   - Arin defends Blackstone fortress against the Shadow Marauders.
   - **Canon Established**: *"Arin lost his left arm during the battle at Blackstone when a jagged shadowblade severed the limb beneath the shoulder."*
   - Mira escapes to the northern forest.
3. **Chapter 3 — The Secret**:
   - Mira deciphers ancient scrolls.
   - **World Rule Established**: *"The ancient gate can only be opened by someone carrying the royal seal."*
4. **Chapter 4 — The Return (Intentional Test Contradictions)**:
   - **Physical Contradiction**: Arin lifts his **left hand** to adjust his gauntlet and grips his sword firmly with **both hands**.
   - **Lore Violation**: The ancient gate opens **without the royal seal**.

### How to Demo
1. Open `http://localhost:5173`.
2. Click **"Load Demo Story"** in the top navigation or on the landing page.
3. Observe:
   - 4 chapters ingested and parsed.
   - 9 canon entities identified and populated into the **Knowledge Graph**.
   - In the **Workspace**, select Chapter 4 and click **"Analyze Chapter"**.
   - The **AI Continuity Guardian** flags:
     1. `[HIGH] physical_continuity`: Arin using left hand vs Chapter 2 amputation.
     2. `[HIGH] lore_rule_violation`: Citadel gate opened without royal seal vs Chapter 3 gate law.
4. Review the earlier and newer verbatim quotes and test author sovereignty controls:
   - Click **"Intentional Twist"** (e.g. Arin received an enchanted prosthetic).
   - Click **"Resolve"** (e.g. author adjusts text to right hand only).

---

## 8. REST API Reference

The backend provides a complete RESTful API mounted at `/api` and documented via OpenAPI Swagger at `http://localhost:8000/docs`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status. |
| `POST` | `/api/projects` | Create a new story bible project. |
| `GET` | `/api/projects` | List all projects with chapter, character, and issue counts. |
| `GET` | `/api/projects/{id}` | Get project details. |
| `DELETE` | `/api/projects/{id}` | Delete project and clean up vectors. |
| `POST` | `/api/projects/{id}/upload` | Upload manuscript (DOCX, TXT, MD, PDF) with vault encryption. |
| `GET` | `/api/projects/{id}/chapters` | List chapters with word counts. |
| `POST` | `/api/projects/{id}/chapters` | Create a new chapter. |
| `GET` | `/api/chapters/{id}` | Read chapter content. |
| `PUT` | `/api/chapters/{id}` | Update chapter text from writing editor. |
| `POST` | `/api/chapters/{id}/analyze` | Trigger live Continuity Guardian analysis on chapter. |
| `GET` | `/api/projects/{id}/entities` | List extracted canon entities with traits and facts. |
| `GET` | `/api/entities/{id}` | Get entity profile with source quotes. |
| `PATCH` | `/api/entities/{id}` | Edit canon entity traits/description. |
| `GET` | `/api/projects/{id}/graph` | React Flow formatted graph nodes and edges. |
| `GET` | `/api/projects/{id}/timeline` | Story timeline events in chronological order. |
| `GET` | `/api/projects/{id}/issues` | List continuity issues with status/severity filters. |
| `PATCH` | `/api/issues/{id}` | Author review actions (Resolve, Intentional, Dismiss, Review Later). |
| `POST` | `/api/seed-demo` | One-click demo seed for "The Last Kingdom". |

---

## 9. Security & Manuscript Privacy

Manuscripts are confidential creative intellectual property. The system implements a defense-in-depth model:

1. **Authenticated Storage Encryption**:
   - Uploaded files are encrypted using **AES-256-GCM** with a random 12-byte initialization vector (nonce) before being saved in vault storage (`storage/private_vault/`).
2. **Project Data Isolation**:
   - Vector collections and database queries are strictly partitioned by `project_id`.
3. **Database Row Level Security (RLS)**:
   - `database/schema.sql` includes production-ready RLS policies for Supabase PostgreSQL enforcing `auth.uid() = user_id`.
4. **Log Sanitization**:
   - No raw manuscript contents or encryption keys are printed to application logs.

---

## 10. Completed Deliverables

- [x] Complete React 19 + Vite frontend with Google Docs / Notion inspired minimalist light workspace.
- [x] Complete FastAPI backend with 15+ verified REST endpoints.
- [x] PostgreSQL & Supabase schema with full RLS policies (`database/schema.sql`).
- [x] Multi-agent AI architecture (Orchestrator, Extraction, Continuity Guardian, Character Intelligence, Timeline).
- [x] Tri-part narrative memory (PostgreSQL, ChromaDB, NetworkX).
- [x] Working continuity detection with side-by-side evidence comparison and author sovereignty controls.
- [x] Interactive knowledge graph using React Flow with zoom, pan, search, filter, and detail inspector.
- [x] Manuscript ingestion supporting DOCX, TXT, MD, and PDF with AES-256-GCM vault storage.
- [x] Original demonstration manuscript **The Last Kingdom** in DOCX, TXT, and MD.
- [x] 100% automated test suite passing across all endpoints (`test_api_endpoints.py`, `test_docx_upload.py`).
