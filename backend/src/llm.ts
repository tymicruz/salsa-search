// The only place that talks to an LLM. Give it a prompt, get back the model's JSON text.
// To switch providers, set LLM_PROVIDER in .env; nothing else changes.

export async function askLLM(prompt: string): Promise<string> {
  if (process.env.LLM_PROVIDER === 'openai') {
    return askOpenAI(prompt);
  }
  return askGemini(prompt);
}

// Gemini REST API: https://ai.google.dev/api/generate-content
async function askGemini(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }, // answer with JSON only
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// OpenAI Chat Completions: https://platform.openai.com/docs/api-reference/chat
async function askOpenAI(prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }, // answer with JSON only
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
