import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpointUrl, model, messages, temperature, max_tokens, apiKey } = body;

    const base = (endpointUrl || 'http://localhost:1234/v1').replace(/\/$/, '');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Auto-detect loaded model from LM Studio if model is 'default' or generic
    let targetModel = model;
    if (!targetModel || targetModel === 'default' || targetModel.includes('active-model')) {
      try {
        const modelsRes = await fetch(`${base}/models`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(3000)
        });
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const firstLoaded = modelsData?.data?.[0]?.id;
          if (firstLoaded) {
            targetModel = firstLoaded;
          }
        }
      } catch (e) {
        // Continue with fallback
      }
    }

    const targetUrl = `${base}/chat/completions`;
    const payload = {
      model: targetModel || 'qwen/qwen3.6-35b-a3b',
      messages: messages || [{ role: 'user', content: 'Hello' }],
      temperature: temperature !== undefined ? temperature : 0.3,
      max_tokens: max_tokens || 512,
      stream: false
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout for local models

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({
          success: false,
          error: `HTTP ${response.status} from ${base}: ${errText}`
        }, { status: response.status });
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || JSON.stringify(data);

      return NextResponse.json({
        success: true,
        content,
        model: data.model || targetModel,
        usage: data.usage
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      return NextResponse.json({
        success: false,
        error: `Could not connect to ${targetUrl}. Error: ${fetchErr?.message || fetchErr}`
      }, { status: 502 });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Invalid request body'
    }, { status: 400 });
  }
}
