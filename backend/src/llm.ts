// The only place that talks to an LLM. Give it a prompt, get back the model's JSON text.
// To switch providers, set LLM_PROVIDER in .env; nothing else changes.

export async function askLLM(prompt: string): Promise<string> {
  if (process.env.LLM_PROVIDER === 'openai') {
    return askOpenAI(prompt);
  }
  return askGemini(prompt);
}

// Paid-tier prices of gemini-3.5-flash-lite in USD per 1M tokens (https://ai.google.dev/gemini-api/docs/pricing).
// Only used for the cost estimate in the log; update them if GEMINI_MODEL changes.
const INPUT_PRICE = 0.3;
const OUTPUT_PRICE = 2.5; // thinking tokens are billed as output

// Gemini REST API: https://ai.google.dev/api/generate-content
async function askGemini(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json', // answer with JSON only
        thinkingConfig: { thinkingLevel: 'minimal' }, // least "thinking" = fewest billed tokens
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();

  // Log tokens and an estimated cost for every call, so test spending stays visible.
  const input = data.usageMetadata?.promptTokenCount ?? 0;
  const output = (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0);
  const cost = (input * INPUT_PRICE + output * OUTPUT_PRICE) / 1_000_000;
  console.log(`[gemini] ${model}: ${input} in, ${output} out, ~$${cost.toFixed(5)}`);

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
