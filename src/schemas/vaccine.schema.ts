import { z } from 'zod';

export const getVaccinesQuery = z.object({
  monthAge: z.coerce.number().int().min(0).max(216).optional(),
  category: z.string().min(1).max(50).optional(),
});
