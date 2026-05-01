import '../config/env';
import {
  warmPublishedAuthorityTranslations,
  type WarmAuthorityTranslationsOptions,
} from '../services/authority-translation.service';

function parseNonNegativeInt(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
}

function resolveSourceLanguage(value: string | undefined): WarmAuthorityTranslationsOptions['sourceLanguage'] {
  if (value === 'zh' || value === 'all') {
    return value;
  }

  return 'en';
}

async function main() {
  const options: WarmAuthorityTranslationsOptions = {
    limit: parseNonNegativeInt(process.env.LIMIT || process.env.AUTHORITY_TRANSLATION_SYNC_LIMIT),
    delayMs: parseNonNegativeInt(process.env.REQUEST_DELAY_MS || process.env.AUTHORITY_TRANSLATION_SYNC_DELAY_MS),
    sourceLanguage: resolveSourceLanguage(process.env.SOURCE_LANGUAGE || process.env.AUTHORITY_TRANSLATION_SYNC_SOURCE_LANGUAGE),
    slug: process.env.SLUG?.trim() || undefined,
  };

  const result = await warmPublishedAuthorityTranslations(options);
  console.log('[Authority Translation] prewarm result:', JSON.stringify(result, null, 2));

  if (result.selected > 0 && result.warmed === 0 && result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[Authority Translation] prewarm failed:', error);
  process.exit(1);
});
