import '../config/env';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/database';
import { getAuthoritySourceConfig } from '../config/authority-sources';
import {
  exportPublishedAuthoritySnapshot,
  ensureAuthoritySyncTables,
  type NormalizedAuthorityDocument,
} from '../services/authority-sync.service';
import {
  detectAudience,
  detectRiskLevelDefault,
  detectTopic,
  evaluateAuthorityDocumentQuality,
  shouldPublishDocument,
  stripHtml,
} from '../services/authority-adapters/base.adapter';

interface OcrCandidateRow {
  id: bigint;
  source_id: string;
  source_org: string;
  source_url: string;
  title: string;
  updated_at: Date | null;
  audience: string;
  topic: string;
  region: string;
  risk_level_default: string;
  summary: string;
  content_text: string;
  metadata_json: string | null;
  raw_body: string;
}

interface OcrSummary {
  dryRun: boolean;
  scanned: number;
  processed: number;
  published: number;
  review: number;
  rejected: number;
  skipped: number;
  failed: number;
  documents: Array<{
    id: number;
    sourceId: string;
    title: string;
    imageCount: number;
    ocrTextLength: number;
    publishStatus: NormalizedAuthorityDocument['publishStatus'];
    note?: string;
  }>;
}

const OCR_COMMAND = (process.env.AUTHORITY_OCR_COMMAND || '').trim();
const OCR_LIMIT = Math.max(1, Math.min(Number(process.env.AUTHORITY_OCR_LIMIT || 10), 100));
const OCR_MIN_TEXT_LENGTH = Math.max(40, Number(process.env.AUTHORITY_OCR_MIN_TEXT_LENGTH || 150));
const OCR_TIMEOUT_MS = Math.max(5000, Number(process.env.AUTHORITY_OCR_TIMEOUT_MS || 120000));
const OCR_SOURCE_ID = (process.env.AUTHORITY_SOURCE_ID || '').trim();
const OCR_FORCE = /^true$/i.test(process.env.AUTHORITY_OCR_FORCE || '');
const OCR_DRY_RUN = /^true$/i.test(process.env.AUTHORITY_OCR_DRY_RUN || '');
const OCR_TMP_DIR = path.join(process.cwd(), 'tmp', 'authority-ocr');

