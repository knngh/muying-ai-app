import type { AuthoritySourceConfig } from '../../config/authority-sources';
import { shouldFilterAuthoritySourceUrl } from '../../utils/authority-source-url';
import type { AuthorityRawDocument, NormalizedAuthorityDocument } from '../authority-sync.service';
import {
  containsDeathRelatedTerms,
  isHighRiskOrClickbaitTitle,
  type AuthorityDocumentAdapter,
} from './base.adapter';
import { aapAdapter } from './aap.adapter';
import { acogAdapter } from './acog.adapter';
import { cdcAdapter } from './cdc.adapter';
import { chunyuAdapter } from './chunyu.adapter';
import { cmaKepuAdapter } from './cma-kepu.adapter';
import { cnHealthAdapter } from './cn-health.adapter';
import { dxyAdapter } from './dxy.adapter';
import { dayiAdapter } from './dayi.adapter';
import { familydoctorAdapter } from './familydoctor.adapter';
import { haodfAdapter } from './haodf.adapter';
import { kepuchinaAdapter } from './kepuchina.adapter';
import { mayoAdapter } from './mayo.adapter';
import { msdManualsAdapter } from './msd-manuals.adapter';
import { nhsAdapter } from './nhs.adapter';
import { whoAdapter } from './who.adapter';
import { yilianmeitiAdapter } from './yilianmeiti.adapter';
import { youlaiAdapter } from './youlai.adapter';

const adapters: AuthorityDocumentAdapter[] = [
  whoAdapter,
  cdcAdapter,
  aapAdapter,
  acogAdapter,
  nhsAdapter,
  mayoAdapter,
  msdManualsAdapter,
  cnHealthAdapter,
  cmaKepuAdapter,
  dxyAdapter,
  chunyuAdapter,
  youlaiAdapter,
  dayiAdapter,
  familydoctorAdapter,
  haodfAdapter,
  kepuchinaAdapter,
  yilianmeitiAdapter,
];

export function resolveAuthorityAdapter(
  source: AuthoritySourceConfig,
  raw: AuthorityRawDocument,
): AuthorityDocumentAdapter | undefined {
  return adapters.find((adapter) => adapter.supports(source, raw));
}

export function normalizeWithAuthorityAdapter(
  source: AuthoritySourceConfig,
  raw: AuthorityRawDocument,
): NormalizedAuthorityDocument | null {
  const adapter = resolveAuthorityAdapter(source, raw);
  const normalized = adapter ? adapter.normalize(source, raw) : null;
  if (!normalized) {
    return null;
  }

  if (shouldFilterAuthoritySourceUrl({
    source_id: normalized.sourceId,
    source_org: normalized.sourceOrg,
    source_url: normalized.sourceUrl,
    title: normalized.title,
    question: normalized.title,
  })) {
    return null;
  }

  // Drop high-sensitivity (death/stillbirth/grief) and clickbait/pseudo-medical
  // articles before they ever enter the authority knowledge pipeline so they
  // are not crawled into the published cache. Death-related terms in either
  // the title, the summary, or the article body are sufficient grounds to
  // skip the document entirely.
  if (isHighRiskOrClickbaitTitle(normalized.title)) {
    return null;
  }

  if (containsDeathRelatedTerms(`${normalized.summary || ''} ${normalized.contentText || ''}`)) {
    return null;
  }

  return normalized;
}
