import '../config/env';
import fs from 'fs';
import path from 'path';
import { buildKnowledgeGrowthSeeds, KNOWLEDGE_GROWTH_TRACKS } from '../config/knowledge-growth';

const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'knowledge-growth-seeds.json');

async function main() {
  const seeds = buildKnowledgeGrowthSeeds();
  const payload = {
    generatedAt: new Date().toISOString(),
    totalTracks: KNOWLEDGE_GROWTH_TRACKS.length,
    totalSeeds: seeds.length,
    bySurface: Object.entries(
      seeds.reduce<Record<string, number>>((acc, seed) => {
        for (const surface of seed.appSurfaces) {
          acc[surface] = (acc[surface] || 0) + 1;
        }
        return acc;
      }, {}),
    )
      .sort((left, right) => right[1] - left[1])
      .map(([surface, count]) => ({ surface, count })),
    byLifecycle: Object.entries(
      seeds.reduce<Record<string, number>>((acc, seed) => {
        for (const scope of seed.lifecycleScopes) {
          acc[scope] = (acc[scope] || 0) + 1;
        }
        return acc;
      }, {}),
    )
      .sort((left, right) => right[1] - left[1])
      .map(([scope, count]) => ({ scope, count })),
    seeds,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(JSON.stringify({
    generatedAt: payload.generatedAt,
    totalTracks: payload.totalTracks,
    totalSeeds: payload.totalSeeds,
    bySurface: payload.bySurface,
    byLifecycle: payload.byLifecycle,
    outputFile: OUTPUT_FILE,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Knowledge Growth Seeds] failed:', error);
    process.exit(1);
  });