function parseMetadata(input: string | null): Record<string, unknown> {
  if (!input) {
    return {};
  }

  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function decodeHtmlAttribute(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeOcrText(input: string): string {
  return input
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function getSourceContentFragments(sourceId: string, rawBody: string): string[] {
  const candidates: Array<string | undefined> = [];

  if (sourceId === 'ncwch-maternal-child-health') {
    candidates.push(
      rawBody.match(/<div[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>\s*<p>/i)?.[1],
      rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
    );
  } else if (sourceId === 'mchscn-monitoring') {
    candidates.push(
      rawBody.match(/<div[^>]+class=["'][^"']*news-show[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]+style=|<\/div>\s*<div class=["']clr)/i)?.[1],
    );
  } else if (sourceId === 'cnsoc-dietary-guidelines') {
    candidates.push(
      rawBody.match(/<div[^>]+class=["'][^"']*\bcon\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1],
      rawBody.match(/<div[^>]+class=["'][^"']*news-show[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1],
    );
  } else if (sourceId === 'chinanutri-maternal-child') {
    candidates.push(
      rawBody.match(/<div[^>]+id=["']UCAP-CONTENT["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
      rawBody.match(/<div[^>]+class=["'][^"']*(TRS_Editor|trs_editor_view|article-content|wp_articlecontent)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
    );
  }

  const fragments = candidates.filter(Boolean) as string[];
  return fragments.length > 0 ? fragments : [rawBody];
}

function extractImageUrls(sourceUrl: string, sourceId: string, rawBody: string): string[] {
  const urls = new Set<string>();

  for (const fragment of getSourceContentFragments(sourceId, rawBody)) {
    for (const match of fragment.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
      const rawSrc = decodeHtmlAttribute(match[1] || '').trim();
      if (!rawSrc || /^data:/i.test(rawSrc)) {
        continue;
      }

      try {
        const resolved = new URL(rawSrc, sourceUrl).toString();
        if (!/\.(?:png|jpe?g|webp|gif|bmp)(?:$|[?#])/i.test(resolved)) {
          continue;
        }
        if (/(?:logo|icon|sprite|qrcode|qr|wechat|weixin|footer|banner|nav|search)/i.test(resolved)) {
          continue;
        }
        urls.add(resolved);
      } catch {
        // Ignore malformed image URLs from page chrome.
      }
    }
  }

  return Array.from(urls);
}

function parseCommandTemplate(command: string, inputPath: string): { executable: string; args: string[] } {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(command)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }

  if (tokens.length === 0) {
    throw new Error('AUTHORITY_OCR_COMMAND is empty');
  }

  const rendered = tokens.map((token) => token.replace(/\{input\}/g, inputPath));
  if (!command.includes('{input}')) {
    rendered.push(inputPath);
  }

  return {
    executable: rendered[0],
    args: rendered.slice(1),
  };
}

function runOcrCommand(inputPath: string): Promise<string> {
  const { executable, args } = parseCommandTemplate(OCR_COMMAND, inputPath);

  return new Promise((resolve, reject) => {
    execFile(executable, args, {
      timeout: OCR_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}${stderr ? `\n${stderr}` : ''}`));
        return;
      }

      resolve(normalizeOcrText(`${stdout || ''}\n${stderr || ''}`));
    });
  });
}

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  const response = await fetch(url, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 AuthorityKnowledgeOCR/1.0',
    },
  });

  if (!response.ok) {
    return false;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!/^image\//i.test(contentType)) {
    return false;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    return false;
  }

  await fs.writeFile(outputPath, buffer);
  return true;
}

async function loadCandidates(): Promise<OcrCandidateRow[]> {
  const sourceSql = OCR_SOURCE_ID ? 'AND n.source_id = ?' : '';
  const params = OCR_SOURCE_ID ? [OCR_SOURCE_ID, OCR_LIMIT] : [OCR_LIMIT];

  return prisma.$queryRawUnsafe<OcrCandidateRow[]>(
    `SELECT
       n.id,
       n.source_id,
       n.source_org,
       n.source_url,
       n.title,
       n.updated_at,
       n.audience,
       n.topic,
       n.region,
       n.risk_level_default,
       n.summary,
       n.content_text,
       n.metadata_json,
       r.raw_body
     FROM authority_normalized_documents n
     JOIN authority_raw_documents r
       ON r.id = (
         SELECT rr.id
         FROM authority_raw_documents rr
         WHERE rr.source_id = n.source_id
           AND rr.url = n.source_url
         ORDER BY rr.fetched_at DESC, rr.id DESC
         LIMIT 1
       )
     WHERE n.publish_status = 'rejected'
       AND (n.metadata_json LIKE '%"ocrCandidate":true%' OR n.metadata_json LIKE '%"ocrCandidate": true%')
       ${sourceSql}
     ORDER BY n.updated_at DESC, n.id DESC
     LIMIT ?`,
    ...params,
  );
}

async function updateCandidate(
  row: OcrCandidateRow,
  contentText: string,
  ocrText: string,
  imageCount: number,
  note?: string,
): Promise<NormalizedAuthorityDocument['publishStatus']> {
  const source = getAuthoritySourceConfig(row.source_id);
  const metadata = {
    ...parseMetadata(row.metadata_json),
    ocrCandidate: true,
    ocrProcessedAt: new Date().toISOString(),
    ocrEngine: OCR_COMMAND.split(/\s+/)[0] || 'external',
    ocrTextLength: ocrText.length,
    ocrImageCount: imageCount,
    ...(note ? { ocrNote: note } : {}),
  };
  const riskLevelDefault = detectRiskLevelDefault(`${row.title} ${row.summary} ${contentText}`);
  const document: NormalizedAuthorityDocument = {
    sourceId: row.source_id,
    sourceOrg: row.source_org,
    sourceUrl: row.source_url,
    sourceLanguage: row.region === 'CN' ? 'zh' : undefined,
    sourceLocale: row.region === 'CN' ? 'zh-CN' : undefined,
    title: row.title,
    updatedAt: row.updated_at?.toISOString(),
    audience: source ? detectAudience({
      sourceUrl: row.source_url,
      title: row.title,
      summary: row.summary,
      contentText,
    }, source) : row.audience,
    topic: source ? detectTopic({
      sourceUrl: row.source_url,
      title: row.title,
      summary: row.summary,
      contentText,
    }, source) : row.topic,
    region: row.region,
    riskLevelDefault,
    summary: stripHtml(contentText).slice(0, 300),
    contentText,
    metadataJson: metadata,
    publishStatus: 'draft',
  };
  const quality = evaluateAuthorityDocumentQuality(document);
  document.publishStatus = ocrText.length >= OCR_MIN_TEXT_LENGTH && quality.decision === 'pass'
    ? shouldPublishDocument(document)
    : 'rejected';

  if (!OCR_DRY_RUN) {
    await prisma.$executeRawUnsafe(
      `UPDATE authority_normalized_documents
       SET audience = ?,
           topic = ?,
           risk_level_default = ?,
           summary = ?,
           content_text = ?,
           metadata_json = ?,
           publish_status = ?
       WHERE id = ?`,
      document.audience,
      document.topic,
      document.riskLevelDefault,
      document.summary,
      document.contentText,
      JSON.stringify(document.metadataJson),
      document.publishStatus,
      row.id,
    );
  }

  return document.publishStatus;
}

async function processCandidate(row: OcrCandidateRow, summary: OcrSummary): Promise<void> {
  const metadata = parseMetadata(row.metadata_json);
  if (metadata.ocrProcessedAt && !OCR_FORCE) {
    summary.skipped += 1;
    summary.documents.push({
      id: Number(row.id),
      sourceId: row.source_id,
      title: row.title,
      imageCount: 0,
      ocrTextLength: Number(metadata.ocrTextLength || 0),
      publishStatus: 'rejected',
      note: 'already_processed',
    });
    return;
  }

  const imageUrls = extractImageUrls(row.source_url, row.source_id, row.raw_body);
  if (imageUrls.length === 0) {
    const publishStatus = await updateCandidate(row, row.content_text, '', 0, 'no_images');
    summary.skipped += 1;
    summary.documents.push({
      id: Number(row.id),
      sourceId: row.source_id,
      title: row.title,
      imageCount: 0,
      ocrTextLength: 0,
      publishStatus,
      note: 'no_images',
    });
    return;
  }

  if (!OCR_COMMAND) {
    summary.skipped += 1;
    summary.documents.push({
      id: Number(row.id),
      sourceId: row.source_id,
      title: row.title,
      imageCount: imageUrls.length,
      ocrTextLength: 0,
      publishStatus: 'rejected',
      note: 'missing_AUTHORITY_OCR_COMMAND',
    });
    return;
  }

  const docDir = path.join(OCR_TMP_DIR, String(row.id));
  await fs.mkdir(docDir, { recursive: true });

  const ocrChunks: string[] = [];
  let downloaded = 0;
  for (const [index, imageUrl] of imageUrls.entries()) {
    const extension = path.extname(new URL(imageUrl).pathname).replace(/[^.\w]/g, '') || '.jpg';
    const imagePath = path.join(docDir, `${String(index + 1).padStart(2, '0')}${extension}`);
    const ok = await downloadImage(imageUrl, imagePath);
    if (!ok) {
      continue;
    }

    downloaded += 1;
    const text = await runOcrCommand(imagePath);
    if (text) {
      ocrChunks.push(text);
    }
  }

  const ocrText = normalizeOcrText(ocrChunks.join('\n'));
  const contentText = normalizeOcrText([
    row.content_text,
    ocrText ? `OCR文本：\n${ocrText}` : '',
  ].filter(Boolean).join('\n\n'));
  const publishStatus = await updateCandidate(
    row,
    contentText,
    ocrText,
    downloaded,
    ocrText.length < OCR_MIN_TEXT_LENGTH ? 'insufficient_ocr_text' : undefined,
  );

  summary.processed += 1;
  if (publishStatus === 'published') {
    summary.published += 1;
  } else if (publishStatus === 'review') {
    summary.review += 1;
  } else if (publishStatus === 'rejected') {
    summary.rejected += 1;
  }

  summary.documents.push({
    id: Number(row.id),
    sourceId: row.source_id,
    title: row.title,
    imageCount: downloaded,
    ocrTextLength: ocrText.length,
    publishStatus,
  });
}

async function main() {
  await ensureAuthoritySyncTables();
  const rows = await loadCandidates();
  const summary: OcrSummary = {
    dryRun: OCR_DRY_RUN,
    scanned: rows.length,
    processed: 0,
    published: 0,
    review: 0,
    rejected: 0,
    skipped: 0,
    failed: 0,
    documents: [],
  };

  for (const row of rows) {
    try {
      await processCandidate(row, summary);
    } catch (error) {
      summary.failed += 1;
      summary.documents.push({
        id: Number(row.id),
        sourceId: row.source_id,
        title: row.title,
        imageCount: 0,
        ocrTextLength: 0,
        publishStatus: 'rejected',
        note: error instanceof Error ? error.message.slice(0, 300) : 'unknown_error',
      });
      console.error(`[Authority OCR] failed: ${row.source_id} -> ${row.source_url}`, error);
    }
  }

  if (!OCR_DRY_RUN && (summary.published > 0 || summary.review > 0)) {
    await exportPublishedAuthoritySnapshot();
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Authority OCR] failed:', error);
    process.exit(1);
  });
