/**
 * 中文权威源抓取诊断（只读）
 * ===========================
 *
 * 针对所有中文 authority sources 跑一次 discover→fetch→normalize 的"试运行"，
 * 把每一步的失败原因落到一份报告里。**不写 DB，不写 cache**。
 *
 * 用途：定位 nhc-fys/chinacdc/ndcpa/ncwch/mchscn/cnsoc/chinanutri/dxy/chunyu/
 * dayi/kepuchina/yilianmeiti/mayo-clinic-zh/msd-manuals-cn 等零产出源的具体卡点，给后续修复
 * 提供路线图。
 *
 * 运行：
 *   npx ts-node --transpile-only src/scripts/diagnose-authority-cn-sources.ts
 *
 * 可选环境变量：
 *   CN_DIAG_SOURCES=govcn-muying,nhc-fys   # 只跑指定源（逗号分隔）
 *   CN_DIAG_SAMPLES=3                       # 每源采样的文章数（默认 3）
 *   CN_DIAG_TIMEOUT_MS=15000                # 单请求超时
 *   CN_DIAG_OUTPUT=tmp/cn-source-diagnosis.json
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

import {
  AUTHORITY_SOURCES,
  type AuthoritySourceConfig,
} from '../config/authority-sources';
import { normalizeWithAuthorityAdapter } from '../services/authority-adapters';
import {
  evaluateAuthorityDocumentQuality,
  shouldPublishDocument,
} from '../services/authority-adapters/base.adapter';
import type { AuthorityRawDocument } from '../services/authority-sync.service';
import { __authoritySyncTestUtils } from '../services/authority-sync.service';

const {
  isAuthorityUrlMatched,
  extractSitemapLocUrls,
  extractIndexLinks,
  extractPaginationLinks,
  filterNestedSitemapCandidates,
  prioritizeAuthorityUrls,
} = __authoritySyncTestUtils;

const TIMEOUT_MS = Math.max(5000, Number(process.env.CN_DIAG_TIMEOUT_MS || 15000));
const SAMPLES = Math.max(1, Number(process.env.CN_DIAG_SAMPLES || 3));
const OUTPUT_FILE = process.env.CN_DIAG_OUTPUT
  || path.join(process.cwd(), 'tmp', 'cn-source-diagnosis.json');

const FILTER_IDS = (process.env.CN_DIAG_SOURCES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 只关心中文/CN 区域源
function isChineseSource(source: AuthoritySourceConfig): boolean {
  return source.language === 'zh' || source.region === 'CN';
}

function looksLikeSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

function isXmlSitemapUrl(url: string): boolean {
  return /\.xml(?:\.gz)?($|[?#])/i.test(url) || /sitemap/i.test(url) || /\.gz($|[?#])/i.test(url);
}

interface FetchResult {
  url: string;
  ok: boolean;
  status: number | null;
  bytes: number;
  charset: string | null;
  contentType: string | null;
  error?: string;
  bodyPreview?: string;
}

interface SampleResult {
  url: string;
  fetch: FetchResult;
  rawBodyLength: number;
  normalize: {
    decision: 'null' | 'document';
    publishStatus?: string;
    contentLength?: number;
    qualityReasons?: string[];
    title?: string;
    summarySnippet?: string;
  };
}

interface SourceDiagnosis {
  id: string;
  org: string;
  discoveryType: string;
  entryUrls: string[];
  enabled: boolean;
  entryFetch: FetchResult[];
  rawCandidateCount: number;
  filteredCandidateCount: number;
  sampleCandidates: string[];
  samples: SampleResult[];
  conclusion: string;
}

function detectCharset(headers: Headers, buffer: Buffer): string {
  const headerCharset = (headers.get('content-type') || '')
    .match(/charset=([^;]+)/i)?.[1]
    ?.trim()
    .toLowerCase();
  if (headerCharset) return headerCharset;

  if (buffer.length >= 2) {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
    if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
  }

  const head = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('latin1');
  const meta = head.match(/<meta[^>]+charset=["']?([^"';\s>]+)/i);
  if (meta) {
    const c = meta[1].toLowerCase();
    return c === 'gb2312' ? 'gbk' : c;
  }
  return 'utf-8';
}

async function fetchUrl(url: string, headers?: Record<string, string>): Promise<FetchResult & { rawBody?: string }> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml,application/json,text/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...headers,
      },
    });

    const ab = await response.arrayBuffer();
    let buf = Buffer.from(ab);
    const ct = response.headers.get('content-type') || '';
    const ce = response.headers.get('content-encoding') || '';

    if (/\.gz($|[?#])/i.test(url) || /gzip/i.test(ce) || /gzip|x-gzip/i.test(ct)) {
      try {
        buf = zlib.gunzipSync(buf);
      } catch {
        // .gz URL 但实际是裸 XML，忽略
      }
    }

    const charset = detectCharset(response.headers, buf);
    let body = '';
    try {
      body = new TextDecoder(charset).decode(buf);
    } catch {
      body = buf.toString('utf-8');
    }

    return {
      url,
      ok: response.ok,
      status: response.status,
      bytes: buf.length,
      charset,
      contentType: ct || null,
      bodyPreview: body.slice(0, 200).replace(/\s+/g, ' '),
      rawBody: body,
    };
  } catch (e) {
    return {
      url,
      ok: false,
      status: null,
      bytes: 0,
      charset: null,
      contentType: null,
      error: (e as Error).message,
    };
  }
}

function dropRawBody(r: FetchResult & { rawBody?: string }): FetchResult {
  // 报告里不保留全文，只保留预览
  const { rawBody: _omit, ...rest } = r;
  void _omit;
  return rest;
}

// API 候选抽取（govcn-* 用 ZUIXINZHENGCE.json / ZCJD_QZ.json 那种结构）
function extractApiCandidates(payload: unknown, source: AuthoritySourceConfig): string[] {
  const found = new Map<string, string>();
  function walk(node: unknown) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    const u = [rec.URL, rec.url, rec.link, rec.href].find(
      (v) => typeof v === 'string' && (v as string).trim()
    ) as string | undefined;
    const t = [rec.TITLE, rec.title, rec.name].find(
      (v) => typeof v === 'string' && (v as string).trim()
    ) as string | undefined;
    if (u) {
      try {
        const abs = new URL(u, source.baseUrl).toString();
        if (isAuthorityUrlMatched(abs, source, t || '')) {
          found.set(abs, t || '');
        }
      } catch {
        /* ignore */
      }
    }
    Object.values(rec).forEach(walk);
  }
  walk(payload);
  return Array.from(found.keys());
}

