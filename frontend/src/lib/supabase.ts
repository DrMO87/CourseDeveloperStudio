import { createClient } from '@supabase/supabase-js';
import type {
  Organization,
  CourseProject,
  CourseSession,
  AgentLog,
  QualityReceipt,
  QualityGateDefinition,
  QualityGateResult,
  PipelineStage,
  ProjectDossierFile,
  DossierFileCategory,
  InstitutionType
} from './types';
import { api } from './apiClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gjxhfyfonjdcaimxjipp.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key';

// STEP 7: kept only for authentication (apiClient.ts reads its session token) and for
// DEFAULT_INSTITUTION_TEMPLATES, an editable starting point offered in the "create
// organization" UI — not a read-time fallback. Organizations/projects/sessions/gates no
// longer read or write through this client; see apiClient.ts for the real data path.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Built-in Archetype Templates ──

export const DEFAULT_INSTITUTION_TEMPLATES: Organization[] = [
  {
    id: 'org-template-hue',
    name: 'Horus University — Egypt (Faculty of Pharmacy)',
    slug: 'horus-university-egypt',
    institution_type: 'university',
    brand_palette: { approved: ['#002147', '#FFB81C', '#1929B5', '#0F766E'], retired: ['#FF0000', '#990000'] },
    language_policy: { primary_script: 'latin', target_ratio: 1.0, tolerance: 0.0, secondary_script: 'arabic' },
    boundary_terms: { forbidden_strings: ['lecturer note', 'model answer', 'ملاحظة للمحاضر', 'instructor script'] },
    mascot_config: { character_name: null, poses: [] },
    quality_guidelines: { authority_name: 'NQAAA', core_guidelines: 'National Authority for Quality Assurance and Accreditation of Education guidelines.', reference_url: 'https://naqaae.eg' },
    asset_citation_pattern: '\\*\\*Asset:\\*\\*\\s*`([^`]+)`',
    evidence_marker_pattern: '\\[Reserved Image Area:\\s*([^\\]]+?)\\s*\\]',
    created_at: new Date('2026-01-01').toISOString()
  },
  {
    id: 'org-template-technosquare',
    name: 'Techno Square STEM Academy',
    slug: 'techno-square',
    institution_type: 'academy',
    brand_palette: { approved: ['#231F20', '#FFED10', '#585858', '#FFFFFF'], retired: ['#F5B301'] },
    language_policy: { primary_script: 'arabic', target_ratio: 0.70, tolerance: 0.10, secondary_script: 'latin' },
    boundary_terms: { forbidden_strings: ['lecturer note', 'lecturer script', 'ملاحظة للمحاضر', 'إجابة متوقعة'] },
    mascot_config: { character_name: 'Tata', poses: [{ pose_name: 'curious', asset_file: 'tata-curious.png', slide_context: 'Hands-on Build Challenge' }] },
    quality_guidelines: { authority_name: 'STEM Accreditation', core_guidelines: 'Emphasize hands-on projects, engineering design process, and 21st-century skills.', reference_url: '' },
    asset_citation_pattern: '\\*\\*Asset:\\*\\*\\s*`([^`]+)`',
    evidence_marker_pattern: '\\[Reserved Image Area:\\s*([^\\]]+?)\\s*\\]',
    created_at: new Date('2026-01-02').toISOString()
  },
  {
    id: 'org-template-nursery',
    name: 'Little Explorers Nursery & KG',
    slug: 'little-explorers-kg',
    institution_type: 'nursery',
    brand_palette: { approved: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C'], retired: ['#000000'] },
    language_policy: { primary_script: 'arabic', target_ratio: 0.95, tolerance: 0.05, secondary_script: 'latin' },
    boundary_terms: { forbidden_strings: ['teacher note', 'parent guide', 'grading sheet', 'ملاحظة للمربية'] },
    mascot_config: { character_name: 'Mimi the Owl', poses: [{ pose_name: 'welcome', asset_file: 'mimi-welcome.png', slide_context: 'Phonics Story' }] },
    quality_guidelines: { authority_name: 'EYFS', core_guidelines: 'Early Years Foundation Stage framework focusing on play-based learning and child development milestones.', reference_url: '' },
    asset_citation_pattern: '\\*\\*Asset:\\*\\*\\s*`([^`]+)`',
    evidence_marker_pattern: '\\[Reserved Image Area:\\s*([^\\]]+?)\\s*\\]',
    created_at: new Date('2026-01-03').toISOString()
  },
  {
    id: 'org-template-school',
    name: 'Future Leaders International School',
    slug: 'future-leaders-school',
    institution_type: 'school',
    brand_palette: { approved: ['#1E3A8A', '#10B981', '#F59E0B', '#FFFFFF'], retired: [] },
    language_policy: { primary_script: 'arabic', target_ratio: 0.75, tolerance: 0.10, secondary_script: 'latin' },
    boundary_terms: { forbidden_strings: ['answer key', 'teacher guide', 'model solution'] },
    mascot_config: { character_name: null, poses: [] },
    quality_guidelines: { authority_name: 'Cognia', core_guidelines: 'Continuous improvement, learner-centric education, and data-driven assessments.', reference_url: 'https://www.cognia.org' },
    asset_citation_pattern: '\\*\\*Asset:\\*\\*\\s*`([^`]+)`',
    evidence_marker_pattern: '\\[Reserved Image Area:\\s*([^\\]]+?)\\s*\\]',
    created_at: new Date('2026-01-04').toISOString()
  }
];

// Helper for persistent local storage caching
function getLocal<T>(key: string, defaultVal: T): T {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultVal;
    const parsed = JSON.parse(item);
    if (Array.isArray(defaultVal) && !Array.isArray(parsed)) {
      return defaultVal;
    }
    return (parsed !== null && parsed !== undefined) ? parsed : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocal<T>(key: string, val: T, triggerEvent: boolean = false): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
    if (triggerEvent) {
      window.dispatchEvent(new CustomEvent('cds_storage_updated'));
    }
  } catch (e) {
    console.warn('LocalStorage write failed:', e);
  }
}

