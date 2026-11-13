

/** Use the Runtime SDK model interface; provider credentials stay with the host. */
export async function callLlm(
  execution                  ,
  systemPrompt        ,
  userContent        ,
  temperature = 0.1,
)                  {
  execution.signal.throwIfAborted();
  let response                                                        ;
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