async function diagnoseSource(source: AuthoritySourceConfig): Promise<SourceDiagnosis> {
  const result: SourceDiagnosis = {
    id: source.id,
    org: source.org,
    discoveryType: source.discoveryType,
    entryUrls: source.entryUrls,
    enabled: source.enabled,
    entryFetch: [],
    rawCandidateCount: 0,
    filteredCandidateCount: 0,
    sampleCandidates: [],
    samples: [],
    conclusion: '',
  };

  // 1) 探测 entry URLs
  const allCandidates: string[] = [];
  let firstIndexPageBody: string | null = null;
  let firstIndexPageUrl: string | null = null;
  for (const entry of source.entryUrls) {
    const fr = await fetchUrl(
      entry,
      source.discoveryType === 'api' ? { Accept: 'application/json,text/plain,*/*' } : undefined
    );
    result.entryFetch.push(dropRawBody(fr));
    if (!fr.ok || !fr.rawBody) continue;

    if (source.discoveryType === 'sitemap') {
      const locs = extractSitemapLocUrls(fr.rawBody);
      if (looksLikeSitemapIndex(fr.rawBody)) {
        const nestedSitemaps = filterNestedSitemapCandidates(
          locs.filter((candidate) => isXmlSitemapUrl(candidate)),
          source,
        );

        for (const nested of nestedSitemaps.slice(0, source.maxPagesPerRun)) {
          const nestedFetch = await fetchUrl(nested);
          result.entryFetch.push(dropRawBody(nestedFetch));
          if (!nestedFetch.ok || !nestedFetch.rawBody) continue;

          allCandidates.push(...extractSitemapLocUrls(nestedFetch.rawBody));
        }
      } else {
        allCandidates.push(...locs);
      }
    } else if (source.discoveryType === 'api') {
      try {
        const json = JSON.parse(fr.rawBody);
        allCandidates.push(...extractApiCandidates(json, source));
      } catch (e) {
        result.entryFetch[result.entryFetch.length - 1].error = `json_parse_failed: ${(e as Error).message}`;
      }
    } else {
      // index_page
      const indexLinks = extractIndexLinks(fr.rawBody, source, entry);
      allCandidates.push(...indexLinks);
      const visited = new Set([entry]);
      const queue = extractPaginationLinks(fr.rawBody, source, entry);
      const maxIndexPages = Math.max(1, source.maxDiscoveryIndexPages || 3);

      while (queue.length > 0 && visited.size < maxIndexPages && allCandidates.length < source.maxPagesPerRun) {
        const current = queue.shift();
        if (!current || visited.has(current)) continue;
        visited.add(current);

        const pageFetch = await fetchUrl(current);
        result.entryFetch.push(dropRawBody(pageFetch));
        if (!pageFetch.ok || !pageFetch.rawBody) continue;

        allCandidates.push(...extractIndexLinks(pageFetch.rawBody, source, current));
        for (const next of extractPaginationLinks(pageFetch.rawBody, source, current)) {
          if (!visited.has(next) && !queue.includes(next)) {
            queue.push(next);
          }
        }
      }

      if (!firstIndexPageBody) {
        firstIndexPageBody = fr.rawBody;
        firstIndexPageUrl = entry;
      }
    }
  }

  // index_page 模式下 extractIndexLinks 内部已经用 anchor text 调用过
  // isAuthorityUrlMatched 过滤了；api 模式下 extractApiCandidates 也已过滤；
  // sitemap 模式下 extractSitemapLocUrls 是裸 loc 列表，需要这里再过滤。
  result.rawCandidateCount = allCandidates.length;

  let filtered: string[];
  if (source.discoveryType === 'sitemap') {
    filtered = Array.from(
      new Set(allCandidates.filter((u) => isAuthorityUrlMatched(u, source)))
    );
  } else {
    // index_page / api：上游已过滤过，去重即可
    filtered = Array.from(new Set(allCandidates));
  }
  const prioritized = prioritizeAuthorityUrls(filtered, source);
  result.filteredCandidateCount = prioritized.length;
  result.sampleCandidates = prioritized.slice(0, SAMPLES);

  // 如果 sitemap/api 没拿到任何 candidate，对 index_page 类型也试一下不带过滤的"裸链接"看看：
  if (
    result.filteredCandidateCount === 0
    && source.discoveryType === 'index_page'
    && firstIndexPageBody
    && firstIndexPageUrl
  ) {
    // 复用 extractIndexLinks 实现里的 filter；这里把 "未通过过滤" 的链接抽样几条用于诊断
    const allHrefs = Array.from(
      firstIndexPageBody.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)
    )
      .map((m) => {
        try {
          return new URL(m[1], firstIndexPageUrl as string).toString();
        } catch {
          return null;
        }
      })
      .filter((x): x is string => Boolean(x));
    const distinct = Array.from(new Set(allHrefs)).slice(0, 5);
    result.entryFetch[0].error =
      (result.entryFetch[0].error ? result.entryFetch[0].error + '; ' : '')
      + `index_page 解析到 ${allHrefs.length} 个原始链接但全部被过滤；前 5 个原链接：${distinct.join(' | ')}`;
  }

  // 3) 对前 N 个候选 URL 跑 fetch + normalize
  for (const sampleUrl of result.sampleCandidates) {
    const fr = await fetchUrl(sampleUrl);
    const rawBody = fr.rawBody || '';
    const sample: SampleResult = {
      url: sampleUrl,
      fetch: dropRawBody(fr),
      rawBodyLength: rawBody.length,
      normalize: { decision: 'null' },
    };

    if (fr.ok && rawBody) {
      const raw: AuthorityRawDocument = {
        sourceId: source.id,
        url: sampleUrl,
        httpStatus: fr.status || 200,
        contentType: fr.contentType || 'text/html',
        contentHash: '',
        fetchedAt: new Date().toISOString(),
        rawBody,
      };
      const normalized = normalizeWithAuthorityAdapter(source, raw);
      if (normalized) {
        const quality = evaluateAuthorityDocumentQuality(normalized);
        const finalStatus = shouldPublishDocument(normalized);
        sample.normalize = {
          decision: 'document',
          publishStatus: finalStatus,
          contentLength: normalized.contentText.length,
          qualityReasons: quality.reasons,
          title: normalized.title.slice(0, 100),
          summarySnippet: (normalized.summary || normalized.contentText)
            .slice(0, 150)
            .replace(/\s+/g, ' '),
        };
      } else {
        // normalize 返回 null —— 大多数情况下是 isMaternalInfantRelevant / nav / death-related
        sample.normalize = { decision: 'null' };
      }
    }

    result.samples.push(sample);
  }

  // 4) 给一句结论
  if (result.entryFetch.every((e) => !e.ok)) {
    result.conclusion = 'entry_url_unreachable';
  } else if (result.rawCandidateCount === 0) {
    result.conclusion = 'discovery_returned_zero_links';
  } else if (result.filteredCandidateCount === 0) {
    result.conclusion = 'all_links_filtered_out_by_isAuthorityUrlMatched';
  } else {
    const sampleFetchOk = result.samples.filter((s) => s.fetch.ok).length;
    const sampleNormalizedDoc = result.samples.filter((s) => s.normalize.decision === 'document').length;
    const samplePublished = result.samples.filter(
      (s) => s.normalize.publishStatus === 'published'
    ).length;
    if (sampleFetchOk === 0) {
      result.conclusion = 'sample_fetch_failed';
    } else if (sampleNormalizedDoc === 0) {
      result.conclusion = 'normalize_returned_null_for_all_samples';
    } else if (samplePublished === 0) {
      result.conclusion = 'normalize_ok_but_quality_gate_rejected';
    } else {
      result.conclusion = 'pipeline_works';
    }
  }

  return result;
}

