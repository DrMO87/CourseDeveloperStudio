namespace CourseDeveloper.Core.Enums;

public enum PipelineStage { BRAND_SETUP = 0, RECEIPT = 1, DIGEST = 2, BUNDLE = 3, ARTIFACTS = 4 }
public enum GateVerdict { PASS, FAIL, UNVERIFIED }
public enum AssetClass { REFERENCE, EVIDENCE, PHYSICAL_EVIDENCE, PROCEDURAL_SEQUENCE }
public enum ApprovalKind { specialist_council, owner_business, physical_action_required }

public enum InstitutionType
{
    University,
    Academy,
    School,
    Nursery,
    TrainingCenter
}

public enum DossierFileCategory
{
    COURSE_SPEC,            // Syllabus, ILOs, NARS/ABET/NAQAAE accreditation matrices
    LEGACY_SLIDES,          // Old lecture decks, previous PowerPoint slides
    CHEM_MOLECULAR,         // Chemical structures, reaction pathways, SMILES/InChI, pharmacology mechanisms
    MATH_EQUATIONS,         // LaTeX math formulations, differential equations, proofs, statistical models
    DIAGRAMS_SCHEMATICS,    // Scientific diagrams, circuits, anatomical illustrations, CAD/flowcharts
    LAB_CLINICAL_PROTOCOL,  // Wet lab SOPs, clinical protocols, hardware/OSCE manuals, experiment protocols
    PEDAGOGY_RUBRIC,        // Bloom's taxonomy & Miller's pyramid rubrics, assessment matrices
    CASE_STUDY_BANK,        // Clinical cases, business scenarios, problem sets, exam question pools
    REFERENCE_EVIDENCE,     // Supplementary textbooks, research papers, data tables
    UNCLASSIFIED            // Fresh intake awaiting swarm categorization
}
