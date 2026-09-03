import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { endpointUrl, apiKey } = await req.json();
    const base = (endpointUrl || 'http://localhost:1234/v1').replace(/\/$/, '');
    const targetUrl = `${base}/models`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json({
          connected: false,
          error: `HTTP ${response.status} from ${base}`
        }, { status: response.status });
      }

      const data = await response.json();
      const models = data?.data?.map((m: any) => m.id) || [];

      return NextResponse.json({
        connected: true,
        endpoint: base,
        models,
        activeModel: models[0] || 'Unknown Loaded Model'
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      return NextResponse.json({
        connected: false,
        error: `Cannot reach ${targetUrl}. Ensure LM Studio Server is started and listening on 0.0.0.0 (or localhost). Error: ${e.message}`
      });
    }
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message }, { status: 400 });
  }
}
