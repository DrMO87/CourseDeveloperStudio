'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  UploadCloud, 
  Plus, 
  ArrowRight,
  Trash2, 
  Pencil,
  Bot, 
  CheckCircle2, 
  Sparkles, 
  FolderArchive, 
  Tag, 
  RefreshCw, 
  Sliders, 
  Layers, 
  BookOpen,
  Cpu,
  GraduationCap,
  HelpCircle,
  FileCheck,
  FlaskConical,
  Binary,
  Activity,
  Stethoscope,
  Atom,
  Sigma,
  Upload,
  FileUp,
  FileCode,
  Check,
  Zap,
  ListOrdered
} from 'lucide-react';
import type { ProjectDossierFile, DossierFileCategory, CourseProject, Organization } from '@/lib/types';
import { 
  fetchDossierFiles, 
  createDossierFile, 
  deleteDossierFile, 
  updateDossierFile,
  autoCategorizeDossier,
  extractLecturesFromCourseSpecs,
  extractLecturesWithAi
} from '@/lib/supabase';
import { syncCourseToObsidian } from '@/lib/obsidianSync';
import { AssessmentBlueprintModal } from './AssessmentBlueprintModal';
import { LlmProcessLoadingMeter } from '@/components/LlmProcessLoadingMeter';

interface Props {
  project: CourseProject;
  organization?: Organization | null;
}

const CATEGORY_CONFIG: Record<DossierFileCategory, { label: string; icon: any; color: string; badge: string; description: string }> = {
  COURSE_SPEC: {
    label: 'Course Spec / Syllabus (ILOs)',
    icon: GraduationCap,
    color: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
    description: 'Accreditation syllabus, NARS/ABET matrices, contact hours, and curricular milestones.'
  },
  ASSESSMENT_BLUEPRINT: {
    label: 'Exam & Question Blueprint',
    icon: Sparkles,
    color: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-gold-300 border-amber-400 dark:border-amber-500/40',
    description: 'Accredited Exam Blueprint Matrix (جدول المواصفات) mapping Bloom levels, weights, and questions for Question Bank generation.'
  },
  QUESTION_BANK: {
    label: 'Calibrated Question Bank (MCQs & Cases)',
    icon: HelpCircle,
    color: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-300 border-orange-400 dark:border-orange-500/40',
    description: 'Calibrated multiple choice question pools, clinical vignettes, Bloom level taggings, and distractor rationales.'
  },
  CASE_STUDY_BANK: {
    label: 'Question Banks & Exam Pools',
    icon: HelpCircle,
    color: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-50 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-500/40',
    description: 'Problem-based learning (PBL) cases, patient vignettes, formative quizzes, and calibrated MCQ exam pools.'
  },
  LEGACY_SLIDES: {
    label: 'Legacy Lecture Decks / PPTX',
    icon: FileText,
    color: 'text-sky-600 dark:text-sky-400',
    badge: 'bg-sky-50 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40',
    description: 'Prior semester lecture decks and presentation slide source outlines.'
  },
  CHEM_MOLECULAR: {
    label: 'Chemical Structures & Pharmacology',
    icon: FlaskConical,
    color: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
    description: 'Molecular formulas (SMILES/InChI), reaction pathways, pharmacophores, and drug mechanisms.'
  },
  MATH_EQUATIONS: {
    label: 'Math Equations & LaTeX Proofs',
    icon: Sigma,
    color: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40',
    description: 'LaTeX differential equations, calculus models, statistical distributions, and theorems.'
  },
  DIAGRAMS_SCHEMATICS: {
    label: 'Scientific Diagrams & Schematics',
    icon: Activity,
    color: 'text-cyan-600 dark:text-cyan-400',
    badge: 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40',
    description: 'Anatomy diagrams, circuit schematics, vector diagrams, CAD, and medical imaging slices.'
  },
  LAB_CLINICAL_PROTOCOL: {
    label: 'Wet Lab SOPs & Clinical Protocols',
    icon: Stethoscope,
    color: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40',
    description: 'Sterile compounding SOPs, OSCE clinical stations, laboratory manuals, and hardware pinouts.'
  },
  PEDAGOGY_RUBRIC: {
    label: 'Bloom & Miller Rubrics',
    icon: Sliders,
    color: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-50 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/40',
    description: 'Bloom’s Revised Taxonomy cognitive matrices, Miller’s clinical pyramid, and scoring rubrics.'
  },
  REFERENCE_EVIDENCE: {
    label: 'Textbook & Scientific References',
    icon: BookOpen,
    color: 'text-teal-600 dark:text-teal-400',
    badge: 'bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-500/40',
    description: 'Empirical journal papers, supplementary reading, data tables, and citation references.'
  },
  UNCLASSIFIED: {
    label: 'Unclassified Intake',
    icon: FileCheck,
    color: 'text-slate-600 dark:text-slate-400',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    description: 'Fresh document intake awaiting Swarm multi-agent classification.'
  }
};

