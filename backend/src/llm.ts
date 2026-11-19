// The only place that talks to an LLM. Give it a prompt, get back the model's JSON text.
// The provider comes from LLM_PROVIDER in .env (default: claude-cli).
// Every call logs its tokens and an estimated cost, so test spending stays visible.
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { GoogleAuth } from 'google-auth-library';

export async function askLLM(prompt: string): Promise<string> {
  const provider = process.env.LLM_PROVIDER;
  if (provider === 'codex-cli') {
    return askCodexCli(prompt);
  }
  if (provider === 'openai') {
    return askOpenAI(prompt);
  }
  if (provider === 'vertex') {
    return askVertex(prompt);
  }
  if (provider === 'gemini') {
    return askGemini(prompt);
  }
  return askClaudeCli(prompt); // claude-cli, the default
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

// ---------- Subscription CLIs: LOCAL, OWNER-ONLY PROTOTYPING ----------
// These run a program installed on this Mac (Claude Code or Codex) with the owner's own subscription.
// They can't be deployed; anything deployed or multi-user must use a paid API provider above.

const CLI_TIMEOUT_MS = 120_000;

// Runs a program from the temp folder (away from the project), sends the prompt on stdin, returns stdout.
function runCli(name: string, bin: string, args: string[], prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: tmpdir(), timeout: CLI_TIMEOUT_MS });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject); // e.g. the program isn't installed
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${name} exited with ${code}: ${stderr || stdout}`));
    });
    child.stdin.end(prompt); // send the prompt, then close stdin so the program starts
  });
}

// The model sometimes wraps its JSON in ```json fences; strip them.
function stripFences(text: string): string {
  return text.trim().replace(/^```(json)?\s*|\s*```$/g, '');
}

// Claude Code: `claude -p`. Flags: --tools "" = no tools (text in, text out);
// --safe-mode = ignore CLAUDE.md, memory, MCP servers; --no-session-persistence = don't save the chat.
async function askClaudeCli(prompt: string): Promise<string> {
  const model = process.env.CLAUDE_MODEL || 'haiku';
  const args = ['-p', '--model', model, '--output-format', 'json', '--tools', '', '--no-session-persistence', '--safe-mode'];
  // Optional: how much Claude "thinks" before answering (low = faster). Unset = Claude Code's default.
  if (process.env.CLAUDE_EFFORT) args.push('--effort', process.env.CLAUDE_EFFORT);
  const data = JSON.parse(await runCli('claude-cli', process.env.CLAUDE_BIN || 'claude', args, prompt));

  // total_cost_usd is the API list-price equivalent; it counts against the subscription's limits, not billed.
  const modelName = Object.keys(data.modelUsage ?? {})[0] ?? model;
  const u = data.usage ?? {};
  const input = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const thinking = u.output_tokens_details?.thinking_tokens ?? 0; // part of output; Haiku's reasoning before answering
  console.log(
    `[claude-cli] ${modelName}: ${input} in, ${u.output_tokens ?? 0} out (${thinking} thinking), ` +
      `list-price equivalent ~$${(data.total_cost_usd ?? 0).toFixed(5)} (subscription, not billed)`,
  );
  return stripFences(String(data.result ?? ''));
}

// Codex: `codex exec`, reading the prompt from stdin ("-"). Flags: --sandbox read-only = it can't change files;
// --ephemeral = don't save the session; --ignore-user-config = skip ~/.codex/config.toml (MCP servers etc.),
// login still works; --json = one JSON event per line, so the answer and token counts are easy to find.
// --disable ... = turn off its shell, browser, apps and image tools (text in, text out), so a web page in the
// prompt can't trick it into reading local files.
const CODEX_TOOLS_OFF = ['shell_tool', 'unified_exec', 'browser_use', 'in_app_browser', 'apps', 'view_image'];

async function askCodexCli(prompt: string): Promise<string> {
  const args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral', '--ignore-user-config', '--json'];
  for (const feature of CODEX_TOOLS_OFF) args.push('--disable', feature);
  // Optional: how much Codex "thinks" before answering (low = faster). Unset = Codex's default.
  const effort = process.env.CODEX_EFFORT;
  if (effort && /^[a-z]+$/.test(effort)) args.push('-c', `model_reasoning_effort="${effort}"`);
  args.push('-'); // read the prompt from stdin
  if (process.env.CODEX_MODEL) args.unshift('-m', process.env.CODEX_MODEL); // empty = Codex's default model
  const stdout = await runCli('codex-cli', process.env.CODEX_BIN || 'codex', args, prompt);

  let answer = '';
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    const event = JSON.parse(line);
    if (event.item?.type === 'command_execution') {
      throw new Error('codex-cli ran a command even though tools are off; answer rejected');
    }
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
      answer = event.item.text; // keep the last message: that's the final answer
    }
    if (event.type === 'turn.failed') {
      throw new Error(`codex-cli failed: ${String(event.error?.message ?? '').slice(0, 200)}`);
    }
    if (event.type === 'turn.completed') {
      const u = event.usage ?? {};
      // Codex adds its own ~15k-token system prompt to every call, which is why batching matters here.
      console.log(
        `[codex-cli] ${process.env.CODEX_MODEL || 'default model'}, effort ${effort || 'default'}: ${u.input_tokens} in, ` +
          `${u.output_tokens} out (${u.reasoning_output_tokens ?? 0} reasoning) (subscription, not billed)`,
      );
    }
  }
  return stripFences(answer);
}
