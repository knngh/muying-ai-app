import { z } from 'zod';

// An isolated official provider binding; never falls back to unrelated AI routes.
const URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-5.3';
const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().trim().min(1).max(12000) }) })).min(1),
});

export async function callToolReviewText(messages: Array<{ role: 'system' | 'user'; content: string }>) {
  const key = process.env.TOOL_REVIEW_GLM_API_KEY?.trim();
  if (!key) throw new Error('Tool review text provider is not configured');
  try {
    const response = await fetch(URL, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, messages, temperature: 0.2, max_tokens: 900, stream: false,
        response_format: { type: 'json_object' }, reasoning_effort: 'low',
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Tool review text provider request failed');
    }
    const data = responseSchema.parse(await response.json());
    return { answer: data.choices[0].message.content, route: { provider: 'zhipu', model: MODEL } };
  } catch {
    // No upstream body, exception or user record reaches logs or callers.
    throw new Error('Tool review text provider unavailable');
  }
}
