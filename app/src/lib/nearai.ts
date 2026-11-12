// NEAR AI Cloud: OpenAI-compatible chat completions with private inference (open models run in
// trusted execution environments). Server-side only; the key never reaches the browser.

export const NEARAI_URL = process.env.NEARAI_BASE_URL || "https://cloud-api.near.ai/v1";
export const NEARAI_MODEL = process.env.NEARAI_MODEL || "Qwen/Qwen3.6-35B-A3B-FP8";

export function nearAiReady(): boolean {
  return !!process.env.NEARAI_API_KEY;
}

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  text: string;
  model: string;
  id: string | null;
}

/** One chat completion. Strips any visible reasoning, keeps it short. */
export async function nearAiChat(messages: ChatMsg[], opts: { maxTokens?: number; timeoutMs?: number; temperature?: number } = {}): Promise<ChatResult> {
  const key = process.env.NEARAI_API_KEY;
  if (!key) throw new Error("NEAR AI is not configured");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetch(`${NEARAI_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: NEARAI_MODEL,
        messages,
        max_tokens: opts.maxTokens ?? 300,
        temperature: opts.temperature ?? 0.8,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error?.message ?? `NEAR AI error ${res.status}`);
    const raw: string = j?.choices?.[0]?.message?.content ?? "";
    const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^[\s\S]*<\/think>/, "").trim();
    return { text, model: j?.model ?? NEARAI_MODEL, id: j?.id ?? null };
  } finally {
    clearTimeout(t);
  }
}
