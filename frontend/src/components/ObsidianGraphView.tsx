'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Search,
  Filter,
  Sliders,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Download,
  Eye,
  Layers,
  Sparkles,
  FileText,
  Folder,
  Tag,
  ExternalLink,
  Info,
  X
} from 'lucide-react';
import { CourseProject, CourseSession, Organization, ProjectDossierFile } from '@/lib/types';
import { fetchDossierFiles } from '@/lib/supabase';

// Dynamically import ForceGraph2D with SSR disabled
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-[#070d18] text-slate-400 gap-3">
      <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
      <span className="font-display font-medium text-sm text-slate-300">Initializing Obsidian Knowledge Graph...</span>
    </div>
  )
});

export interface GraphNode {
  id: string;
  name: string;
  group: 'Projects' | 'Areas' | 'Resources' | 'Archive' | 'Sessions' | 'Tags' | 'Core';
  color: string;
  val: number; // size
  path?: string;
  type?: string;
  snippet?: string;
  tags?: string[];
  neighbors?: GraphNode[];
  links?: GraphLink[];
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  curvature?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface Props {
  org?: Organization | null;
  project?: CourseProject | null;
  sessions?: CourseSession[];
  dossierFiles?: ProjectDossierFile[];
  onOpenNote?: (filePath: string) => void;
  height?: number | string;
  isModal?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Projects: '#38bdf8', // Sky Blue
  Areas: '#a855f7',    // Purple
  Resources: '#f59e0b',// Amber / Gold
  Archive: '#94a3b8',  // Slate Gray
  Sessions: '#10b981', // Emerald Green
  Tags: '#ec4899',     // Pink / Rose
  Core: '#6366f1'      // Indigo
};

export default function ObsidianGraphView({
  org,
  project,
  sessions = [],
  dossierFiles = [],
  onOpenNote,
  height = 550,
  isModal = false
}: Props) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: typeof height === 'number' ? height : 550 });

  // Filter & Control States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({
    Projects: true,
    Areas: true,
    Resources: true,
    Archive: true,
    Sessions: true,
    Tags: true,
    Core: true
  });
  const [showLabels, setShowLabels] = useState<'always' | 'hover' | 'never'>('hover');
  const [showOrphans, setShowOrphans] = useState(true);
  const [showArrows, setShowArrows] = useState(true);
  const [particleSpeed, setParticleSpeed] = useState(2);
  const [chargeStrength, setChargeStrength] = useState(-180);
  const [linkDistance, setLinkDistance] = useState(60);
  const [showControls, setShowControls] = useState(!isModal);

  // Interaction States
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<any>>(new Set());

  // Measure container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || (typeof height === 'number' ? height : 550)
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  // Live Dossier Files State
  const [liveDossierFiles, setLiveDossierFiles] = useState<ProjectDossierFile[]>(dossierFiles || []);

  useEffect(() => {
    if (dossierFiles && dossierFiles.length > 0) {
      setLiveDossierFiles(dossierFiles);
    } else if (project?.id) {
      fetchDossierFiles(project.id).then((files) => {
        if (Array.isArray(files) && files.length > 0) {
          setLiveDossierFiles(files);
        }
      }).catch(() => {});
    }
  }, [dossierFiles, project?.id]);

  // Build authentic Obsidian Vault Graph Data from REAL uploaded dossier & session files
  const rawGraphData = useMemo<GraphData>(() => {
    const orgName = org?.name || 'Academic Institution';
    const projName = project?.name || 'Course Curriculum';
    const projCode = project?.course_code || project?.slug || 'CRS-101';
    const projSlug = project?.slug || 'active-course';

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    const addNode = (n: GraphNode) => {
      if (!nodeMap.has(n.id)) {
        nodeMap.set(n.id, n);
        nodes.push(n);
      }
    };

    const addLink = (source: string, target: string, label?: string) => {
      if (source && target && source !== target) {
        links.push({ source, target, label });
      }
    };

    // 1. Core Institution Root Hub
    const rootId = `org-${org?.id || 'main'}`;
    addNode({
      id: rootId,
      name: orgName,
      group: 'Core',
      color: CATEGORY_COLORS.Core,
      val: 26,
      path: `02_Areas/${org?.slug || 'institution'}/Brand_Identity_Contract.md`,
      type: 'Institution Knowledge Nexus',
      snippet: `Institutional governance, brand contracts, and accreditation quality gates for ${orgName}.`,
      tags: ['#institution', '#accreditation', '#governance']
    });

    // 2. Master Course Project Hub
    const projectId = `proj-${project?.id || 'main'}`;
    addNode({
      id: projectId,
      name: `${projCode}: ${projName}`,
      group: 'Projects',
      color: CATEGORY_COLORS.Projects,
      val: 22,
      path: `01_Projects/${projSlug}/Course_Overview.md`,
      type: 'Master Course Track',
      snippet: `${projName} (${projCode}) — ${project?.academic_term || 'Undergraduate'} · ${project?.credit_hours || 3} Credit Hours · ${project?.prerequisites || 'Prerequisites'}`,
      tags: ['#course', '#syllabus', '#accreditation']
    });
    addLink(rootId, projectId, 'authorizes');

    // 3. REAL Uploaded Course Dossier Files (Course Specs, Blueprints, Questions, Chem, Math, SOPs)
    const dossierNodeIds: string[] = [];
    const specNodeIds: string[] = [];
    const blueprintNodeIds: string[] = [];

    if (liveDossierFiles && liveDossierFiles.length > 0) {
      liveDossierFiles.forEach((df) => {
        const dfNodeId = `dossier-${df.id || df.file_name}`;
        dossierNodeIds.push(dfNodeId);

        let group: GraphNode['group'] = 'Resources';
        let val = 13;
        let color = CATEGORY_COLORS.Resources;

        if (df.category === 'COURSE_SPEC') {
          group = 'Projects';
          val = 16;
          color = '#38bdf8'; // Sky Blue
          specNodeIds.push(dfNodeId);
        } else if (df.category === 'ASSESSMENT_BLUEPRINT') {
          group = 'Projects';
          val = 16;
          color = '#f59e0b'; // Amber Gold
          blueprintNodeIds.push(dfNodeId);
        } else if (df.category === 'CASE_STUDY_BANK') {
          group = 'Resources';
          val = 14;
          color = '#10b981'; // Emerald
        } else if (df.category === 'CHEM_MOLECULAR' || df.category === 'MATH_EQUATIONS') {
          group = 'Resources';
          val = 13;
          color = '#ec4899'; // Pink
        } else if (df.category === 'LAB_CLINICAL_PROTOCOL') {
          group = 'Resources';
          val = 13;
          color = '#a855f7'; // Purple
        }

        addNode({
          id: dfNodeId,
          name: df.file_name,
          group,
          color,
          val,
          path: `01_Projects/${projSlug}/Dossier/${df.file_name}`,
          type: df.category.replace(/_/g, ' '),
          snippet: df.summary || `Course Intake Document (${df.category})`,
          tags: ['#dossier', `#${df.category.toLowerCase().replace(/_/g, '-')}`, `#${(df.extracted_metadata?.domain || 'curriculum').toLowerCase().replace(/[^a-z0-9]/g, '-')}`]
        });

        // Link Dossier Document to Course Project
        addLink(projectId, dfNodeId, 'contains_dossier_spec');
      });
    }

    // 4. Lecture Sessions Tier (Real Extracted Lectures)
    const activeSessions = sessions && sessions.length > 0 ? sessions : [];

    activeSessions.forEach((sess: CourseSession) => {
      const sessNodeId = `sess-${sess.id || sess.session_code}`;
      addNode({
        id: sessNodeId,
        name: `${sess.session_code}: ${sess.title || 'Lecture Session'}`,
        group: 'Sessions',
        color: CATEGORY_COLORS.Sessions,
        val: 15,
        path: `01_Projects/${projSlug}/${sess.session_code}/blueprint.md`,
        type: 'Lecture Session Unit',
        snippet: `${sess.title} — Stage: ${sess.current_stage || 'BRAND_SETUP'} (${sess.duration_minutes || 60} min)`,
        tags: ['#lecture', '#session', `#level-${sess.level || 1}`]
      });
      addLink(projectId, sessNodeId, 'curriculum_lecture');

      // Link Course Specs to each extracted session
      specNodeIds.forEach((specId) => {
        addLink(specId, sessNodeId, 'specifies_topic');
      });

      // Session Artifact Markdown Sub-Notes (PARA 01_Projects)
      const blueprintId = `note-${sess.id || sess.session_code}-blueprint`;
      addNode({
        id: blueprintId,
        name: `${sess.session_code} Blueprint.md`,
        group: 'Projects',
        color: CATEGORY_COLORS.Projects,
        val: 10,
        path: `01_Projects/${projSlug}/${sess.session_code}/blueprint.md`,
        type: 'Session Blueprint',
        snippet: `Pedagogical timeline, Bloom level ascent, and target ILOs for ${sess.title}.`,
        tags: ['#blueprint', '#bloom-tax', '#pedagogy']
      });
      addLink(sessNodeId, blueprintId, 'lesson_plan');

      // Link Master Blueprint to Session Blueprint
      blueprintNodeIds.forEach((bpId) => {
        addLink(bpId, blueprintId, 'matrix_weights');
      });

      const slidesId = `note-${sess.id || sess.session_code}-slides`;
      addNode({
        id: slidesId,
        name: `${sess.session_code} Slides-Source.md`,
        group: 'Projects',
        color: CATEGORY_COLORS.Projects,
        val: 10,
        path: `01_Projects/${projSlug}/${sess.session_code}/slides-source.md`,
        type: '16-Slide Deck Source',
        snippet: `Bilingual slide presentation source with mathematical/chemical notations for ${sess.title}.`,
        tags: ['#slides', '#presentation', '#bilingual']
      });
      addLink(sessNodeId, slidesId, 'generates');
      addLink(blueprintId, slidesId, 'pedagogical_alignment');

      const summaryId = `note-${sess.id || sess.session_code}-summary`;
      addNode({
        id: summaryId,
        name: `${sess.session_code} Home-Summary.md`,
        group: 'Projects',
        color: CATEGORY_COLORS.Projects,
        val: 9,
        path: `01_Projects/${projSlug}/${sess.session_code}/home-summary.md`,
        type: 'Student Review Handout',
        snippet: `Take-home review summary and self-assessment items for ${sess.title}.`,
        tags: ['#summary', '#review', '#practice-questions']
      });
      addLink(sessNodeId, summaryId, 'student_handout');

      const decisionsId = `note-${sess.id || sess.session_code}-decisions`;
      addNode({
        id: decisionsId,
        name: `${sess.session_code} Decisions.md`,
        group: 'Projects',
        color: CATEGORY_COLORS.Projects,
        val: 8,
        path: `01_Projects/${projSlug}/${sess.session_code}/decisions.md`,
        type: 'Agent Swarm Rationale',
        snippet: `Curriculum design trade-offs and script policy decisions for ${sess.title}.`,
        tags: ['#decisions', '#swarm-trace']
      });
      addLink(sessNodeId, decisionsId, 'records_rationale');
    });

    // 5. PARA 02_Areas Tier (Brand Contracts, Script Policies, Boundary Rules)
    const brandingId = 'area-branding';
    addNode({
      id: brandingId,
      name: 'Brand_Identity_Contract.md',
      group: 'Areas',
      color: CATEGORY_COLORS.Areas,
      val: 14,
      path: `02_Areas/${org?.slug || 'institution'}/Brand_Identity_Contract.md`,
      type: 'Brand & Quality Gate Standard',
      snippet: `Approved hex palettes, script ratios, and Lecturer Boundary isolation rules for ${orgName}.`,
      tags: ['#branding', '#quality-gates', '#script-policy']
    });
    addLink(rootId, brandingId, 'enforces');
    addLink(projectId, brandingId, 'styles');

    // 6. Interactive Pedagogical & Quality Tags as Knowledge Hubs
    const tagsList = ['#bloom-tax', '#bilingual-balance', '#accreditation', '#exam-blueprint', '#pharmacology', '#problem-solving'];
    tagsList.forEach((tagStr) => {
      const tagNodeId = `tag-${tagStr}`;
      addNode({
        id: tagNodeId,
        name: tagStr,
        group: 'Tags',
        color: CATEGORY_COLORS.Tags,
        val: 8,
        type: 'Obsidian Tag Index',
        snippet: `Semantic index linking all course notes tagged with ${tagStr}.`,
        tags: [tagStr]
      });

      if (tagStr === '#bloom-tax') {
        nodes.filter(n => n.name.includes('Blueprint')).forEach(b => addLink(b.id, tagNodeId));
      }
      if (tagStr === '#bilingual-balance') {
        nodes.filter(n => n.name.includes('Slides')).forEach(s => addLink(s.id, tagNodeId));
        addLink(brandingId, tagNodeId);
      }
      if (tagStr === '#exam-blueprint') {
        blueprintNodeIds.forEach(bp => addLink(bp, tagNodeId));
      }
      if (tagStr === '#accreditation') {
        addLink(projectId, tagNodeId);
        specNodeIds.forEach(sp => addLink(sp, tagNodeId));
      }
    });

    // Build neighbor graphs for fast lookup
    nodes.forEach(node => {
      node.neighbors = [];
      node.links = [];
    });
    links.forEach(link => {
      const sourceNode = nodeMap.get(typeof link.source === 'string' ? link.source : (link.source as any).id);
      const targetNode = nodeMap.get(typeof link.target === 'string' ? link.target : (link.target as any).id);
      if (sourceNode && targetNode) {
        sourceNode.neighbors!.push(targetNode);
        targetNode.neighbors!.push(sourceNode);
        sourceNode.links!.push(link);
        targetNode.links!.push(link);
      }
    });

    return { nodes, links };
  }, [org, project, sessions]);

  // Filtered Graph Data according to user settings
  const filteredData = useMemo<GraphData>(() => {
    let filteredNodes = rawGraphData.nodes.filter(node => {
      // Group toggle filter
      if (!selectedGroups[node.group]) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = node.name.toLowerCase().includes(q);
        const matchesTags = node.tags?.some(t => t.toLowerCase().includes(q));
        const matchesType = node.type?.toLowerCase().includes(q);
        if (!matchesName && !matchesTags && !matchesType) return false;
      }

      return true;
    });

    const activeNodeIds = new Set(filteredNodes.map(n => n.id));

    let filteredLinks = rawGraphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      return activeNodeIds.has(sourceId) && activeNodeIds.has(targetId);
    });

    // Orphan removal filter
    if (!showOrphans) {
      const connectedNodeIds = new Set<string>();
      filteredLinks.forEach(link => {
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        connectedNodeIds.add(sourceId);
        connectedNodeIds.add(targetId);
      });
      filteredNodes = filteredNodes.filter(n => connectedNodeIds.has(n.id) || n.group === 'Core');
    }

    return { nodes: filteredNodes, links: filteredLinks };
  }, [rawGraphData, selectedGroups, searchQuery, showOrphans]);

  // Node Hover Handlers
  const handleNodeHover = useCallback((node: any) => {
    setHoverNode(node || null);
    const newHighlightNodes = new Set<string>();
    const newHighlightLinks = new Set<any>();

    if (node) {
      newHighlightNodes.add(node.id);
      node.neighbors?.forEach((neighbor: any) => newHighlightNodes.add(neighbor.id));
      node.links?.forEach((link: any) => newHighlightLinks.add(link));
    }

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  }, []);

  // Node Click Handlers
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node || null);
    // Center camera on clicked node
    if (fgRef.current && node && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(1.8, 800);
    }
  }, []);

  // Reset Camera Zoom
  const handleZoomToFit = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(600, 50);
    }
  };

  // Zoom In / Out
  const handleZoom = (factor: number) => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom * factor, 400);
    }
  };

  // Export Screenshot
  const handleExportPng = () => {
    if (containerRef.current) {
      const canvas = containerRef.current.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `obsidian-graph-${project?.slug || 'vault'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    }
  };

  // Custom Canvas Node Drawing (Obsidian Glowing Halos)
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (!node || typeof node.x !== 'number' || typeof node.y !== 'number' || !Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      return;
    }

    const isHovered = hoverNode?.id === node.id;
    const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
    const isSelected = selectedNode?.id === node.id;

    const scale = Number.isFinite(globalScale) && globalScale > 0 ? globalScale : 1;
    const baseRadius = Math.max(3, Math.sqrt(Number.isFinite(node.val) ? node.val : 5) * 2.2);
    const radius = isHovered || isSelected ? baseRadius * 1.3 : baseRadius;
    const opacity = isHighlighted ? 1 : 0.15;

    // Glowing Halo around node
    if (isHighlighted && (isHovered || isSelected || node.group === 'Core' || node.group === 'Projects')) {
      const innerR = Math.max(0.1, radius * 0.5);
      const outerR = Math.max(innerR + 1, radius * 2.8);
      if (Number.isFinite(innerR) && Number.isFinite(outerR) && outerR > innerR) {
        try {
          const glow = ctx.createRadialGradient(node.x, node.y, innerR, node.x, node.y, outerR);
          glow.addColorStop(0, `${node.color || '#38bdf8'}99`);
          glow.addColorStop(1, `${node.color || '#38bdf8'}00`);
          ctx.beginPath();
          ctx.arc(node.x, node.y, outerR, 0, 2 * Math.PI, false);
          ctx.fillStyle = glow;
          ctx.fill();
        } catch {
          // Fallback if gradient calculation fails
        }
      }
    }

    // Node Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = isHighlighted ? (node.color || '#38bdf8') : '#47556944';
    ctx.globalAlpha = opacity;
    ctx.fill();

    // Border Ring
    if (isSelected || isHovered) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
    }

    // Node Label
    const shouldDrawLabel =
      showLabels === 'always' ||
      (showLabels === 'hover' && (isHovered || isSelected || scale > 1.2 || node.group === 'Core' || node.group === 'Projects'));

    if (shouldDrawLabel && isHighlighted && node.name) {
      const fontSize = Math.max(10 / scale, 3);
      ctx.font = `${isHovered || isSelected ? 'bold' : 'normal'} ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Label background pill
      const textWidth = ctx.measureText(node.name).width;
      const padding = 3 / scale;
      ctx.fillStyle = 'rgba(7, 13, 24, 0.85)';
      ctx.fillRect(
        node.x - textWidth / 2 - padding,
        node.y + radius + 4 / scale,
        textWidth + padding * 2,
        fontSize + padding * 2
      );

      // Label Text
      ctx.fillStyle = isHovered || isSelected ? '#fbbf24' : '#e2e8f0';
      ctx.fillText(node.name, node.x, node.y + radius + 4 / scale + fontSize / 2);
    }

    ctx.globalAlpha = 1;
  }, [hoverNode, highlightNodes, selectedNode, showLabels]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-[#070d18] shadow-2xl flex flex-col ${
        isModal ? 'h-full min-h-[500px]' : ''
      }`}
      style={{ height: isModal ? '100%' : dimensions.height }}
    >
      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-[#070d18]/95 via-[#070d18]/70 to-transparent backdrop-blur-sm pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm shadow-amber-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-display font-bold text-white tracking-wide">
                Obsidian Interactive Knowledge Graph
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {filteredData.nodes.length} Nodes · {filteredData.links.length} Links
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Force-directed visual graph of PARA Second Brain notes and curriculum links.
            </p>
          </div>
        </div>

        {/* Top Right Quick Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setShowControls(!showControls)}
            className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 border ${
              showControls
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-black/60 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showControls ? 'Hide Controls' : 'Graph Controls'}</span>
          </button>

          <button
            onClick={handleZoomToFit}
            className="p-2 rounded-xl bg-black/60 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition"
            title="Reset Camera (Zoom to Fit)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleExportPng}
            className="p-2 rounded-xl bg-black/60 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition"
            title="Export Graph as PNG Image"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Control & Filter Panel */}
      {showControls && (
        <div className="absolute top-16 left-4 z-20 w-72 max-h-[calc(100%-80px)] overflow-y-auto bg-[#001530]/90 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-xl space-y-4 text-xs animate-in fade-in slide-in-from-left-4 duration-200">
          
          {/* Search Box */}
          <div>
            <label className="text-[11px] font-display font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Search className="w-3 h-3 text-amber-400" /> Search Vault Nodes
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by title, tag, or type..."
                className="w-full pl-8 pr-3 py-1.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 text-xs"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Group Category Filters */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <span className="text-[11px] font-display font-bold text-slate-300 flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-amber-400" /> Filter Node Groups
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.keys(CATEGORY_COLORS).map((grp) => (
                <button
                  key={grp}
                  onClick={() =>
                    setSelectedGroups((prev) => ({
                      ...prev,
                      [grp]: !prev[grp]
                    }))
                  }
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center justify-between border transition ${
                    selectedGroups[grp]
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-black/30 border-white/5 text-slate-500 line-through'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[grp] }}
                    />
                    <span>{grp}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Display & Physics Controls */}
          <div className="space-y-3 border-t border-white/10 pt-3">
            <span className="text-[11px] font-display font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3 h-3 text-amber-400" /> Display & Physics
            </span>

            {/* Labels mode */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Node Labels</span>
              <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                {(['hover', 'always', 'never'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setShowLabels(mode)}
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition ${
                      showLabels === mode ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Show Orphans toggle */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Include Orphan Nodes</span>
              <input
                type="checkbox"
                checked={showOrphans}
                onChange={(e) => setShowOrphans(e.target.checked)}
                className="rounded border-white/20 bg-black/50 text-amber-500 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Link Repulsion Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Repulsion Force</span>
                <span>{Math.abs(chargeStrength)}</span>
              </div>
              <input
                type="range"
                min="-400"
                max="-50"
                step="10"
                value={chargeStrength}
                onChange={(e) => setChargeStrength(Number(e.target.value))}
                className="w-full accent-amber-400 h-1 bg-white/10 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Zoom & Tool Controls (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 bg-black/70 border border-white/10 rounded-2xl p-1.5 backdrop-blur-md shadow-xl">
        <button
          onClick={() => handleZoom(1.3)}
          className="p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(0.7)}
          className="p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomToFit}
          className="p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition"
          title="Zoom to Fit"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Node Inspector Pane (Slide-over / Bottom Sheet) */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-20 sm:right-auto sm:w-96 z-20 bg-[#001530]/95 border border-amber-400/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-xs space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedNode.color }}
              />
              <div className="truncate">
                <h4 className="font-display font-bold text-white truncate text-sm">
                  {selectedNode.name}
                </h4>
                <span className="text-[10px] text-amber-300/80 font-mono">
                  {selectedNode.type || selectedNode.group}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedNode.snippet && (
            <p className="text-slate-300 text-[11px] leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/5">
              {selectedNode.snippet}
            </p>
          )}

          {selectedNode.tags && selectedNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedNode.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-pink-500/10 border border-pink-500/20 text-pink-300 rounded-md text-[10px] font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
            <span className="text-slate-400 font-mono">
              📁 {selectedNode.path || 'Obsidian Vault Root'}
            </span>
            {selectedNode.path && onOpenNote && (
              <button
                onClick={() => onOpenNote(selectedNode.path!)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold rounded-lg transition flex items-center gap-1 shadow-sm"
              >
                <span>Read Note</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Force Graph Canvas */}
      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={filteredData}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node: any, color, ctx) => {
            if (!node || typeof node.x !== 'number' || typeof node.y !== 'number' || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
            ctx.fillStyle = color;
            const r = Math.max(5, Math.sqrt(Number.isFinite(node.val) ? node.val : 5) * 2.5);
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          linkColor={(link: any) =>
            highlightLinks.has(link)
              ? '#fbbf24'
              : 'rgba(255, 255, 255, 0.12)'
          }
          linkWidth={(link: any) => (highlightLinks.has(link) ? 2 : 0.75)}
          linkDirectionalParticles={showArrows ? 2 : 0}
          linkDirectionalParticleWidth={(link: any) => (highlightLinks.has(link) ? 3 : 1.5)}
          linkDirectionalParticleSpeed={0.004 * particleSpeed}
          linkDirectionalParticleColor={() => '#fbbf24'}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          cooldownTicks={120}
          backgroundColor="#070d18"
        />
      </div>
    </div>
  );
}

