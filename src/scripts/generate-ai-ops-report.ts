import '../config/env';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { getAIOverview } from '../services/analytics.service';
import { buildAIOpsReport } from '../utils/ai-ops-report';

const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'ai-ops-report.json');
const RANGE_DAYS = Math.min(30, Math.max(1, Number(process.env.AI_OPS_RANGE_DAYS || 7)));
const STRICT = process.env.AI_OPS_STRICT === 'true';

async function main() {
  const overview = await getAIOverview(RANGE_DAYS);
  const report = buildAIOpsReport({
    overview,
    thresholds: {
      minServerRequestsForRate: process.env.AI_OPS_MIN_SERVER_REQUESTS
        ? Number(process.env.AI_OPS_MIN_SERVER_REQUESTS)
        : undefined,
      maxServerErrorRate: process.env.AI_OPS_MAX_ERROR_RATE
        ? Number(process.env.AI_OPS_MAX_ERROR_RATE)
        : undefined,
      maxAverageLatencyMs: process.env.AI_OPS_MAX_AVG_LATENCY_MS
        ? Number(process.env.AI_OPS_MAX_AVG_LATENCY_MS)
        : undefined,
      maxServerDegradedRate: process.env.AI_OPS_MAX_DEGRADED_RATE
        ? Number(process.env.AI_OPS_MAX_DEGRADED_RATE)
        : undefined,
      minServerWithSourcesRate: process.env.AI_OPS_MIN_SOURCE_RATE
        ? Number(process.env.AI_OPS_MIN_SOURCE_RATE)
        : undefined,
    },
  });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));

  if (STRICT && report.status !== 'ok') {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[AI Ops Report] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
