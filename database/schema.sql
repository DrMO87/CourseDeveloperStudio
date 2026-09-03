-- Course Developer Studio — Supabase PostgreSQL Database Schema
-- Multi-Institutional & Multi-Disciplinary: Universities, Academies, Schools, Nurseries & Training Centers

create extension if not exists "uuid-ossp";
create extension if not exists "vector";

create type pipeline_stage as enum ('BRAND_SETUP', 'RECEIPT', 'DIGEST', 'BUNDLE', 'ARTIFACTS');
create type gate_verdict as enum ('PASS', 'FAIL', 'UNVERIFIED');
create type approval_kind as enum ('specialist_council', 'owner_business', 'physical_action_required');
create type asset_class as enum ('REFERENCE', 'EVIDENCE', 'PHYSICAL_EVIDENCE', 'PROCEDURAL_SEQUENCE');
create type institution_type as enum ('university', 'academy', 'school', 'nursery', 'training_center');

create type dossier_file_category as enum (
    'COURSE_SPEC',            -- Syllabus, ILOs, NARS/ABET/NAQAAE accreditation matrices
    'LEGACY_SLIDES',          -- Old lecture decks, previous PowerPoint slides
    'CHEM_MOLECULAR',         -- Chemical structures, reaction pathways, SMILES/InChI, pharmacology mechanisms
    'MATH_EQUATIONS',         -- LaTeX math formulations, differential equations, proofs, statistical models
    'DIAGRAMS_SCHEMATICS',    -- Scientific diagrams, circuits, anatomical illustrations, CAD/flowcharts
    'LAB_CLINICAL_PROTOCOL',  -- Wet lab SOPs, clinical protocols, hardware/OSCE manuals, experiment protocols
    'PEDAGOGY_RUBRIC',        -- Bloom's taxonomy & Miller's pyramid rubrics, assessment matrices
    'CASE_STUDY_BANK',        -- Clinical cases, business scenarios, problem sets, exam question pools
    'REFERENCE_EVIDENCE',     -- Supplementary textbooks, research papers, data tables
    'UNCLASSIFIED'            -- Fresh intake awaiting swarm categorization
);

