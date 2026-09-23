import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { SOTA_2026_MODELS, DiscoveredModel } from '@/lib/llm-catalog';


export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { endpointUrl, groqApiKey } = body;

    const dynamicCatalog: DiscoveredModel[] = [...SOTA_2026_MODELS];
    const liveDiscovered: string[] = [];

    // 1. Live probe to local LM Studio / Ollama
    const base = (endpointUrl || 'http://localhost:1234/v1').replace(/\/$/, '');
    const endpointsToTry = [base];
    if (base.includes('localhost') || base.includes('127.0.0.1')) {
      endpointsToTry.push(base.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal'));
    }

    for (const candidateBase of endpointsToTry) {
      try {
        const hostUrl = candidateBase.replace(/\/v1$/, '');
        let v0Data: any = null;
        try {
          const v0Res = await fetch(`${hostUrl}/api/v0/models`, { signal: AbortSignal.timeout(2000) });
          if (v0Res.ok) v0Data = await v0Res.json();
        } catch {}

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${candidateBase}/models`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (data?.data && Array.isArray(data.data)) {
            data.data.forEach((m: any) => {
              const modelId = m.id || m.name;
              if (modelId && !dynamicCatalog.some(x => x.id === `local/lm-studio/${modelId}`)) {
                const v0Info = Array.isArray(v0Data?.data) ? v0Data.data.find((x: any) => x.id === modelId) : null;
                const isLoaded = v0Info ? v0Info.state === 'loaded' : false;
                const ctx = v0Info?.max_context_length ? `${Math.round(v0Info.max_context_length / 1024)}k` : 'Local';
                dynamicCatalog.unshift({
                  id: `local/lm-studio/${modelId}`,
                  name: `LM Studio: ${modelId}`,
                  provider: 'LM Studio (Local)',
                  isFree: true,
                  contextWindow: ctx,
                  badge: isLoaded ? '🟢 LOADED IN VRAM · LM Studio' : '⚪ ON DISK · MOUNTABLE',
                  endpointUrl: candidateBase,
                  discoveredLive: true
                });
                liveDiscovered.push(`LM Studio: ${modelId} (${isLoaded ? 'Loaded' : 'Disk'})`);
              }
            });
          }
          break;
        }
      } catch {}
    }

    // 2. Live probe to Groq if API key provided
    if (groqApiKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${groqApiKey}` },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (groqRes.ok) {
          const groqData = await groqRes.json();
          if (groqData?.data && Array.isArray(groqData.data)) {
            groqData.data.forEach((gm: any) => {
              if (gm.id && gm.active !== false) {
                const existing = dynamicCatalog.find(x => x.id === `groq/${gm.id}` || x.id === gm.id);
                if (existing) {
                  existing.badge = `🟢 VERIFIED ACTIVE · Groq LPU (${gm.context_window ? Math.round(gm.context_window / 1024) + 'k' : 'Active'})`;
                  existing.discoveredLive = true;
                } else {
                  dynamicCatalog.push({
                    id: `groq/${gm.id}`,
                    name: `${gm.id} (Groq Live)`,
                    provider: 'Groq',
                    isFree: true,
                    contextWindow: gm.context_window ? `${Math.round(gm.context_window / 1024)}k` : '128k',
                    badge: '🟢 LIVE DISCOVERED · Active in Groq account',
                    discoveredLive: true
                  });
                  liveDiscovered.push(`Groq: ${gm.id}`);
                }
              }
            });
          }
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: dynamicCatalog.length,
      liveDiscoveredCount: liveDiscovered.length,
      liveDiscovered,
      catalog: dynamicCatalog
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    count: SOTA_2026_MODELS.length,
    catalog: SOTA_2026_MODELS
  });
}