// ── Organizations & Settings ──

export async function fetchOrganizations(): Promise<Organization[]> {
  return api.get<Organization[]>('/api/Organizations');
}

export async function fetchOrganizationById(id: string): Promise<Organization | null> {
  try {
    return await api.get<Organization>(`/api/Organizations/${id}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('(404)')) return null;
    throw err;
  }
}

export async function createOrganization(org: Partial<Organization>): Promise<Organization> {
  const payload = {
    name: org.name || 'New Institution',
    slug: org.slug || `org-${Date.now()}`,
    institution_type: (org.institution_type as InstitutionType) || 'university',
    logo_url: org.logo_url || null,
    brand_palette: org.brand_palette || { approved: ['#002147', '#FFB81C'], retired: [] },
    language_policy: org.language_policy || { primary_script: 'arabic', target_ratio: 0.7, tolerance: 0.1, secondary_script: 'latin' },
    boundary_terms: org.boundary_terms || { forbidden_strings: ['lecturer note'] },
    mascot_config: org.mascot_config || { character_name: null, poses: [] },
    quality_guidelines: org.quality_guidelines || { authority_name: '', core_guidelines: '', reference_url: '' },
    asset_citation_pattern: org.asset_citation_pattern || '\\*\\*Asset:\\*\\*\\s*`([^`]+)`',
    evidence_marker_pattern: org.evidence_marker_pattern || '\\[Reserved Image Area:\\s*([^\\]]+?)\\s*\\]'
  };
  return api.post<Organization>('/api/Organizations', payload);
}

export async function updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
  const existing = await api.get<Organization>(`/api/Organizations/${id}`);
  const merged: Organization = { ...existing, ...updates, id: existing.id };
  return api.put<Organization>(`/api/Organizations/${id}`, merged);
}

export async function deleteOrganization(id: string): Promise<void> {
  await api.delete(`/api/Organizations/${id}`);
}

// ── Quality Gate Definitions ──

export async function fetchGateDefinitions(organizationId: string): Promise<QualityGateDefinition[]> {
  return api.get<QualityGateDefinition[]>(`/api/Organizations/${organizationId}/gate-definitions`);
}

export async function upsertGateDefinition(def: Partial<QualityGateDefinition>): Promise<QualityGateDefinition> {
  if (!def.organization_id) throw new Error('upsertGateDefinition requires organization_id.');
  return api.post<QualityGateDefinition>(`/api/Organizations/${def.organization_id}/gate-definitions`, def);
}

export async function toggleGateDefinition(organizationId: string, gateCode: string, isEnabled: boolean): Promise<void> {
  await api.patch(`/api/Organizations/${organizationId}/gate-definitions/${gateCode}/toggle?isEnabled=${isEnabled}`);
}

// ── Course Projects & Sessions ──

export async function fetchProjects(organizationId?: string): Promise<CourseProject[]> {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  return api.get<CourseProject[]>(`/api/Projects${query}`);
}

export async function fetchProjectById(id: string): Promise<CourseProject | null> {
  try {
    return await api.get<CourseProject>(`/api/Projects/${id}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('(404)')) return null;
    throw err;
  }
}

export async function createProject(project: Partial<CourseProject>): Promise<CourseProject> {
  const payload = {
    organization_id: project.organization_id || null,
    name: project.name || 'New Curriculum Course',
    slug: project.slug || `course-${Date.now()}`,
    course_code: project.course_code || null,
    credit_hours: project.credit_hours ?? null,
    prerequisites: project.prerequisites || null,
    academic_term: project.academic_term || null,
    target_age_band: project.target_age_band || 'Undergraduate',
    levels: project.levels || [],
    sessions_per_level: project.sessions_per_level || 1,
    total_sessions: project.total_sessions ?? null,
    obsidian_vault_project_path: `01_Projects/${project.slug || 'Course'}`
  };
  return api.post<CourseProject>('/api/Projects', payload);
}

export async function updateProject(id: string, updates: Partial<CourseProject>): Promise<CourseProject> {
  const existing = await api.get<CourseProject>(`/api/Projects/${id}`);
  const merged: CourseProject = { ...existing, ...updates, id: existing.id };
  return api.put<CourseProject>(`/api/Projects/${id}`, merged);
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/api/Projects/${id}`);
}

const STAGE_ORDER: PipelineStage[] = ['BRAND_SETUP', 'RECEIPT', 'DIGEST', 'BUNDLE', 'ARTIFACTS'];

// STEP 7: course_sessions has no completed_stages column — it's derivable from
// current_stage (how far the pipeline got) and status ('approved' means all 5 ran), so it
// doesn't need one. Replaces the old localStorage-cached completed_stages, which could
// silently disagree with the session's real current_stage after a backend-only change.
function deriveCompletedStages(session: CourseSession): CourseSession {
  if (session.status === 'approved' || session.status === 'completed') {
    return { ...session, completed_stages: [...STAGE_ORDER] };
  }
  const idx = STAGE_ORDER.indexOf(session.current_stage);
  return { ...session, completed_stages: idx >= 0 ? STAGE_ORDER.slice(0, idx) : [] };
}

export async function fetchSessions(projectId: string): Promise<CourseSession[]> {
  const sessions = await api.get<CourseSession[]>(`/api/Projects/${projectId}/sessions`);
  return sessions.map(deriveCompletedStages);
}

export async function extractLecturesFromCourseSpecs(projectId: string, customText?: string): Promise<CourseSession[]> {
  let sourceText = customText || '';
  const dossierFiles = await fetchDossierFiles(projectId);

  if (!sourceText) {
    const specFiles = dossierFiles.filter(f => f.category === 'COURSE_SPEC' || f.category === 'ASSESSMENT_BLUEPRINT' || f.file_name.toLowerCase().includes('spec') || f.file_name.toLowerCase().includes('syllabus'));
    sourceText = specFiles.map(f => f.file_content_text).filter(Boolean).join('\n\n');
    if (!sourceText && dossierFiles.length > 0) {
      sourceText = dossierFiles.map(f => `${f.file_name}:\n${f.file_content_text || ''}`).join('\n\n');
    }
  }

  let extractedLectures: CourseSession[] = [];

  // 1. Precise Syllabus & Table Bullet Extraction
  if (sourceText) {
    const lines = sourceText.split('\n');
    let count = 1;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      
      // Match markdown table row: | - Topic | Lecturer | Hours |
      if (line.startsWith('|') && line.includes('-')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 1) {
          const topicRaw = parts[0].replace(/^[-*#\s]+/, '').trim();
          if (topicRaw && !topicRaw.toLowerCase().includes('topic') && !topicRaw.startsWith('---')) {
            const lecturer = parts[1] || '';
            const hours = parseInt(parts[2] || '1', 10) || 1;

            extractedLectures.push({
              id: `sess-${count}-${projectId}-${Date.now()}`,
              project_id: projectId,
              session_code: `Lec ${count.toString().padStart(2, '0')}`,
              title: topicRaw,
              level: 1,
              session_number: count,
              duration_minutes: hours * 60,
              current_stage: 'BRAND_SETUP' as PipelineStage,
              status: 'draft',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            count++;
            continue;
          }
        }
      }

      // Match standard bullet points under Topic list: - Spectrophotometry and EMR
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const topicRaw = line.replace(/^[-*]\s+/, '').replace(/\s*\(\d+\s*(?:min|mins|hr|hrs|hours)?\).*$/, '').trim();
        // Skip non-lecture bullets
        if (topicRaw && topicRaw.length > 2 && !topicRaw.toLowerCase().startsWith('prerequisite') && !topicRaw.toLowerCase().startsWith('course')) {
          extractedLectures.push({
            id: `sess-${count}-${projectId}-${Date.now()}`,
            project_id: projectId,
            session_code: `Lec ${count.toString().padStart(2, '0')}`,
            title: topicRaw,
            level: 1,
            session_number: count,
            duration_minutes: 60,
            current_stage: 'BRAND_SETUP' as PipelineStage,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          count++;
          continue;
        }
      }

      // Match "Lecture 01: Topic" or "Lec 01: Topic"
      const match = line.match(/(?:Lecture|Lec|Week|Session)\s*(\d+)[:\s\-\.]+(.+?)(?:\((\d+)\s*(?:min|mins|hours|h)?\))?$/i);
      if (match) {
        const num = match[1] ? parseInt(match[1], 10) : count;
        const topic = match[2].trim().replace(/\(\d+.*?\)$/, '').trim();
        const duration = match[3] ? parseInt(match[3], 10) : 60;

        extractedLectures.push({
          id: `sess-${count}-${projectId}-${Date.now()}`,
          project_id: projectId,
          session_code: `Lec ${num.toString().padStart(2, '0')}`,
          title: topic,
          level: 1,
          session_number: num,
          duration_minutes: duration,
          current_stage: 'BRAND_SETUP' as PipelineStage,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        count++;
      }
    }
  }

  // 2. Dynamic Fallback: Check for uploaded slide decks first
    if (extractedLectures.length === 0 && dossierFiles.length > 0) {
      const slideFiles = dossierFiles.filter(f => f.category === 'LEGACY_SLIDES' || f.file_name.toLowerCase().includes('.ppt') || f.file_name.toLowerCase().includes('lec') || f.file_name.toLowerCase().includes('slide'));
      if (slideFiles.length > 0) {
        // Sort to ensure Lec 1, Lec 2, etc. are ordered correctly
        slideFiles.sort((a, b) => a.file_name.localeCompare(b.file_name, undefined, { numeric: true, sensitivity: 'base' }));
        
        let count = 1;
        for (const file of slideFiles) {
          extractedLectures.push({
            id: `sess-${count}-${projectId}-${Date.now()}`,
            project_id: projectId,
            session_code: `Lec ${count.toString().padStart(2, '0')}`,
            title: file.file_name.replace(/\.[^/.]+$/, ''), // Remove extension for title
            level: 1,
            session_number: count,
            duration_minutes: 60,
            current_stage: 'BRAND_SETUP' as PipelineStage,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          count++;
        }
      }
    }
    
    // 3. Last Resort Fallback: Single generic placeholder
    if (extractedLectures.length === 0) {
      extractedLectures = [
        {
          id: `sess-1-${projectId}`,
          project_id: projectId,
          session_code: 'Lec 01',
          title: 'Introduction to Course',
          level: 1,
          session_number: 1,
          duration_minutes: 60,
          current_stage: 'BRAND_SETUP',
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    }

    // STEP 7: these used to only ever live in localStorage — fetchSessions no longer reads
    // that cache, so extraction results must actually be saved via the real API or they'd
    // vanish on the next page load.
    const created: CourseSession[] = [];
    for (const lecture of extractedLectures) {
      created.push(await createSession(lecture));
    }
    return created;
}

export async function syncSessionsFromDossier(projectId: string): Promise<CourseSession[]> {
  return await extractLecturesFromCourseSpecs(projectId);
}

export async function createSession(session: Partial<CourseSession>): Promise<CourseSession> {
  if (!session.project_id) throw new Error('createSession requires project_id.');
  const payload = {
    session_code: session.session_code || 's1',
    title: session.title || 'Session',
    level: session.level || 1,
    session_number: session.session_number || 1,
    duration_minutes: session.duration_minutes ?? 60,
    current_stage: session.current_stage || 'BRAND_SETUP',
    blueprint_markdown: session.blueprint_markdown ?? null,
    slides_source_markdown: session.slides_source_markdown ?? null,
    home_summary_markdown: session.home_summary_markdown ?? null,
    decisions_markdown: session.decisions_markdown ?? null,
    status: session.status || 'draft',
    approval_kind: session.approval_kind ?? null,
    approval_note: session.approval_note ?? null,
  };
  const created = await api.post<CourseSession>(`/api/Projects/${session.project_id}/sessions`, payload);
  return deriveCompletedStages(created);
}

export async function updateSessionStage(sessionId: string, stage: PipelineStage): Promise<CourseSession> {
  const existing = await api.get<CourseSession>(`/api/Sessions/${sessionId}`);
  const updated = await api.put<CourseSession>(`/api/Sessions/${sessionId}`, { ...existing, current_stage: stage });
  return deriveCompletedStages(updated);
}

// completedStages is accepted for call-site compatibility but not sent anywhere — it's
// derived from current_stage/status on every read (see deriveCompletedStages).
export async function updateSessionCompletedStages(sessionId: string, currentStage: PipelineStage, status: string = 'draft'): Promise<CourseSession> {
  const existing = await api.get<CourseSession>(`/api/Sessions/${sessionId}`);
  const updated = await api.put<CourseSession>(`/api/Sessions/${sessionId}`, { ...existing, current_stage: currentStage, status });
  return deriveCompletedStages(updated);
}

export async function updateSession(id: string, updates: Partial<CourseSession>): Promise<CourseSession> {
  const existing = await api.get<CourseSession>(`/api/Sessions/${id}`);
  const merged = { ...existing, ...updates, id: existing.id };
  const updated = await api.put<CourseSession>(`/api/Sessions/${id}`, merged);
  return deriveCompletedStages(updated);
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/api/Sessions/${id}`);
}

// ── Course Dossier Ingestion Hub ──

const DEFAULT_SAMPLE_DOSSIER: ProjectDossierFile[] = [
  {
    id: 'dossier-blueprint-1',
    project_id: '',
    file_name: 'Assessment_Specification_Blueprint.json',
    mime_type: 'application/json',
    category: 'ASSESSMENT_BLUEPRINT',
    summary: 'Accredited Exam Blueprint Matrix (جدول المواصفات) mapping Bloom taxonomy levels, ILO weights, and question formats for automated Question Bank synthesis.',
    extracted_metadata: { 
      domain: 'Assessment & Question Bank Matrix',
      topics_count: 4, 
      target_questions: 25, 
      cognitive_levels: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating'],
      ilo_matrix: ['K1-Knowledge', 'I1-Intellectual', 'P1-Practical/Clinical']
    },
    file_content_text: JSON.stringify({
      course_title: 'Instrumental Analysis (Pharmaceutical)',
      course_code: 'PHAR-301',
      credit_hours: 3,
      total_marks: 100,
      target_question_count: 25,
      cognitive_weightage: {
        remembering_recall: '25%',
        understanding_comprehension: '35%',
        applying_problem_solving: '25%',
        analyzing_evaluating: '15%'
      },
      topic_blueprint: [
        {
          topic: 'Spectrophotometry and EMR & Beers Lambert Law',
          weight: '30%',
          ilos: ['K1', 'I2'],
          question_distribution: { mcq: 5, calculation: 1, case_vignette: 1 }
        },
        {
          topic: 'Components of Spectrophotometer & Factors Affecting Spectrum',
          weight: '25%',
          ilos: ['K2', 'I1', 'P1'],
          question_distribution: { mcq: 4, calculation: 1, case_vignette: 1 }
        },
        {
          topic: 'Pharmaceutical Applications & Spectrofluorometry',
          weight: '20%',
          ilos: ['K1', 'I3'],
          question_distribution: { mcq: 4, interpretation: 2 }
        },
        {
          topic: 'Chromatography (Column, HPLC, GC & Theory)',
          weight: '25%',
          ilos: ['K3', 'I2'],
          question_distribution: { mcq: 4, short_answer: 1 }
        }
      ]
    }, null, 2),
    created_at: new Date().toISOString()
  },
  {
    id: 'dossier-1',
    project_id: '',
    file_name: 'Course_Specification_ILOs.pdf',
    mime_type: 'application/pdf',
    category: 'COURSE_SPEC',
    summary: 'Horus University Faculty of Pharmacy Course Specification for Instrumental Analysis detailing lecture matrix and topics.',
    extracted_metadata: { domain: 'Faculty of Pharmacy Course Specification', lectures_count: 11 },
    file_content_text: `HORUS UNIVERSITY — EGYPT (HUE)
FACULTY OF PHARMACY
DEPARTMENT OF PHARMACEUTICAL ANALYTICAL CHEMISTRY
COURSE SPECIFICATION: INSTRUMENTAL ANALYSIS (PHAR-301)

Topic (Theoretical & Practical) | Lecturer | Lecture hours
- Spectrophotometry and EMR | Dr. Mahmoud Elkhoudary | 1
- Beers lambert law. | Dr. Mahmoud Elkhoudary | 1
- Components of spectrophotometer | Dr. Mahmoud Elkhoudary | 1
- Factors affecting absorption spectrum | Dr. Mahmoud Elkhoudary | 1
- Application in pharmaceuticals. | Dr. Mahmoud Elkhoudary | 1
- Introduction to Spectrofluorometry. | Dr. Mahmoud Elkhoudary | 1
- Introduction to chromatography. | Dr. Shereen Shalan | 1
- Basic chromatographic techniques. | Dr. Shereen Shalan | 1
- Column chromatography | Dr. Shereen Shalan | 1
- HPLC | Dr. Shereen Shalan | 1
- GC and chromatographic theory. | Dr. Shereen Shalan | 1`,
    created_at: new Date().toISOString()
  },
  {
    id: 'dossier-2',
    project_id: '',
    file_name: 'Pharmacology_Mechanisms_Reactions.cdx',
    mime_type: 'chemical/x-cdx',
    category: 'CHEM_MOLECULAR',
    summary: 'Chemical ligand-receptor binding notations, SMILES representations, and IC50 binding affinities.',
    extracted_metadata: { domain: 'Pharmacology & Biochemistry', formulas_count: 8 },
    file_content_text: 'SMILES: CC(=O)OC1=CC=CC=C1C(=O)O (Aspirin), IC50: 12nM.',
    created_at: new Date().toISOString()
  },
  {
    id: 'dossier-3',
    project_id: '',
    file_name: 'Calculus_Rate_Equations.tex',
    mime_type: 'text/x-tex',
    category: 'MATH_EQUATIONS',
    summary: 'LaTeX differential equations governing rate kinetics and compartmental pharmacokinetic models.',
    extracted_metadata: { domain: 'Quantitative Mathematical Models', formulas_count: 12 },
    file_content_text: '$$\\frac{dC}{dt} = -k_e C + \\frac{D}{V_d}$$',
    created_at: new Date().toISOString()
  }
];

export async function fetchDossierFiles(projectId: string): Promise<ProjectDossierFile[]> {
  try {
    const { data, error } = await supabase
      .from('project_dossier_files')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (!error && Array.isArray(data) && data.length > 0) return data;
  } catch {}

  const storageKey = `cds_dossier_${projectId}`;
  if (typeof window !== 'undefined' && localStorage.getItem(storageKey) !== null) {
    const cached = getLocal<ProjectDossierFile[] | null>(storageKey, null);
    if (cached !== null && Array.isArray(cached)) return cached;
  }

  // Return empty array for new projects instead of seeding templates
  return [];
}

export async function createDossierFile(file: Partial<ProjectDossierFile>): Promise<ProjectDossierFile> {
  const categorized = autoCategorizeDossier(file);
  const newFile: ProjectDossierFile = {
    id: file.id || `dossier-${Date.now()}`,
    project_id: file.project_id || '',
    file_name: file.file_name || 'Document.pdf',
    file_size_bytes: file.file_size_bytes || 1024,
    mime_type: file.mime_type || 'text/plain',
    category: categorized.category || 'REFERENCE_EVIDENCE',
    summary: categorized.summary || '',
    extracted_metadata: categorized.extracted_metadata || {},
    file_content_text: file.file_content_text || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const local = await fetchDossierFiles(newFile.project_id);
  const updated = [newFile, ...local.filter(f => f.id !== newFile.id)];
  setLocal(`cds_dossier_${newFile.project_id}`, updated);

  try {
    await supabase.from('project_dossier_files').insert([newFile]);
  } catch {}

  return newFile;
}

export async function updateDossierFile(id: string, projectId: string, updates: Partial<ProjectDossierFile>): Promise<ProjectDossierFile | null> {
  const local = await fetchDossierFiles(projectId);
  const existing = local.find(f => f.id === id);
  if (!existing) return null;

  const merged: ProjectDossierFile = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };

  const updatedList = local.map(f => f.id === id ? merged : f);
  setLocal(`cds_dossier_${projectId}`, updatedList);

  try {
    await supabase.from('project_dossier_files').update(updates).eq('id', id);
  } catch {}

  return merged;
}

export async function deleteDossierFile(id: string, projectId: string): Promise<boolean> {
  const local = await fetchDossierFiles(projectId);
  const filtered = local.filter(f => f.id !== id);
  setLocal(`cds_dossier_${projectId}`, filtered);

  try {
    await supabase.from('project_dossier_files').delete().eq('id', id);
  } catch {}

  return true;
}

export function autoCategorizeDossier(file: Partial<ProjectDossierFile>): Partial<ProjectDossierFile> {
  const text = (file.file_content_text || '').toLowerCase();
  const rawText = file.file_content_text || '';
  const name = (file.file_name || '').toLowerCase();
  const combined = `${name} ${text}`;

  let category: DossierFileCategory = 'REFERENCE_EVIDENCE';
  let summary = 'Supplementary academic reference or empirical evidence table.';
  const metadata: Record<string, any> = file.extracted_metadata || {};

  if (combined.includes('blueprint') || combined.includes('جدول المواصفات') || combined.includes('exam matrix') ||
      combined.includes('assessment matrix') || combined.includes('question matrix') || combined.includes('specification table')) {
    category = 'ASSESSMENT_BLUEPRINT';
    summary = 'Accredited Exam Blueprint Matrix (جدول المواصفات) mapping Bloom taxonomy, topic weights, and question formats.';
    metadata.domain = 'Assessment Blueprint & Question Matrix';
  } else if (combined.includes('smiles') || combined.includes('inchi') || combined.includes('chemdraw') ||
      combined.includes('benzene') || combined.includes('reaction') || combined.includes('mechanism of action') ||
      name.endsWith('.mol') || name.endsWith('.sdf') || name.endsWith('.cdx') ||
      /\b(C\d*H\d*|O\d*|N\d*|NaCl|H2O|HCl|H2SO4|NaOH)\b/.test(rawText)) {
    category = 'CHEM_MOLECULAR';
    summary = 'Chemical structures, molecular formulas, reaction pathways, and pharmacology mechanisms.';
    metadata.domain = 'Chemistry / Pharmacology / Biochemistry';
  } else if (combined.includes('latex') || combined.includes('\\frac') || combined.includes('\\int') ||
           combined.includes('\\sum') || combined.includes('\\partial') || combined.includes('\\matrix') ||
           combined.includes('differential equation') || combined.includes('calculus') ||
           /(\$\$.*?\$\$|\$.*?\$|\\\[.*?\\\]|\\\(.*?\\\))/.test(rawText)) {
    category = 'MATH_EQUATIONS';
    summary = 'Mathematical formulations, LaTeX differential equations, and quantitative proofs.';
    metadata.domain = 'Mathematics / Physics / Quantitative Analysis';
  } else if (combined.includes('diagram') || combined.includes('schematic') || combined.includes('anatomy') ||
           combined.includes('histology') || combined.includes('cross-section') || combined.includes('circuit') ||
           name.endsWith('.svg') || name.endsWith('.png') || name.endsWith('.jpg')) {
    category = 'DIAGRAMS_SCHEMATICS';
    summary = 'Scientific diagrams, anatomical illustrations, or circuit schematics.';
    metadata.domain = 'Visual Diagrams & Schematics';
  } else if (combined.includes('sop') || combined.includes('clinical protocol') || combined.includes('wet lab') ||
           combined.includes('osce') || combined.includes('dosage calculation') || combined.includes('hardware') || combined.includes('sensor')) {
    category = 'LAB_CLINICAL_PROTOCOL';
    summary = 'Standard operating procedures (SOPs), clinical protocols, and lab manuals.';
    metadata.domain = 'Clinical Skills / Laboratory';
  } else if (combined.includes('course spec') || combined.includes('syllabus') || combined.includes('intended learning outcome') ||
           combined.includes('ilo') || combined.includes('abet') || combined.includes('nars') || combined.includes('وصف المقرر')) {
    category = 'COURSE_SPEC';
    summary = 'Accreditation course specification detailing ILO matrix and contact hours.';
    metadata.domain = 'Course Specification';
  } else if (combined.includes('case study') || combined.includes('question bank') || combined.includes('exam') || combined.includes('quiz') || combined.includes('mcq')) {
    category = 'CASE_STUDY_BANK';
    summary = 'Clinical cases, problem scenarios, and exam question banks.';
    metadata.domain = 'Problem-Based Learning & Exam Banks';
  } else if (name.endsWith('.pptx') || name.endsWith('.ppt') || combined.includes('slide') || combined.includes('lecture ')) {
    category = 'LEGACY_SLIDES';
    summary = 'Legacy lecture slide deck containing previous presentation structure.';
    metadata.domain = 'Prior Lecture Decks';
  }

  return {
    ...file,
    category,
    summary: file.summary || summary,
    extracted_metadata: metadata,
  };
}

// ── Agent Swarm Logs ──

export async function fetchAgentLogs(sessionId: string): Promise<AgentLog[]> {
  try {
    const { data, error } = await supabase
      .from('agent_swarm_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (!error && data) return data;
  } catch {}

  return getLocal<AgentLog[]>(`cds_logs_${sessionId}`, []);
}

export async function insertAgentLog(log: Partial<AgentLog>): Promise<AgentLog | null> {
  const newLog: AgentLog = {
    id: log.id || `log-${Date.now()}`,
    project_id: log.project_id,
    session_id: log.session_id,
    agent_role: log.agent_role || 'AGENT',
    agent_thoughts: log.agent_thoughts || '',
    stage_name: log.stage_name || 'BRAND_SETUP',
    tokens_consumed: log.tokens_consumed || 500,
    created_at: new Date().toISOString()
  };

  if (log.session_id) {
    const local = getLocal<AgentLog[]>(`cds_logs_${log.session_id}`, []);
    setLocal(`cds_logs_${log.session_id}`, [...local, newLog]);
  }

  try {
    await supabase.from('agent_swarm_logs').insert([newLog]);
  } catch {}

  return newLog;
}

// ── Quality Receipts & Results ──

export async function fetchQualityReceipts(sessionId: string): Promise<QualityReceipt[]> {
  return api.get<QualityReceipt[]>(`/api/QualityGates/session/${sessionId}`);
}

// STEP 7: there is no "upsertQualityReceipt" on the real API and there shouldn't be one —
// a receipt is only ever the real output of running the registered gates
// (POST /api/QualityGates/evaluate, which persists it server-side). The old version of this
// function fabricated a receipt with caller-supplied (usually hardcoded all-PASS) verdicts
// and wrote it straight to storage as if a gate had actually run. Callers now call
// runQualityGates below with the session's real content instead.
export async function runQualityGates(request: {
  organization_id: string;
  project_id: string;
  session_id: string;
  stage: PipelineStage;
  learner_text: string;
  mapped_assets?: unknown[];
}): Promise<QualityGateResult[]> {
  return api.post<QualityGateResult[]>('/api/QualityGates/evaluate', {
    organization_id: request.organization_id,
    project_id: request.project_id,
    session_id: request.session_id,
    stage: request.stage,
    learner_text: request.learner_text,
    mapped_assets: request.mapped_assets || [],
  });
}