-- 1. Organizations (Universities, Coding Academies like Techno Square, K-12 Schools, Nurseries, Training Centers)
create table if not exists public.organizations (
    id uuid primary key default uuid_generate_v4(),
    slug text unique not null,
    name text not null,
    institution_type institution_type not null default 'university',
    logo_url text,
    brand_palette jsonb not null default '{"approved": [], "retired": []}',
    language_policy jsonb not null default '{"primary_script": "arabic", "target_ratio": 0.70, "tolerance": 0.10, "secondary_script": "latin"}',
    mascot_config jsonb default '{"character_name": null, "poses": []}',
    boundary_terms jsonb not null default '{"forbidden_strings": []}',
    quality_guidelines jsonb not null default '{"authority_name": "", "core_guidelines": "", "reference_url": ""}',
    asset_citation_pattern text default '\*\*Asset:\*\*\s*`([^`]+)`',
    evidence_marker_pattern text default '\[Reserved Image Area:\s*([^\]]+?)\s*\]',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Course Projects
create table if not exists public.course_projects (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid default auth.uid(),
    organization_id uuid references public.organizations(id) on delete cascade,
    slug text unique not null,
    name text not null,
    target_age_band text,
    levels int[] not null default '{}',
    sessions_per_level int not null default 1,
    obsidian_vault_project_path text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Course Dossier Ingestion Files
create table if not exists public.project_dossier_files (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.course_projects(id) on delete cascade not null,
    file_name text not null,
    file_size_bytes bigint,
    mime_type text,
    category dossier_file_category not null default 'UNCLASSIFIED',
    summary text,
    extracted_metadata jsonb default '{}'::jsonb, -- e.g. formulas detected, LaTeX equations, chemical entities, ILOs
    file_content_text text,                       -- Text/markdown extraction for swarm consumption
    file_url text,                                -- Storage URL if uploaded to Supabase Storage
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Course Sessions
create table if not exists public.course_sessions (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.course_projects(id) on delete cascade not null,
    session_code text not null,
    level int not null,
    session_number int not null,
    title text,
    duration_minutes int,
    produces_artifacts boolean default true,
    current_stage pipeline_stage default 'BRAND_SETUP',
    blueprint_markdown text,
    slides_source_markdown text,
    home_summary_markdown text,
    decisions_markdown text,
    status text default 'draft',
    approval_kind approval_kind default null,
    approval_note text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(project_id, session_code)
);

-- 5. Agent Swarm Trace Logs
create table if not exists public.agent_swarm_logs (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.course_projects(id) on delete cascade not null,
    session_id uuid references public.course_sessions(id) on delete cascade,
    stage_name pipeline_stage not null,
    agent_role text not null,
    agent_thoughts text,
    tool_invocations jsonb default '[]'::jsonb,
    input_payload text,
    output_data text,
    tokens_consumed int default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Quality Receipts
create table if not exists public.quality_receipts (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.course_projects(id) on delete cascade not null,
    session_id uuid references public.course_sessions(id) on delete cascade not null,
    stage_name pipeline_stage not null,
    overall_verdict gate_verdict not null,
    detailed_receipt jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Session Assets
create table if not exists public.session_assets (
    id uuid primary key default uuid_generate_v4(),
    session_id uuid references public.course_sessions(id) on delete cascade not null,
    asset_id text not null,
    destination_slide text not null,
    asset_class asset_class not null default 'REFERENCE',
    file_path text not null,
    sha256 text,
    production_status text not null default 'Produced and mapped',
    is_overlaid boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Obsidian Second Brain Sync Records
create table if not exists public.obsidian_sync_records (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.course_projects(id) on delete cascade not null,
    session_id uuid references public.course_sessions(id) on delete set null,
    vault_relative_path text not null,
    para_category text not null,
    file_hash text,
    sync_status text default 'SYNCED',
    last_synced_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Quality Gate Definitions
create table if not exists public.quality_gate_definitions (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid references public.organizations(id) on delete cascade not null,
    gate_code text not null,
    display_name text not null,
    is_enabled boolean default true,
    gate_config jsonb default '{}',
    sort_order int default 0,
    created_at timestamptz default now(),
    unique(organization_id, gate_code)
);

-- 10. Quality Gate Results
create table if not exists public.quality_gate_results (
    id uuid primary key default uuid_generate_v4(),
    receipt_id uuid references public.quality_receipts(id) on delete cascade not null,
    gate_code text not null,
    verdict gate_verdict not null,
    metric_value numeric(6,4),
    detail text,
    evidence jsonb default '{}',
    created_at timestamptz default now(),
    unique(receipt_id, gate_code)
);

-- 11. RLS Policies
alter table public.organizations enable row level security;
alter table public.course_projects enable row level security;
alter table public.project_dossier_files enable row level security;
alter table public.course_sessions enable row level security;
alter table public.agent_swarm_logs enable row level security;
alter table public.quality_receipts enable row level security;
alter table public.session_assets enable row level security;
alter table public.obsidian_sync_records enable row level security;
alter table public.quality_gate_definitions enable row level security;
alter table public.quality_gate_results enable row level security;

-- Policies
create policy "Authenticated users can read all organizations" on public.organizations for select to authenticated using (true);
create policy "Authenticated users can insert organizations" on public.organizations for insert to authenticated with check (true);
create policy "Authenticated users can update organizations" on public.organizations for update to authenticated using (true);

create policy "Users can CRUD their own projects" on public.course_projects for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can CRUD dossier files via project ownership" on public.project_dossier_files for all to authenticated using (
    project_id in (select id from public.course_projects where user_id = auth.uid())
) with check (
    project_id in (select id from public.course_projects where user_id = auth.uid())
);

create policy "Users can CRUD sessions via project ownership" on public.course_sessions for all to authenticated using (
    project_id in (select id from public.course_projects where user_id = auth.uid())
) with check (
    project_id in (select id from public.course_projects where user_id = auth.uid())
);

create policy "Users can CRUD swarm logs via project ownership" on public.agent_swarm_logs for all to authenticated using (
    project_id in (select id from public.course_projects where user_id = auth.uid())
) with check (
    project_id in (select id from public.course_projects where user_id = auth.uid())
);

create policy "Users can CRUD receipts via project ownership" on public.quality_receipts for all to authenticated using (
    project_id in (select id from public.course_projects where user_id = auth.uid())
) with check (
    project_id in (select id from public.course_projects where user_id = auth.uid())
);

create policy "Users can CRUD assets via session/project ownership" on public.session_assets for all to authenticated using (
    session_id in (select cs.id from public.course_sessions cs join public.course_projects cp on cs.project_id = cp.id where cp.user_id = auth.uid())
) with check (
    session_id in (select cs.id from public.course_sessions cs join public.course_projects cp on cs.project_id = cp.id where cp.user_id = auth.uid())
);

create policy "Users can CRUD sync records via project ownership" on public.obsidian_sync_records for all to authenticated using (
    project_id in (select id from public.course_projects where user_id = auth.uid())
) with check (
    project_id in (select id from public.course_projects where user_id = auth.uid())
);

create policy "Users can read all gate definitions" on public.quality_gate_definitions for select to authenticated using (true);
create policy "Users can insert gate definitions" on public.quality_gate_definitions for insert to authenticated with check (true);
create policy "Users can update gate definitions" on public.quality_gate_definitions for update to authenticated using (true);

create policy "Users can CRUD gate results via receipt/project ownership" on public.quality_gate_results for all to authenticated using (
    receipt_id in (select qr.id from public.quality_receipts qr join public.course_projects cp on qr.project_id = cp.id where cp.user_id = auth.uid())
) with check (
    receipt_id in (select qr.id from public.quality_receipts qr join public.course_projects cp on qr.project_id = cp.id where cp.user_id = auth.uid())
);
