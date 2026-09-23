export interface DiscoveredModel {
  id: string;
  name: string;
  provider: string;
  isFree: boolean;
  contextWindow: string;
  badge: string;
  endpointUrl?: string;
  discoveredLive?: boolean;
}

// Up-to-date 2026 Frontier & Open-Weight Model Registry
export const SOTA_2026_MODELS: DiscoveredModel[] = [
  // ─── 💻 LM STUDIO / LOCAL HARDWARE ───
  {
    id: 'local/lm-studio/active-model',
    name: 'LM Studio (Active Loaded Model)',
    provider: 'LM Studio (Local)',
    isFree: true,
    contextWindow: 'Auto (from LM Studio)',
    badge: 'LOCAL · Connected to LM Studio Host (Change dynamically in app)',
    endpointUrl: 'http://localhost:1234/v1'
  },
  {
    id: 'local/ollama/active-model',
    name: 'Local Ollama Server (localhost:11434)',
    provider: 'LM Studio (Local)',
    isFree: true,
    contextWindow: 'Auto (Ollama)',
    badge: 'LOCAL · Active Ollama instance',
    endpointUrl: 'http://localhost:11434/v1'
  },

  // ─── 🆓 GROQ LPU (2026 PRODUCTION LINEUP) ───
  {
    id: 'groq/openai/gpt-oss-120b',
    name: 'OpenAI GPT-OSS 120B (Groq LPU)',
    provider: 'Groq',
    isFree: true,
    contextWindow: '128k',
    badge: 'NEW 2026 · Groq Open-Weights Flagship · 300+ tok/s'
  },
  {
    id: 'groq/openai/gpt-oss-20b',
    name: 'OpenAI GPT-OSS 20B (Groq LPU)',
    provider: 'Groq',
    isFree: true,
    contextWindow: '128k',
    badge: 'NEW 2026 · Ultra-Fast Gate Checking · 500+ tok/s'
  },
  {
    id: 'groq/openai/gpt-oss-safeguard-20b',
    name: 'OpenAI GPT-OSS Safeguard 20B (Groq)',
    provider: 'Groq',
    isFree: true,
    contextWindow: '128k',
    badge: 'NEW 2026 · Trust, Safety & Boundary Auditing'
  },
  {
    id: 'groq/compound',
    name: 'Groq Compound AI (Web & Tool Integration)',
    provider: 'Groq',
    isFree: true,
    contextWindow: '128k',
    badge: 'NEW 2026 · Integrated Tools & Fast Execution'
  },
  {
    id: 'groq/deepseek-r1-distill-llama-70b',
    name: 'DeepSeek-R1 Distill Llama 70B (Groq)',
    provider: 'Groq',
    isFree: true,
    contextWindow: '128k',
    badge: 'VERIFIED · 300 tok/s LPU Deep Reasoning'
  },
  {
    id: 'groq/deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek-R1 Distill Qwen 32B (Groq)',
    provider: 'Groq',
    isFree: true,
    contextWindow: '128k',
    badge: 'VERIFIED · Math, Code & Cognitive Taxonomy'
  },
  {
    id: 'groq/qwen-3.6-27b',
    name: 'Qwen 3.6 27B Reasoning (Groq)',
    provider: 'Groq',
    isFree: true,
    contextWindow: '128k',
    badge: 'NEW 2026 · Native Thinking & Logic'
  },
  {
    id: 'groq/llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile (Groq)',
    provider: 'Groq',
    isFree: true,
    contextWindow: '128k',
    badge: 'HIGH-SPEED · High-Throughput Deck Synthesis'
  },

  // ─── 🆓 NVIDIA NIM (GPU ACCELERATED MICROSERVICES) ───
  {
    id: 'nvidia/deepseek-ai/deepseek-r1',
    name: 'DeepSeek-R1 Full 671B (NVIDIA NIM)',
    provider: 'NVIDIA',
    isFree: true,
    contextWindow: '64k',
    badge: 'FRONTIER · Full 671B Uncompressed Reasoning'
  },
  {
    id: 'nvidia/deepseek-ai/deepseek-v3',
    name: 'DeepSeek-V3 Full MoE (NVIDIA NIM)',
    provider: 'NVIDIA',
    isFree: true,
    contextWindow: '64k',
    badge: 'VERIFIED · General Multilingual MoE'
  },
  {
    id: 'nvidia/meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct (NVIDIA NIM)',
    provider: 'NVIDIA',
    isFree: true,
    contextWindow: '128k',
    badge: 'FREE DEVELOPER · High-Precision Instruction'
  },
  {
    id: 'nvidia/qwen/qwen2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B (NVIDIA NIM)',
    provider: 'NVIDIA',
    isFree: true,
    contextWindow: '32k',
    badge: 'VERIFIED · Code, LaTeX & Schematics'
  },
  {
    id: 'nvidia/mistralai/mistral-large-2-instruct',
    name: 'Mistral Large 2 123B (NVIDIA NIM)',
    provider: 'NVIDIA',
    isFree: true,
    contextWindow: '128k',
    badge: 'VERIFIED · Multilingual European Flagship'
  },

  // ─── 🌐 GOOGLE GEMINI (3.X & 2.5 FRONTIER LINEUP) ───
  {
    id: 'google/gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (Latest 2026 Frontier)',
    provider: 'Google',
    isFree: true,
    contextWindow: '1M',
    badge: 'SOTA SEPT 2026 · Ultra-Fast Multimodal & Agentic'
  },
  {
    id: 'google/gemini-3.7-flash',
    name: 'Gemini 3.7 Flash (Agentic & Code)',
    provider: 'Google',
    isFree: true,
    contextWindow: '1M',
    badge: 'NEW 2026 · Complex Multi-Step Pedagogical Workflows'
  },
  {
    id: 'google/gemini-3.5-pro',
    name: 'Gemini 3.5 Pro (Premium Reasoning)',
    provider: 'Google',
    isFree: false,
    contextWindow: '2M',
    badge: 'NEW 2026 · Premium Reasoning Flagship · 2M Context'
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro (Deep Think)',
    provider: 'Google',
    isFree: false,
    contextWindow: '2M',
    badge: 'STABLE 2026 · Native Thinking & Document Parsing'
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (Adaptive Speed)',
    provider: 'Google',
    isFree: true,
    contextWindow: '1M',
    badge: 'FREE TIER · Fast Multimodal & Low Latency'
  },
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash (Next-Gen Free Tier)',
    provider: 'Google',
    isFree: true,
    contextWindow: '1M',
    badge: 'FREE TIER · High-Throughput Ingestion'
  },

  // ─── 🧠 ANTHROPIC CLAUDE (5.X & 3.7 SERIES) ───
  {
    id: 'anthropic/claude-fable-5-1',
    name: 'Claude Fable 5.1 (Anthropic Flagship)',
    provider: 'Anthropic',
    isFree: false,
    contextWindow: '1M',
    badge: 'SOTA SEPT 2026 · High-Stakes Agentic Pedagogy & Coding'
  },
  {
    id: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5 (Adaptive Thinking)',
    provider: 'Anthropic',
    isFree: false,
    contextWindow: '1M',
    badge: 'NEW 2026 · Standard 1M Window · Daily Driver'
  },
  {
    id: 'anthropic/claude-opus-5',
    name: 'Claude Opus 5 (Enterprise Master)',
    provider: 'Anthropic',
    isFree: false,
    contextWindow: '1M',
    badge: 'NEW 2026 · Complex Agentic Architecture'
  },
  {
    id: 'anthropic/claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet (Hybrid Reasoning)',
    provider: 'Anthropic',
    isFree: false,
    contextWindow: '200k',
    badge: 'HYBRID REASONING · Toggle Dynamic Thinking'
  },
  {
    id: 'anthropic/claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (Pedagogy Master)',
    provider: 'Anthropic',
    isFree: false,
    contextWindow: '200k',
    badge: 'GOLD STANDARD · Bilingual Slide Decks & Rubrics'
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5 (High Speed)',
    provider: 'Anthropic',
    isFree: false,
    contextWindow: '200k',
    badge: 'HIGH SPEED · Instant Constraint Verification'
  },

  // ─── ⚡ OPENAI (REASONING & FRONTIER) ───
  {
    id: 'openai/o3',
    name: 'OpenAI o3 (Frontier Reasoning)',
    provider: 'OpenAI',
    isFree: false,
    contextWindow: '200k',
    badge: 'FRONTIER 2026 · Top-Tier Math & Scientific Logic'
  },
  {
    id: 'openai/o3-mini',
    name: 'OpenAI o3-mini (High-Speed Reasoning)',
    provider: 'OpenAI',
    isFree: false,
    contextWindow: '200k',
    badge: 'VERIFIED · Fast Chain-of-Thought & Coding'
  },
  {
    id: 'openai/o1',
    name: 'OpenAI o1 (Deep Deduction)',
    provider: 'OpenAI',
    isFree: false,
    contextWindow: '200k',
    badge: 'REASONING · Multi-Step Deductive Proofs'
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o Multimodal Omni',
    provider: 'OpenAI',
    isFree: false,
    contextWindow: '128k',
    badge: 'VERIFIED · Vision, Diagrams & Asset Synthesis'
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (Cost-Optimized)',
    provider: 'OpenAI',
    isFree: false,
    contextWindow: '128k',
    badge: 'VERIFIED · Lightweight Verification Gates'
  },

  // ─── 🐋 DEEPSEEK DIRECT ───
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek-R1 (Pure RL Reasoning)',
    provider: 'DeepSeek',
    isFree: false,
    contextWindow: '64k',
    badge: 'VERIFIED · Open-R1 Deep Thinking'
  },
  {
    id: 'deepseek/deepseek-v3',
    name: 'DeepSeek-V3 671B MoE',
    provider: 'DeepSeek',
    isFree: false,
    contextWindow: '64k',
    badge: 'VERIFIED · High-Efficiency MoE Architecture'
  }
];
