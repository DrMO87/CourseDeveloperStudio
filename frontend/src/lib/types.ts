export type PipelineStage = 
  | 'BRAND_SETUP' 
  | 'RECEIPT' 
  | 'DIGEST' 
  | 'BUNDLE' 
  | 'ARTIFACTS';

export type GateVerdict = 'PASS' | 'FAIL' | 'UNVERIFIED';

export type InstitutionType = 'university' | 'academy' | 'school' | 'nursery' | 'training_center';

export type DossierFileCategory = 
  | 'COURSE_SPEC'
  | 'ASSESSMENT_BLUEPRINT'
  | 'QUESTION_BANK'
  | 'LEGACY_SLIDES'
  | 'CHEM_MOLECULAR'
  | 'MATH_EQUATIONS'
  | 'DIAGRAMS_SCHEMATICS'
  | 'LAB_CLINICAL_PROTOCOL'
  | 'PEDAGOGY_RUBRIC'
  | 'CASE_STUDY_BANK'
  | 'REFERENCE_EVIDENCE'
  | 'UNCLASSIFIED';

export interface ProjectDossierFile {
  id: string;
  project_id: string;
  file_name: string;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  category: DossierFileCategory;
  summary?: string | null;
  extracted_metadata: Record<string, any>;
  file_content_text?: string | null;
  file_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BrandPalette {
  approved: string[];
  retired: string[];
}

export interface LanguagePolicy {
  primary_script: string;
  target_ratio: number;
  tolerance: number;
  secondary_script: string;
}

export interface MascotPose {
  pose_name: string;
  asset_file: string;
  slide_context: string;
}

export interface MascotConfig {
  character_name: string | null;
  poses: MascotPose[];
}

export interface BoundaryTermsConfig {
  forbidden_strings: string[];
}

export interface QualityGuidelinesConfig {
  authority_name: string;
  core_guidelines: string;
  reference_url: string;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  institution_type: InstitutionType;
  logo_url?: string | null;
  brand_palette: BrandPalette;
  language_policy: LanguagePolicy;
  mascot_config: MascotConfig;
  boundary_terms: BoundaryTermsConfig;
  quality_guidelines: QualityGuidelinesConfig;
  asset_citation_pattern: string;
  evidence_marker_pattern: string;
  created_at?: string;
  updated_at?: string;
}

export interface QualityGateDefinition {
  id: string;
  organization_id: string;
  gate_code: string;
  display_name: string;
  is_enabled: boolean;
  gate_config: Record<string, any>;
  sort_order: number;
  created_at?: string;
}

export interface QualityGateResult {
  id?: string;
  receipt_id?: string;
  gate_code: string;
  verdict: GateVerdict;
  metric_value?: number | null;
  detail?: string | null;
  evidence?: Record<string, any>;
  created_at?: string;
}

export interface CourseProject {
  id: string;
  organization_id?: string | null;
  name: string;
  slug: string;
  course_code?: string;
  credit_hours?: number;
  prerequisites?: string;
  academic_term?: string;
  target_age_band?: string;
  levels?: number[];
  sessions_per_level?: number;
  total_sessions?: number;
  obsidian_vault_project_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CourseSession {
  id: string;
  project_id: string;
  session_code: string;
  title: string;
  level: number;
  session_number: number;
  duration_minutes?: number;
  current_stage: PipelineStage;
  completed_stages?: PipelineStage[];
  blueprint_markdown?: string;
  slides_source_markdown?: string;
  home_summary_markdown?: string;
  decisions_markdown?: string;
  status: string;
  approval_kind?: string | null;
  approval_note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AgentLog {
  id?: string;
  project_id?: string;
  session_id?: string;
  agent_role: string;
  agent_thoughts: string;
  stage_name: PipelineStage;
  tool_invocations?: any;
  input_payload?: string;
  output_data?: string;
  tokens_consumed?: number;
  created_at: string;
}

export interface QualityReceipt {
  id?: string;
  project_id?: string;
  session_id?: string;
  stage_name?: PipelineStage;
  overall_verdict: GateVerdict;
  evaluated_at?: string;
  detailed_receipt?: Record<string, any>;
  gate_results?: QualityGateResult[];
  created_at?: string;
}
