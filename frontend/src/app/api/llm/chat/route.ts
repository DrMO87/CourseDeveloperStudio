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

    const endpointsToTry = [base];
    if (base.includes('localhost') || base.includes('127.0.0.1')) {
      endpointsToTry.push(base.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal'));
    }

    // Auto-detect loaded model from LM Studio if model is 'default' or generic
    let targetModel = model;
    if (targetModel && typeof targetModel === 'string') {
      targetModel = targetModel.replace(/^local\/lm-studio\//, '');
    }
    if (!targetModel || targetModel === 'default' || targetModel.includes('active-model')) {
      for (const candidate of endpointsToTry) {
        try {
          const modelsRes = await fetch(`${candidate}/models`, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(2000)
          });
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            const firstLoaded = modelsData?.data?.[0]?.id;
            if (firstLoaded) {
              targetModel = firstLoaded;
              break;
            }
          }
        } catch {
          // Continue
        }
      }
    }

    const payload = {
      model: targetModel || 'default',
      messages: messages || [{ role: 'user', content: 'Hello' }],
      temperature: temperature !== undefined ? temperature : 0.3,
      max_tokens: max_tokens || 4096,
      stream: false
    };

    let response: Response | null = null;
    let successfulBase = base;
    let lastError = '';

    for (const candidateBase of endpointsToTry) {
      const targetUrl = `${candidateBase}/chat/completions`;
      const controller = new AbortController();
      // Allow up to 5 minutes (300,000ms) for local models (e.g. 27B reasoning models at 5 t/s)
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      try {
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          response = res;
          successfulBase = candidateBase;
          break;
        } else {
          lastError = `HTTP ${res.status}`;
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        lastError = fetchErr?.message || 'Connection failed';
      }
    }

    if (!response) {
      return NextResponse.json({
        success: false,
        error: `Could not connect to LLM at ${base}. Error: ${lastError}`
      }, { status: 502 });
    }

    const data = await response.json();
    const choiceMsg = data?.choices?.[0]?.message;
    let content = choiceMsg?.content || '';

    // Handle reasoning models (Bonsai-27b, DeepSeek-R1, QwQ) where reasoning_content has the text
    if (!content.trim() && choiceMsg?.reasoning_content) {
      content = choiceMsg.reasoning_content;
    }
    if (!content.trim() && typeof data === 'object') {
      content = JSON.stringify(data);
    }

    return NextResponse.json({
      success: true,
      content,
      model: data.model || targetModel,
      usage: data.usage
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Invalid request body'
    }, { status: 400 });
  }
}
