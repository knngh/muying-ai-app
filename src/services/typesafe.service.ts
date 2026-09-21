import { z } from 'zod';

// Native protocol: https://docs.typesafe.ai/api
// Jev is a text-only decision model, not a chat/completions provider.
const API_URL = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_MODEL = 'jev-1.13.0';

export class TypeSafeError extends Error {
  constructor(
    public readonly code: 'CONFIGURATION' | 'INPUT' | 'HTTP' | 'NETWORK' | 'TIMEOUT' | 'RESPONSE',
    message: string,
    public readonly status?: number,
  ) { super(message); this.name = 'TypeSafeError'; }
}

const optionMap = z.record(z.string().min(1).max(100), z.string().min(1).max(2000))
  .refine(options => Object.keys(options).length >= 2 && Object.keys(options).length <= 255);
const questionMap = z.record(z.string().min(1).max(100), z.object({
  instructions: z.string().min(1).max(4000),
  options: optionMap,
})).refine(questions => Object.keys(questions).length >= 1 && Object.keys(questions).length <= 16);

export type JevChoiceQuestions = z.infer<typeof questionMap>;

const probability = z.number().finite().min(0).max(1);
const responseSchema = z.object({
  model: z.string().min(1).max(100),
  answers: z.record(z.object({
    type: z.literal('choice'), choice: z.string(), confidence: probability,
    probabilities: z.record(probability),
  })),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }),
});

export type JevChoiceResult = z.infer<typeof responseSchema>;

function isAbortError(error: unknown): boolean {
  // Fetch can reject with a DOMException from a different runtime realm.
  return typeof error === 'object' && error !== null && 'name' in error
    && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/** Returns decisions only. Callers must require review before creating tool records. */
export async function askJevChoices(state: string, questions: JevChoiceQuestions): Promise<JevChoiceResult> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new TypeSafeError('CONFIGURATION', 'TYPESAFE_API_KEY is not configured');
  const parsedQuestions = questionMap.safeParse(questions);
  if (typeof state !== 'string' || !state.trim() || state.length > 16000 || !parsedQuestions.success) {
    throw new TypeSafeError('INPUT', 'TypeSafe state or choice questions are invalid');
  }
  const body = JSON.stringify({
    model: process.env.TYPESAFE_MODEL?.trim() || DEFAULT_MODEL,
    state,
    questions: Object.fromEntries(Object.entries(parsedQuestions.data).map(([id, question]) => [id, {
      type: 'choice', instructions: question.instructions, criteria: question.options,
    }])),
  });
  if (Buffer.byteLength(body) > 65536) throw new TypeSafeError('INPUT', 'TypeSafe request exceeds the local size limit');

  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      // Do not retain or log upstream bodies: they may echo private inputs.
      await response.body?.cancel();
      throw new TypeSafeError('HTTP', `TypeSafe request failed (HTTP ${response.status})`, response.status);
    }
    try { payload = await response.json(); }
    catch (error) {
      if (isAbortError(error)) throw error;
      throw new TypeSafeError('RESPONSE', 'TypeSafe returned an invalid response');
    }
  } catch (error) {
    if (error instanceof TypeSafeError) throw error;
    if (isAbortError(error)) {
      throw new TypeSafeError('TIMEOUT', 'TypeSafe request timed out');
    }
    throw new TypeSafeError('NETWORK', 'TypeSafe connection failed');
  }

  const parsedResponse = responseSchema.safeParse(payload);
  if (!parsedResponse.success) throw new TypeSafeError('RESPONSE', 'TypeSafe returned an invalid response');
  const result = parsedResponse.data;
  if (Object.keys(result.answers).length !== Object.keys(parsedQuestions.data).length) {
    throw new TypeSafeError('RESPONSE', 'TypeSafe returned mismatched answers');
  }
  for (const [id, question] of Object.entries(parsedQuestions.data)) {
    const answer = result.answers[id];
    const options = Object.keys(question.options);
    if (!answer || !options.includes(answer.choice)
      || Object.keys(answer.probabilities).length !== options.length
      || !options.every(option => Object.hasOwn(answer.probabilities, option))
      || Math.abs(Object.values(answer.probabilities).reduce((sum, value) => sum + value, 0) - 1) > 0.02) {
      throw new TypeSafeError('RESPONSE', 'TypeSafe returned an invalid choice distribution');
    }
  }
  return result;
}
