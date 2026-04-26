import { z } from 'zod';
import { ANALYTICS_CLIENT_SOURCES, ANALYTICS_EVENT_NAMES } from '../config/analytics-events';

export const analyticsEventNames = ANALYTICS_EVENT_NAMES;
export const analyticsSources = ANALYTICS_CLIENT_SOURCES;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const analyticsJsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(analyticsJsonValue).max(20),
  z.record(analyticsJsonValue),
]));

const analyticsProperties = z.record(analyticsJsonValue)
  .refine(value => Object.keys(value).length <= 30, 'properties 字段过多')
  .refine(value => JSON.stringify(value).length <= 4096, 'properties 过大');

export const createAnalyticsEventBody = z.object({
  eventName: z.enum(analyticsEventNames),
  source: z.enum(analyticsSources),
  page: z.string().min(1).max(100).optional(),
  clientId: z.string().min(8).max(64).optional(),
  sessionId: z.string().min(8).max(64).optional(),
  properties: analyticsProperties.optional(),
});

export const analyticsFunnelQuery = z.object({
  rangeDays: z.coerce.number().int().min(1).max(30).default(7),
});
