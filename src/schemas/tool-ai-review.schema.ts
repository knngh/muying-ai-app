import { z } from 'zod';

export const toolAIReviewBody = z.object({
  toolId: z.enum([
    'contractions', 'movement', 'weight', 'care', 'growth', 'packing',
    'vaccines', 'foods', 'diary', 'expenses',
  ]),
  stage: z.string().trim().max(40).optional(),
  records: z.array(z.object({
    date: z.string().trim().max(40),
    content: z.string().trim().min(1).max(300),
  }).strict()).min(1).max(40),
  consent: z.literal(true),
}).strict();