async function main(): Promise<void> {
  let sources = AUTHORITY_SOURCES.filter(isChineseSource);
  if (FILTER_IDS.length > 0) {
    sources = sources.filter((s) => FILTER_IDS.includes(s.id));
  }

  console.log(`[diag] 待诊断中文源 ${sources.length} 个：${sources.map((s) => s.id).join(', ')}`);
  console.log(`[diag] 单请求超时 ${TIMEOUT_MS}ms，每源采样 ${SAMPLES} 条`);
  console.log('');

  const results: SourceDiagnosis[] = [];
  for (const source of sources) {
    process.stdout.write(`[${source.id}] ... `);
    const start = Date.now();
    try {
      const r = await diagnoseSource(source);
      results.push(r);
      console.log(
        `${r.conclusion} (raw=${r.rawCandidateCount}, filtered=${r.filteredCandidateCount}, samples=${r.samples.length}, ${Date.now() - start}ms)`
      );
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
      results.push({
        id: source.id,
        org: source.org,
        discoveryType: source.discoveryType,
        entryUrls: source.entryUrls,
        enabled: source.enabled,
        entryFetch: [],
        rawCandidateCount: 0,
        filteredCandidateCount: 0,
        sampleCandidates: [],
        samples: [],
        conclusion: `script_error: ${(e as Error).message}`,
      });
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');

  console.log('');
  console.log(`[diag] 报告已写入：${OUTPUT_FILE}`);
  console.log('');
  console.log('=== 结论汇总 ===');
  const grouped = new Map<string, string[]>();
  for (const r of results) {
    if (!grouped.has(r.conclusion)) grouped.set(r.conclusion, []);
    grouped.get(r.conclusion)!.push(r.id);
  }
  for (const [conclusion, ids] of grouped) {
    console.log(`  ${conclusion}: ${ids.join(', ')}`);
  }

  // 退出码非 0 表明仍有失败源；脚本仅作诊断不会改库
  process.exit(0);
}

main().catch((e) => {
  console.error('[diag] 未捕获异常：', e);
  process.exit(1);
});
