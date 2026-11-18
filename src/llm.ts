import type { ExecutionContext } from '../vendor/runtime-sdk/lib/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const callCounters = new WeakMap<ExecutionContext, number>();

/** Use the Runtime SDK model interface; provider credentials stay with the host. */
export async function callLlm(
  execution: ExecutionContext,
  systemPrompt: string,
  userContent: string,
  temperature = 0.1,
): Promise<string> {
  execution.signal.throwIfAborted();
  const callNumber = (callCounters.get(execution) ?? 0) + 1;
  callCounters.set(execution, callNumber);
  const callRecord: { request: unknown; response?: string; error?: string } = {
    request: { messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], temperature },
  };
  let response: Awaited<ReturnType<ExecutionContext['model']['call']>>;
  try {
    response = await execution.model.call({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
    });
    callRecord.response = response.text;
  } catch (error) {
    callRecord.error = error instanceof Error ? error.message : String(error);
    try { await saveCallRecord(execution, callNumber, callRecord); } catch { /* Keep the original model/cancellation error. */ }
    if (execution.signal.aborted) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`LLM接口调用失败：${message}`);
  }
  execution.signal.throwIfAborted();
  await saveCallRecord(execution, callNumber, callRecord);
  return response.text;
}

async function saveCallRecord(execution: ExecutionContext, index: number, record: unknown) {
  execution.signal.throwIfAborted();
  const relativePath = `intermediate/model-calls/${String(index).padStart(3, '0')}.json`;
  const directory = join(execution.outputDirectory, 'intermediate', 'model-calls');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${String(index).padStart(3, '0')}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  await execution.addArtifact({ kind: 'intermediate', name: `${String(index).padStart(3, '0')}.json`, relativePath, mime: 'application/json' });
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
