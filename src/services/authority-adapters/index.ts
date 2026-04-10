import type { AuthoritySourceConfig } from '../../config/authority-sources';
import type { AuthorityRawDocument, NormalizedAuthorityDocument } from '../authority-sync.service';
import type { AuthorityDocumentAdapter } from './base.adapter';
import { aapAdapter } from './aap.adapter';
import { acogAdapter } from './acog.adapter';
import { cdcAdapter } from './cdc.adapter';
import { chunyuAdapter } from './chunyu.adapter';
import { cnHealthAdapter } from './cn-health.adapter';
import { dxyAdapter } from './dxy.adapter';
import { familydoctorAdapter } from './familydoctor.adapter';
import { nhsAdapter } from './nhs.adapter';
import { whoAdapter } from './who.adapter';
import { youlaiAdapter } from './youlai.adapter';

const adapters: AuthorityDocumentAdapter[] = [
  whoAdapter,
  cdcAdapter,
  aapAdapter,
  acogAdapter,
  nhsAdapter,
  cnHealthAdapter,
  dxyAdapter,
  chunyuAdapter,
  youlaiAdapter,
  familydoctorAdapter,
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
  return adapter ? adapter.normalize(source, raw) : null;
}
