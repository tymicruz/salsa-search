// The only place that talks to an LLM. Give it a prompt, get back the model's JSON text.
// The provider comes from LLM_PROVIDER in .env, unless the caller names one (the compare script does).
// Every call logs its tokens and an estimated cost, so test spending stays visible.
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { GoogleAuth } from 'google-auth-library';

export type Provider = 'gemini' | 'vertex' | 'openai' | 'claude-cli';

export async function askLLM(prompt: string, provider = process.env.LLM_PROVIDER): Promise<string> {
  if (provider === 'claude-cli') {
    return askClaudeCli(prompt);
  }
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

function logUsage(provider: keyof typeof PRICES, model: string, input: number, output: number) {
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
async function callGemini(provider: 'gemini' | 'vertex', model: string, url: string, auth: Record<string, string>, prompt: string) {
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

// The owner's Claude subscription, through Claude Code's non-interactive mode (`claude -p`).
// LOCAL PROTOTYPING ONLY: it runs the `claude` program installed on this Mac, so it can't be deployed.
// Flags: --tools "" = no tools (text in, text out); --safe-mode = ignore CLAUDE.md, memory, MCP servers;
// --no-session-persistence = don't save the chat to disk. Runs from the temp folder, away from the project.
const CLAUDE_TIMEOUT_MS = 120_000;

function askClaudeCli(prompt: string): Promise<string> {
  const model = process.env.CLAUDE_MODEL || 'haiku';
  const args = ['-p', '--model', model, '--output-format', 'json', '--tools', '', '--no-session-persistence', '--safe-mode'];

  return new Promise((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_BIN || 'claude', args, { cwd: tmpdir(), timeout: CLAUDE_TIMEOUT_MS });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject); // e.g. `claude` not found
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude-cli exited with ${code}: ${stderr || stdout}`));
        return;
      }
      const data = JSON.parse(stdout);
      // total_cost_usd is what the call would cost at API list price. It's counted against the
      // subscription's usage limits, not billed.
      const modelName = Object.keys(data.modelUsage ?? {})[0] ?? model;
      console.log(`[claude-cli] ${modelName}: list-price equivalent ~$${(data.total_cost_usd ?? 0).toFixed(5)} (subscription, not billed)`);
      // The model sometimes wraps its JSON in ```json fences; strip them.
      resolve(String(data.result ?? '').replace(/^```(json)?\s*|\s*```$/g, ''));
    });
    child.stdin.end(prompt); // send the prompt, then close stdin so claude starts
  });
}
