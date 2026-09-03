# Course Developer Studio (.NET 9 + Next.js 15 + Supabase + Obsidian Second Brain)

**Course Developer Studio** is an enterprise-grade, autonomous curriculum engineering platform designed for **Academies, K-12 Schools, and Universities**. It automates the end-to-end design, verification, generation, and synchronization of bilingual curriculum with deterministic quality gates and interactive business rule management.

---

## 1. Architectural Highlights

- **Backend**: C# (.NET 9 Web API) providing deterministic gate verification, hierarchical agent orchestration (Ruflo / MCP pattern), Npgsql Supabase repository layer, and Obsidian file system synchronization.
- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind CSS with live multi-tenant switchers, interactive rules studio, and PARA file browsing.
- **Database**: Supabase PostgreSQL with Row Level Security (RLS), multi-agent logs, and quality receipts.
- **Obsidian Second Brain**: Bidirectional synchronization with local Obsidian vault using the **PARA Method** (`01_Projects`, `02_Areas`, `03_Resources`, `04_Archive`).
- **Configurable Deterministic Quality Gates**:
  1. **Language & Script Balance**: Validates primary/secondary script ratios (e.g. 70% Arabic / 30% English or custom pairs) using Unicode frequency analysis.
  2. **Lecturer Boundary**: Asserts zero lecturer-only notes/scripts leak into student slides.
  3. **Brand Palette**: Rejects retired hex colors and enforces approved brand colors.
  4. **Asset Reconciliation**: Proves that every referenced asset resolves on disk prior to generation.
- **Two-Asset-Class Law**:
  - `REFERENCE`: Visual references redrawn/placed by the presentation engine.
  - `EVIDENCE`: Real code screenshots and wiring diagrams composited into reserved bounding boxes (`[Reserved Image Area: ...]`).

---

## 2. Directory Structure

```
CourseDeveloperStudio/
├── start.bat                             # One-Click App Startup Launcher
├── backend/                              # .NET 9 Web API Engine
│   ├── src/
│   │   ├── CourseDeveloper.Core/         # Domain Models, Enums, Interfaces
│   │   ├── CourseDeveloper.Infrastructure/# Supabase Repositories, Obsidian Sync, Swarms, Gates
│   │   └── CourseDeveloper.Api/          # Web API Controllers, SignalR Hubs, Swagger
│   └── tests/
│       └── CourseDeveloper.UnitTests/    # xUnit Parameterized Gate Tests
│
├── frontend/                             # Next.js 15 + React 19 Frontend
│   ├── src/
│   │   ├── app/                          # App Router (Studio, Institutions, Projects)
│   │   ├── components/                   # Swarms, Badges, PARA Browser, Settings Editors
│   │   └── lib/                          # Supabase Client & Domain Types
│   └── package.json
│
├── database/
│   └── schema.sql                        # Supabase PostgreSQL schema with RLS & Tables
│
└── obsidian-vault-template/              # PARA Method Second Brain Vault
    ├── 01_Projects/                      # Generated course session bundles
    ├── 02_Areas/                         # Branding rules, mascot usage guides
    ├── 03_Resources/                     # Hardware catalogs, pedagogy rubrics
    └── 04_Archive/                       # Legacy courses & retired notes
```

---

## 3. Quick Start (One-Click)

Simply double-click:
```bat
start.bat
```
This will automatically launch the .NET 9 Backend Web API, the Next.js 15 Frontend, and open `http://localhost:3000` in your browser.

---

## 4. Manual Startup

### Backend (.NET 9)
```bash
cd backend/src/CourseDeveloper.Api
dotnet run
```
API endpoints will be available with interactive Swagger at `http://localhost:5000/swagger`.

### Frontend (Next.js 15)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to view the Course Developer Studio Dashboard.

### Database (Supabase)
Run `database/schema.sql` in your Supabase SQL Editor to initialize all tables, types, and RLS policies.