export function CourseDossierHub({ project, organization }: Props) {
  const [files, setFiles] = useState<ProjectDossierFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<ProjectDossierFile | null>(null);
  const [extractingLectures, setExtractingLectures] = useState(false);

  // LLM Process Loading Meter State
  const [meterActive, setMeterActive] = useState(false);
  const [meterComplete, setMeterComplete] = useState(false);
  const [meterTitle, setMeterTitle] = useState('');
  const [meterSubtitle, setMeterSubtitle] = useState('');
  const [meterAgent, setMeterAgent] = useState('SYLLABUS_ARCHITECT');
  const [meterPhaseText, setMeterPhaseText] = useState<string | undefined>(undefined);
  const [meterPhases, setMeterPhases] = useState<string[] | undefined>(undefined);

  const handleExtractLecturesFromSpec = async (file: ProjectDossierFile) => {
    setExtractingLectures(true);
    setMeterActive(true);
    setMeterComplete(false);
    setMeterTitle(`Analyzing "${file.file_name}"`);
    setMeterSubtitle('Synthesizing verified lecture schedule via SYLLABUS_ARCHITECT');
    setMeterAgent('SYLLABUS_ARCHITECT');
    setMeterPhases([
      'Extracting course ILOs, weeks & topics',
      'Querying active model to deconstruct syllabus',
      'Validating session codes & credit durations',
      'Writing lecture breakdown to Obsidian vault'
    ]);
    setDropToast(`⏳ SYLLABUS_ARCHITECT AI analyzing "${file.file_name}" via /api/llm/chat...`);
    try {
      const aiRes = await extractLecturesWithAi(project.id, file.file_content_text || undefined);
      setMeterComplete(true);
      if (aiRes.usedAi) {
        setDropToast(`⚡ SYLLABUS_ARCHITECT extracted ${aiRes.sessions.length} sessions from "${file.file_name}"! (${aiRes.modelUsed})`);
      } else {
        setDropToast(`Successfully extracted ${aiRes.sessions.length} lectures from "${file.file_name}"!`);
      }
      setTimeout(() => {
        setMeterActive(false);
        setMeterComplete(false);
      }, 1200);
      setTimeout(() => setDropToast(null), 6000);
    } catch (err: any) {
      setDropToast(`Extraction error: ${err.message}`);
      setMeterActive(false);
      setMeterComplete(false);
      setTimeout(() => setDropToast(null), 5000);
    } finally {
      setExtractingLectures(false);
    }
  };

  // Drag and Drop States
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dropToast, setDropToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Edit State
  const [editingFile, setEditingFile] = useState<ProjectDossierFile | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editCategory, setEditCategory] = useState<DossierFileCategory>('UNCLASSIFIED');
  const [editSummary, setEditSummary] = useState('');

  // Upload Form State
  const [fileName, setFileName] = useState('');
  const [manualCategory, setManualCategory] = useState<DossierFileCategory>('COURSE_SPEC');
  const [fileContent, setFileContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzingSwarm, setAnalyzingSwarm] = useState(false);
  const [extractedAssetsCount, setExtractedAssetsCount] = useState<number>(0);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await fetchDossierFiles(project.id);
      setFiles(data);

      try {
        const slug = project.slug || project.course_code || 'default';
        const aRes = await fetch(`/api/dossier/assets?projectSlug=${slug}`);
        if (aRes.ok) {
          const aData = await aRes.json();
          setExtractedAssetsCount(Array.isArray(aData) ? aData.length : 0);
        }
      } catch {
        // non-blocking
      }
    } catch (err) {
      console.error(err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [project.id]);

  const extractDroppedFiles = (dataTransfer: DataTransfer | null): File[] => {
    if (!dataTransfer) return [];
    const files: File[] = [];

    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
    }

    if (files.length === 0 && dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const f = dataTransfer.files[i];
        if (f) files.push(f);
      }
    }

    return files;
  };

  // Window-level Drag & Drop Prevention & Handler
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current += 1;
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      setIsDraggingOver(true);
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      setIsDraggingOver(true);
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDraggingOver(false);
      }
    };

    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDraggingOver(false);

      const files = extractDroppedFiles(e.dataTransfer);
      if (files.length > 0) {
        await processFileList(files);
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [project.id]);

  // Core Multi-File Ingestion Pipeline
  const processFileList = async (fileList: FileList | File[]) => {
    const filesArray = Array.isArray(fileList) ? fileList : Array.from(fileList);
    if (!filesArray || filesArray.length === 0) return;

    setUploading(true);
    setMeterActive(true);
    setMeterComplete(false);
    setMeterTitle(`Ingesting & Structuring ${filesArray.length} File(s)`);
    setMeterSubtitle('Extracting text syntax, saving vault assets & running AI classification');
    setMeterAgent('CONTEXT_INGESTOR');
    setMeterPhases([
      'Streaming files & reading binary data',
      'Extracting document syntax & office media',
      'Categorizing files into Dossier classification matrix',
      'Synchronizing records to Obsidian PARA vault'
    ]);
    setDropToast(`⏳ Ingesting ${filesArray.length} file(s) into Course Dossier...`);
    const addedFiles: ProjectDossierFile[] = [];

    try {
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        setMeterPhaseText(`Extracting (${i + 1}/${filesArray.length}): ${file.name}`);
        let contentText = '';

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const isTextFile = ['txt', 'md', 'tex', 'latex', 'json', 'csv', 'yaml', 'yml', 'py', 'c', 'cpp', 'h', 'xml', 'html', 'smi'].includes(ext) || file.type.startsWith('text/');

        if (isTextFile) {
          try {
            contentText = await file.text();
          } catch {
            contentText = `File content: ${file.name} (${file.size} bytes)`;
          }
        } else {
          // Route all binaries (PDF, Word, PPTX, Images, CDX, etc.) through /api/extract to save into vault assets
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectSlug', project.slug || project.course_code || 'default');
            const extractRes = await fetch('/api/extract', { method: 'POST', body: formData });
            const extractData = await extractRes.json();
            if (extractData.success && extractData.text) {
              contentText = extractData.text;
            } else {
              contentText = `Binary Asset: ${file.name} (${Math.round(file.size / 1024)} KB)`;
            }
          } catch {
            contentText = `Binary Asset: ${file.name} (${Math.round(file.size / 1024)} KB)`;
          }
        }

        // Auto-detect category from filename or contents
        const lowerName = file.name.toLowerCase();
        let detectedCategory: DossierFileCategory = 'UNCLASSIFIED';
        if (lowerName.includes('spec') || lowerName.includes('syllabus') || lowerName.includes('ilo') || lowerName.includes('course')) {
          detectedCategory = 'COURSE_SPEC';
        } else if (lowerName.includes('blueprint') || lowerName.includes('exam') || lowerName.includes('matrix') || lowerName.includes('مواصفات')) {
          detectedCategory = 'ASSESSMENT_BLUEPRINT';
        } else if (lowerName.includes('case') || lowerName.includes('vignette') || lowerName.includes('clinical')) {
          detectedCategory = 'CASE_STUDY_BANK';
        } else if (lowerName.includes('chem') || lowerName.includes('molecule') || lowerName.includes('reaction') || ext === 'cdx' || ext === 'smi') {
          detectedCategory = 'CHEM_MOLECULAR';
        } else if (lowerName.includes('math') || lowerName.includes('calculus') || lowerName.includes('equation') || ext === 'tex') {
          detectedCategory = 'MATH_EQUATIONS';
        } else if (lowerName.includes('lab') || lowerName.includes('sop') || lowerName.includes('protocol')) {
          detectedCategory = 'LAB_CLINICAL_PROTOCOL';
        } else if (lowerName.includes('question') || lowerName.includes('bank') || lowerName.includes('mcq') || lowerName.includes('exam')) {
          detectedCategory = 'QUESTION_BANK';
        }

        try {
          const newRecord = await createDossierFile({
            project_id: project.id,
            file_name: file.name,
            file_size_bytes: file.size,
            mime_type: file.type || `application/${ext || 'octet-stream'}`,
            category: detectedCategory,
            summary: `Uploaded file: ${file.name} (${detectedCategory.replace(/_/g, ' ')})`,
            file_content_text: contentText,
          });

          addedFiles.push(newRecord);

          // Immediately update state so file card appears in UI instantly
          setFiles(prev => [newRecord, ...prev.filter(f => f.id !== newRecord.id)]);

          // Trigger non-blocking AI syllabus extraction if course spec or syllabus content is provided
          if (detectedCategory === 'COURSE_SPEC' || contentText.includes('Lecture') || contentText.includes('Week') || contentText.includes('Topic')) {
            extractLecturesWithAi(project.id, contentText)
              .then((aiRes: any) => {
                if (aiRes.usedAi && aiRes.sessions.length > 0) {
                  setDropToast(`⚡ SYLLABUS_ARCHITECT synthesized ${aiRes.sessions.length} sessions from "${file.name}"! (${aiRes.modelUsed})`);
                  setTimeout(() => setDropToast(null), 6000);
                }
              })
              .catch(() => {});
          }
        } catch (itemErr: any) {
          console.error('Error creating dossier file:', itemErr);
        }
      }

      // Auto-sync real uploaded files to Obsidian Vault on disk
      try {
        await syncCourseToObsidian(organization || null, project, undefined, undefined, addedFiles);
        setDropToast(`✅ Ingested ${addedFiles.length} file(s) and synced to Obsidian Vault!`);
      } catch {
        setDropToast(`✅ Ingested ${addedFiles.length} file(s) into Course Dossier!`);
      }
      setTimeout(() => setDropToast(null), 5000);
    } catch (err: any) {
      console.error('Batch file ingestion error:', err);
      setDropToast(`Ingestion notice: ${err.message || 'Partial upload'}`);
      setTimeout(() => setDropToast(null), 5000);
    } finally {
      setMeterComplete(true);
      setTimeout(() => {
        setMeterActive(false);
        setMeterComplete(false);
        setMeterPhaseText(undefined);
      }, 1200);
      setUploading(false);
    }
  };

  const handleCreateBlueprint = async () => {
    const existing = files.find(f => f.category === 'ASSESSMENT_BLUEPRINT');
    if (existing) {
      setSelectedBlueprint(existing);
      return;
    }

    const defaultBlueprint = {
      course_title: project.name,
      course_code: project.course_code || 'PHAR-301',
      credit_hours: project.credit_hours || 3,
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
          topic: 'Fundamental Theory & Principles',
          weight: '25%',
          ilos: ['K1', 'I1'],
          question_distribution: { mcq: 5, short_answer: 1 }
        },
        {
          topic: 'Methodology, Instrumentation & Quantitative Protocols',
          weight: '35%',
          ilos: ['K2', 'I2', 'P1'],
          question_distribution: { mcq: 6, calculation: 2, case_vignette: 1 }
        },
        {
          topic: 'Diagnostic Interpretation & Problem Solving',
          weight: '25%',
          ilos: ['I3', 'P2'],
          question_distribution: { mcq: 4, interpretation: 2 }
        },
        {
          topic: 'Quality Assurance & Regulatory Standards',
          weight: '15%',
          ilos: ['K3', 'I1'],
          question_distribution: { mcq: 3, short_answer: 1 }
        }
      ]
    };

    const newRecord = await createDossierFile({
      project_id: project.id,
      file_name: `Assessment_Specification_Blueprint_${project.course_code || 'Matrix'}.json`,
      category: 'ASSESSMENT_BLUEPRINT',
      summary: 'Accredited Exam Blueprint Matrix (جدول المواصفات) mapping Bloom levels, weights, and questions for Question Bank generation.',
      extracted_metadata: {
        domain: 'Assessment & Question Bank Matrix',
        topics_count: 4,
        target_questions: 25,
        cognitive_levels: ['Remembering', 'Understanding', 'Applying', 'Analyzing']
      },
      file_content_text: JSON.stringify(defaultBlueprint, null, 2)
    });

    setFiles(prev => [newRecord, ...prev]);
    setSelectedBlueprint(newRecord);
  };

  // Drag Event Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDraggingOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    const files = extractDroppedFiles(e.dataTransfer);
    if (files.length > 0) {
      await processFileList(files);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;
    setUploading(true);

    try {
      const created = await createDossierFile({
        project_id: project.id,
        file_name: fileName.trim(),
        category: manualCategory,
        file_content_text: fileContent.trim()
      });

      setShowUploadModal(false);
      setFileName('');
      setFileContent('');
      await loadFiles();

      // Trigger AI lecture extraction if course spec or syllabus content is provided
      if (manualCategory === 'COURSE_SPEC' || fileContent.includes('Lecture') || fileContent.includes('Topic') || fileContent.includes('Week')) {
        setDropToast(`⏳ Analyzing "${created.file_name}" with SYLLABUS_ARCHITECT...`);
        try {
          const aiRes = await extractLecturesWithAi(project.id, created.file_content_text || undefined);
          if (aiRes.usedAi) {
            setDropToast(`⚡ SYLLABUS_ARCHITECT generated ${aiRes.sessions.length} sessions from "${created.file_name}"! (${aiRes.modelUsed})`);
          } else {
            setDropToast(`✅ Ingested "${created.file_name}" and generated ${aiRes.sessions.length} sessions!`);
          }
        } catch {
          setDropToast(`✅ Successfully ingested "${created.file_name}" into Course Dossier!`);
        }
      } else {
        setDropToast(`✅ Successfully ingested "${created.file_name}" into Course Dossier!`);
      }
      setTimeout(() => setDropToast(null), 5000);
    } catch (err: any) {
      console.error('Error uploading dossier file:', err);
      setDropToast(`Error: ${err.message || 'Upload failed'}`);
      setTimeout(() => setDropToast(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  const processSingleFileForModal = async (selected: File) => {
    setFileName(selected.name);
    const ext = selected.name.split('.').pop()?.toLowerCase() || '';
    const isText = ['txt', 'md', 'tex', 'latex', 'json', 'csv', 'yaml', 'yml', 'py', 'c', 'cpp', 'h', 'xml', 'html', 'smi'].includes(ext) || selected.type.startsWith('text/');

    if (isText) {
      try {
        const text = await selected.text();
        setFileContent(text);
      } catch {
        setFileContent(`[Attached file: ${selected.name}]`);
      }
    } else if (['pdf', 'pptx', 'docx', 'xlsx', 'odt', 'odp', 'ods'].includes(ext)) {
      setFileContent(`⏳ Extracting text from ${selected.name} via Document Extraction Engine...`);
      try {
        const formData = new FormData();
        formData.append('file', selected);
        formData.append('projectSlug', project.slug || project.course_code || 'default');
        const extractRes = await fetch('/api/extract', { method: 'POST', body: formData });
        const extractData = await extractRes.json();
        if (extractData.success && extractData.text) {
          setFileContent(extractData.text);
        } else {
          setFileContent(`Attached File: ${selected.name} (${Math.round(selected.size / 1024)} KB)`);
        }
      } catch {
        setFileContent(`Attached File: ${selected.name} (${Math.round(selected.size / 1024)} KB)`);
      }
    } else {
      setFileContent(`[Document asset: ${selected.name} (${Math.round(selected.size / 1024)} KB)]`);
    }

    const auto = autoCategorizeDossier({ file_name: selected.name });
    if (auto.category) {
      setManualCategory(auto.category);
    }
  };

  const handleModalFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await processSingleFileForModal(selected);
  };

  const handleSwarmCategorizeAll = async () => {
    setAnalyzingSwarm(true);
    try {
      const updated = files.map((file) => {
        const auto = autoCategorizeDossier(file);
        return {
          ...file,
          category: auto.category || file.category,
          summary: auto.summary || file.summary,
          extracted_metadata: { ...file.extracted_metadata, ...auto.extracted_metadata }
        };
      });

      setFiles(updated);
      for (const item of updated) {
        await updateDossierFile(item.id, project.id, {
          category: item.category,
          summary: item.summary,
          extracted_metadata: item.extracted_metadata
        });
      }
    } catch (err) {
      console.error('Auto categorization error:', err);
    } finally {
      setAnalyzingSwarm(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this dossier file?')) return;
    setFiles(prev => prev.filter(f => f.id !== fileId));
    await deleteDossierFile(fileId, project.id);
  };

  const handleEditFile = (file: ProjectDossierFile) => {
    setEditingFile(file);
    setEditFileName(file.file_name);
    setEditCategory(file.category);
    setEditSummary(file.summary || '');
  };

  const handleSaveFileEdit = async () => {
    if (!editingFile) return;
    await updateDossierFile(editingFile.id, project.id, {
      file_name: editFileName,
      category: editCategory,
      summary: editSummary,
    });
    setEditingFile(null);
    loadFiles();
  };

  const filteredFiles = selectedCategory === 'ALL'
    ? files
    : files.filter(f => f.category === selectedCategory);

  return (
    <div 
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative space-y-6"
    >
      {/* Drag & Drop Full-Zone Overlay */}
      {isDraggingOver && (
        <div 
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="fixed inset-0 z-50 bg-sky-600/30 dark:bg-sky-950/70 backdrop-blur-md border-4 border-dashed border-sky-400 dark:border-sky-300 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-150 pointer-events-auto select-none cursor-copy"
        >
          <div className="w-24 h-24 rounded-3xl bg-white dark:bg-[#001530] text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-2xl mb-4 animate-bounce border border-sky-200 dark:border-sky-500/30 pointer-events-none">
            <UploadCloud className="w-12 h-12 pointer-events-none" />
          </div>
          <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white drop-shadow-md pointer-events-none">
            Drop Files to Ingest into Course Dossier
          </h3>
          <p className="text-sm text-slate-700 dark:text-sky-100/90 max-w-md mt-2 font-medium pointer-events-none">
            Release mouse to upload. Supports PDF, PPTX, Word (.docx), ChemDraw (.cdx), LaTeX (.tex), Exam Blueprints, and Markdown.
          </p>
        </div>
      )}

      {/* Success Notification Toast */}
      {dropToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white font-display font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-4 h-4" />
          <span>{dropToast}</span>
        </div>
      )}

      {/* LLM Model Response Speed-Aware Process Loading Meter */}
      <LlmProcessLoadingMeter
        isActive={meterActive}
        isComplete={meterComplete}
        processTitle={meterTitle}
        processSubtitle={meterSubtitle}
        activeAgent={meterAgent}
        currentPhaseText={meterPhaseText}
        phases={meterPhases}
      />

      {/* Hidden File Input for Native File Browser */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            await processFileList(e.target.files);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Header & Swarm Ingestion Controls */}
      <div className="bg-white dark:bg-[#001530]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm dark:shadow-2xl backdrop-blur-xl flex flex-col xl:flex-row xl:items-center justify-between gap-5 transition-colors">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-gold-400/10 border border-amber-500/30 dark:border-gold-400/30 flex items-center justify-center text-amber-700 dark:text-gold-400 shadow-sm">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-display font-extrabold text-slate-900 dark:text-white">
                Course Intake Dossier Hub
              </h2>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/70">
                {project.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
              Multi-disciplinary intake &amp; Assessment Blueprint matrix for automated Question Bank synthesis.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          {/* Secondary Utilities */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 bg-slate-50 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
            <button
              onClick={handleSwarmCategorizeAll}
              disabled={analyzingSwarm}
              className="flex-1 sm:flex-none px-3 py-2 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white font-display font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
              title="Categorize files using Swarm"
            >
              <Bot className="w-3.5 h-3.5 text-amber-500" />
              <span>{analyzingSwarm ? 'Running...' : 'Auto-Categorize'}</span>
            </button>
            <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-white/10 mx-0.5" />
            <button
              onClick={async () => {
                setDropToast('⏳ Syncing all dossier files to Obsidian Vault on disk...');
                try {
                  const res = await syncCourseToObsidian(organization || null, project, undefined, undefined, files);
                  if (res.success) {
                    setDropToast(`✅ Synchronized ${res.syncedCount || files.length} dossier files to Obsidian Vault!`);
                  } else {
                    setDropToast(`⚠️ Sync notice: ${res.error || res.message}`);
                  }
                } catch (e: any) {
                  setDropToast(`❌ Sync error: ${e.message}`);
                }
                setTimeout(() => setDropToast(null), 5000);
              }}
              className="flex-1 sm:flex-none px-3 py-2 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white font-display font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
              title="Write all dossier files directly to Obsidian Vault on disk"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
              <span>Sync to Obsidian</span>
            </button>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                setExtractingLectures(true);
                setMeterActive(true);
                setMeterComplete(false);
                setMeterTitle('AI Ingesting & Scheduling Course Sessions');
                setMeterSubtitle('Deconstructing Course Specs & Blueprints via SYLLABUS_ARCHITECT');
                setMeterAgent('SYLLABUS_ARCHITECT');
                setMeterPhases([
                  'Aggregating Course Specs, Blueprints & Question Banks',
                  'Dispatching to cognitive LLM matrix for syllabus deconstruction',
                  'Validating weekly pedagogical milestones & contact hours',
                  'Writing full lecture breakdown to Obsidian vault'
                ]);
                setDropToast('⏳ SYLLABUS_ARCHITECT AI analyzing Course Dossier via /api/llm/chat...');
                try {
                  const aiRes = await extractLecturesWithAi(project.id);
                  setMeterComplete(true);
                  if (aiRes.usedAi) {
                    setDropToast(`⚡ SYLLABUS_ARCHITECT synthesized ${aiRes.sessions.length} sessions from Course Dossier! (${aiRes.modelUsed})`);
                  } else {
                    setDropToast(`✅ Generated ${aiRes.sessions.length} sessions from Dossier! (${aiRes.modelUsed})`);
                  }
                  setTimeout(() => {
                    setMeterActive(false);
                    setMeterComplete(false);
                  }, 1200);
                  setTimeout(() => setDropToast(null), 6000);
                } catch (e: any) {
                  setDropToast(`Error: ${e.message}`);
                  setMeterActive(false);
                  setMeterComplete(false);
                  setTimeout(() => setDropToast(null), 5000);
                } finally {
                  setExtractingLectures(false);
                }
              }}
              disabled={extractingLectures}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-display font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5 whitespace-nowrap disabled:opacity-50"
              title="SYLLABUS_ARCHITECT AI: Analyze Course Specs, Blueprints & Slides to generate verified schedule"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-300 ${extractingLectures ? 'animate-spin' : ''}`} />
              <span>{extractingLectures ? 'AI Ingesting Schedule...' : '⚡ AI Ingest & Schedule'}</span>
            </button>
            <button
              onClick={handleCreateBlueprint}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 font-display font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/20 transition-all hover:-translate-y-0.5 whitespace-nowrap"
              title="Create or open Exam Blueprint Matrix for Question Bank generation"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Exam Blueprint</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-display font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Ingest File</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Drag & Drop Banner */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-amber-500 dark:border-white/15 dark:hover:border-gold-400/60 bg-slate-50/50 hover:bg-amber-50/30 dark:bg-black/20 dark:hover:bg-gold-400/[0.03] rounded-3xl p-6 transition-all text-center flex flex-col items-center justify-center gap-2 group select-none"
      >
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-gold-400 flex items-center justify-center group-hover:scale-110 transition-transform">
          <UploadCloud className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-display font-extrabold text-slate-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-gold-400 transition-colors">
            Drag &amp; Drop Course Files Here or Click to Browse
          </h4>
          <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
            PDF, PPTX, ChemDraw (.cdx), LaTeX (.tex), Exam Blueprints, Markdown, Images — Multi-file batch drop supported
          </p>
        </div>
      </div>

      {/* Extracted Visual Media Assets Strip */}
      {extractedAssetsCount > 0 && (
        <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-sky-500/10 border border-teal-500/20 dark:border-teal-400/20 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-display font-extrabold text-slate-900 dark:text-white">
                  {extractedAssetsCount} Extracted Visual Assets &amp; Figures
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                  Dossier/_assets
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">
                Diagrams, spectra, chemical formulas &amp; figures extracted from presentation slides and Word specs.
              </p>
            </div>
          </div>
          <Link
            href={`/dossier/validate?projectId=${project.id}&view=assets`}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-display font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition shrink-0 whitespace-nowrap"
          >
            <span>Inspect Media Gallery in Step 3</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Category Pills Bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-white text-slate-600 dark:bg-black/30 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-transparent'
          }`}
        >
          All Categories ({files.length})
        </button>

        {extractedAssetsCount > 0 && (
          <Link
            href={`/dossier/validate?projectId=${project.id}&view=assets`}
            className="px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700/50 hover:bg-teal-100 dark:hover:bg-teal-900/50"
            title={`Inspect ${extractedAssetsCount} extracted visual assets and diagrams in Step 3`}
          >
            <FlaskConical className="w-3.5 h-3.5 text-teal-500" />
            <span>Extracted Visual Assets ({extractedAssetsCount})</span>
          </Link>
        )}

        {(Object.keys(CATEGORY_CONFIG) as DossierFileCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg.icon;
          const count = files.filter(f => f.category === cat).length;
          if (count === 0 && selectedCategory !== cat) return null;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 ${
                selectedCategory === cat
                  ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-sm'
                  : 'bg-white text-slate-600 dark:bg-black/30 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cfg.label.split('/')[0]}</span>
              <span className="text-[10px] opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Dossier Files Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 dark:text-white/50 text-sm animate-pulse">
          Loading dossier files...
        </div>
      ) : filteredFiles.length === 0 ? (
        <div 
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="py-16 text-center bg-white dark:bg-[#001530]/60 rounded-3xl border border-slate-200 dark:border-white/10 p-8 space-y-4 shadow-sm"
        >
          <FolderArchive className="w-12 h-12 text-slate-300 dark:text-white/20 mx-auto" />
          <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">No files in this category</h3>
          <p className="text-sm text-slate-500 dark:text-white/60 max-w-md mx-auto">
            Drag &amp; drop files anywhere on this page, or create an Assessment Blueprint to generate question banks.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleCreateBlueprint}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Add Exam Blueprint
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white font-display font-bold rounded-xl text-xs inline-flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              Browse Files
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFiles.map((file) => {
            const cfg = CATEGORY_CONFIG[file.category] || CATEGORY_CONFIG.UNCLASSIFIED;
            const Icon = cfg.icon;
            const isBlueprint = file.category === 'ASSESSMENT_BLUEPRINT';

            return (
              <div
                key={file.id}
                className={`bg-white dark:bg-[#001530]/90 border rounded-3xl p-6 flex flex-col justify-between transition-all shadow-sm dark:shadow-2xl group ${
                  isBlueprint 
                    ? 'border-amber-400/80 dark:border-gold-400/50 hover:border-amber-500 shadow-amber-500/5'
                    : 'border-slate-200 dark:border-white/10 hover:border-amber-400 dark:hover:border-gold-400/40'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold border ${cfg.badge}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label.split('/')[0]}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-white/40 uppercase">
                      {file.file_size_bytes ? `${Math.round(file.file_size_bytes / 1024)} KB` : file.mime_type?.split('/')[1] || 'DOC'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-display font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-gold-400 transition-colors">
                      {file.file_name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-white/60 mt-1 line-clamp-2">
                      {file.summary || cfg.description}
                    </p>
                  </div>

                  {/* Blueprint Synthesis Callout */}
                  {isBlueprint && (
                    <button
                      onClick={() => setSelectedBlueprint(file)}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 font-display font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>⚡ Synthesize Question Bank</span>
                    </button>
                  )}

                  {/* Course Specification Extraction Callout */}
                  {file.category === 'COURSE_SPEC' && (
                    <button
                      onClick={() => handleExtractLecturesFromSpec(file)}
                      disabled={extractingLectures}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-display font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition"
                      title="Extract all lecture numbers and topics from this Course Specification"
                    >
                      <GraduationCap className={`w-3.5 h-3.5 ${extractingLectures ? 'animate-spin' : ''}`} />
                      <span>{extractingLectures ? 'Extracting Lectures...' : '🎓 Extract Lectures & Sync Schedule'}</span>
                    </button>
                  )}

                  {/* Metadata Chips */}
                  {file.extracted_metadata && Object.keys(file.extracted_metadata).length > 0 && (
                    <div className="p-3 bg-slate-50 dark:bg-black/30 rounded-2xl border border-slate-200 dark:border-white/5 space-y-1 text-xs">
                      {file.extracted_metadata.domain && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 dark:text-white/40">Domain:</span>
                          <span className="font-semibold text-slate-700 dark:text-white/90 truncate max-w-[150px]">{file.extracted_metadata.domain}</span>
                        </div>
                      )}
                      {file.extracted_metadata.target_questions && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 dark:text-white/40">Target Pool:</span>
                          <span className="font-mono text-amber-600 dark:text-gold-400 font-bold">{file.extracted_metadata.target_questions} Questions</span>
                        </div>
                      )}
                      {file.extracted_metadata.formulas_count && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 dark:text-white/40">Entities Detected:</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{file.extracted_metadata.formulas_count}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <span className="text-xs text-slate-400 dark:text-white/40">
                    {file?.created_at && !isNaN(new Date(file.created_at).getTime()) 
                      ? new Date(file.created_at).toLocaleDateString() 
                      : ''}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditFile(file)}
                      className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition rounded-lg hover:bg-sky-50 dark:hover:bg-sky-500/10"
                      title="Edit file"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      title="Delete file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 ml-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Indexed
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assessment Blueprint & Question Bank Synthesis Modal */}
      {selectedBlueprint && (
        <AssessmentBlueprintModal
          isOpen={Boolean(selectedBlueprint)}
          onClose={() => setSelectedBlueprint(null)}
          blueprintFile={selectedBlueprint}
          project={project}
          onGenerated={() => loadFiles()}
        />
      )}

      {/* Edit Modal */}
      {editingFile && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditingFile(null)}>
          <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Pencil className="w-5 h-5 text-sky-500" />
              Edit Dossier File
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">File Name</label>
                <input
                  value={editFileName}
                  onChange={(e) => setEditFileName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Disciplinary Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as DossierFileCategory)}
                  className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="COURSE_SPEC">Course Specification</option>
                  <option value="ASSESSMENT_BLUEPRINT">Exam &amp; Question Blueprint (جدول المواصفات)</option>
                  <option value="CASE_STUDY_BANK">Question Banks &amp; Exam Pools</option>
                  <option value="LEGACY_SLIDES">Legacy Slides</option>
                  <option value="CHEM_MOLECULAR">Chemical / Molecular</option>
                  <option value="MATH_EQUATIONS">Mathematical Equations</option>
                  <option value="DIAGRAMS_SCHEMATICS">Diagrams / Schematics</option>
                  <option value="LAB_CLINICAL_PROTOCOL">Lab / Clinical Protocol</option>
                  <option value="PEDAGOGY_RUBRIC">Pedagogy Rubric</option>
                  <option value="REFERENCE_EVIDENCE">Reference Evidence</option>
                  <option value="UNCLASSIFIED">Unclassified</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Summary / Description</label>
                <textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingFile(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 rounded-xl text-xs font-display font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFileEdit}
                className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl text-xs font-display font-extrabold shadow-sm transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingest Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-amber-500 dark:text-gold-400" />
                Ingest Multi-Disciplinary Source Material
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Modal Drag Drop Area */}
            <div 
              onClick={() => modalFileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                  await processSingleFileForModal(e.dataTransfer.files[0]);
                }
              }}
              className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-amber-500 dark:border-white/15 dark:hover:border-gold-400/60 bg-slate-50 dark:bg-black/20 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-1.5 transition-colors group"
            >
              <input
                ref={modalFileInputRef}
                type="file"
                onChange={handleModalFileSelected}
                className="hidden"
              />
              <FileUp className="w-6 h-6 text-slate-400 group-hover:text-amber-500 transition-colors" />
              <span className="text-xs font-display font-bold text-slate-700 dark:text-white/80">
                Click or Drop a file here from your PC
              </span>
              <span className="text-[10px] text-slate-400 dark:text-white/40">
                Auto-extracts text, file name, and recommended category
              </span>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                  File / Document Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic_Chemistry_Reactions.cdx or Exam_Blueprint_Matrix.json"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                  Disciplinary Category
                </label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as DossierFileCategory)}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  {(Object.keys(CATEGORY_CONFIG) as DossierFileCategory[]).map((cat) => (
                    <option key={cat} value={cat} className="bg-white dark:bg-[#001530] text-slate-900 dark:text-white">
                      {CATEGORY_CONFIG[cat].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                  Document Content (Text, JSON Blueprint, LaTeX, SMILES, SOP)
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste syllabus text, JSON blueprint table, LaTeX math formulas ($dC/dt = -ke*C$), SMILES strings, or lab procedures here..."
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                >
                  {uploading ? 'Ingesting...' : 'Add to Course Dossier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
