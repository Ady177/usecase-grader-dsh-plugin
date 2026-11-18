
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const callCounters = new WeakMap                          ();

/** Use the Runtime SDK model interface; provider credentials stay with the host. */
export async function callLlm(
  execution                  ,
  systemPrompt        ,
  userContent        ,
  temperature = 0.1,
)                  {
  execution.signal.throwIfAborted();
  const callNumber = (callCounters.get(execution) ?? 0) + 1;
  callCounters.set(execution, callNumber);
  const callRecord                                                          = {
    request: { messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], temperature },
  };
  let response                                                        ;
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

async function saveCallRecord(execution                  , index        , record         ) {
  execution.signal.throwIfAborted();
  const relativePath = `intermediate/model-calls/${String(index).padStart(3, '0')}.json`;
  const directory = join(execution.outputDirectory, 'intermediate', 'model-calls');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${String(index).padStart(3, '0')}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  await execution.addArtifact({ kind: 'intermediate', name: `${String(index).padStart(3, '0')}.json`, relativePath, mime: 'application/json' });
}

export function extractJson(text        )         {
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] ?? text;
}

export function parseJsonResponse   (text        )    {
  return JSON.parse(extractJson(text))     ;
}

export function extractDiagramOnly(text        )         {
  const index = text.indexOf('用例描述');
  return (index >= 0 ? text.slice(0, index) : text).trim();
}
