import { z } from 'zod';

export const checkFeatureBody = z.object({
  feature: z.enum(['ai_unlimited', 'continuous_chat', 'weekly_report', 'growth_export', 'stage_circle', 'ad_free']),
});
