// The only place that talks to an LLM. Give it a prompt, get back the model's JSON text.
// The provider comes from LLM_PROVIDER in .env, unless the caller names one (the compare script does).
// Every call logs its tokens and an estimated cost, so test spending stays visible.
import { GoogleAuth } from 'google-auth-library';

export type Provider = 'gemini' | 'vertex' | 'openai';

export async function askLLM(prompt: string, provider = process.env.LLM_PROVIDER): Promise<string> {
  if (provider === 'openai') {
    return askOpenAI(prompt);
  }
  if (provider === 'vertex') {
    return askVertex(prompt);
  }
  return askGemini(prompt);
}

// Paid-tier prices in USD per 1M tokens, only used for the logged estimate. Update them if the model changes.
// Gemini: https://ai.google.dev/gemini-api/docs/pricing   OpenAI: https://developers.openai.com/api/docs/pricing
const PRICES = {
  gemini: { input: 0.3, output: 2.5 }, // gemini-3.5-flash-lite
  vertex: { input: 0.3, output: 2.5 }, // gemini-3.5-flash-lite; assumed same as AI Studio, check the Vertex pricing page
  openai: { input: 0.1, output: 0.5 }, // gpt-6-luna
};

function logUsage(provider: Provider, model: string, input: number, output: number) {
  const cost = (input * PRICES[provider].input + output * PRICES[provider].output) / 1_000_000;
  console.log(`[${provider}] ${model}: ${input} in, ${output} out, ~$${cost.toFixed(5)}`);
}

// Gemini through AI Studio, with an API key: https://ai.google.dev/api/generate-content
async function askGemini(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  return callGemini('gemini', model, url, { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' }, prompt);
}

// Gemini through Google Cloud Vertex AI, logged in with Application Default Credentials (no API key).
// ADC = the login saved by `gcloud auth application-default login`; google-auth-library reads it and makes access tokens.
const googleAuth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });

async function askVertex(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  const token = await googleAuth.getAccessToken(); // cached and refreshed by the library
  return callGemini('vertex', model, url, { Authorization: `Bearer ${token}` }, prompt);
}

// AI Studio and Vertex take the same request and send back the same response; only the URL and login differ.
async function callGemini(provider: Provider, model: string, url: string, auth: Record<string, string>, prompt: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json', // answer with JSON only
        thinkingConfig: { thinkingLevel: 'minimal' }, // least "thinking" = fewest billed tokens
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`${provider} ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();

  // Thinking tokens are billed as output.
  const usage = data.usageMetadata ?? {};
  logUsage(provider, model, usage.promptTokenCount ?? 0, (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0));
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// OpenAI Chat Completions: https://developers.openai.com/api/reference/overview
async function askOpenAI(prompt: string): Promise<string> {
  const model = process.env.OPENAI_MODEL || 'gpt-6-luna';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }, // answer with JSON only
      reasoning_effort: 'none', // no "thinking" = fewest billed tokens
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();

  // completion_tokens already includes reasoning tokens.
  logUsage('openai', model, data.usage?.prompt_tokens ?? 0, data.usage?.completion_tokens ?? 0);
  return data.choices?.[0]?.message?.content ?? '';
}
