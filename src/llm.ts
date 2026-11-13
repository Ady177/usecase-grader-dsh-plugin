import type { ExecutionContext } from '../vendor/runtime-sdk/lib/index.js';

/** Use the Runtime SDK model interface; provider credentials stay with the host. */
export async function callLlm(
  execution: ExecutionContext,
  systemPrompt: string,
  userContent: string,
  temperature = 0.1,
): Promise<string> {
  execution.signal.throwIfAborted();
  let response: Awaited<ReturnType<ExecutionContext['model']['call']>>;
  try {
    response = await execution.model.call({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
    });
  } catch (error) {
    if (execution.signal.aborted) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`LLM接口调用失败：${message}`);
  }
  execution.signal.throwIfAborted();
  return response.text;
}

export function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] ?? text;
}

export function parseJsonResponse<T>(text: string): T {
  return JSON.parse(extractJson(text)) as T;
}

export function extractDiagramOnly(text: string): string {
  const index = text.indexOf('用例描述');
  return (index >= 0 ? text.slice(0, index) : text).trim();
}
