import { z } from 'zod';
import { ANALYTICS_CLIENT_SOURCES, ANALYTICS_EVENT_NAMES } from '../config/analytics-events';

export const analyticsEventNames = ANALYTICS_EVENT_NAMES;
export const analyticsSources = ANALYTICS_CLIENT_SOURCES;

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
