import { z } from 'zod';

export const analyticsEventNames = [
  'mini_program_app_download_click',
  'app_membership_exposure',
  'app_order_created',
  'app_payment_success',
  'app_weekly_report_open',
  'app_growth_archive_share',
] as const;

export const analyticsSources = ['app', 'mini_program'] as const;

export const createAnalyticsEventBody = z.object({
  eventName: z.enum(analyticsEventNames),
  source: z.enum(analyticsSources),
  page: z.string().min(1).max(100).optional(),
  clientId: z.string().min(8).max(64).optional(),
  sessionId: z.string().min(8).max(64).optional(),
  properties: z.record(z.any()).optional(),
});

export const analyticsFunnelQuery = z.object({
  rangeDays: z.coerce.number().int().min(1).max(30).default(7),
});
