/** Run while authority/API/layout writers are paused. Defaults to a read-only plan. */
import '../config/env';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../config/database';
import { isAcogSource, stripAcogArticleChrome } from '../utils/acog-content';
import { buildAuthoritySlugCandidates } from '../utils/authority-identity';

type CacheRecord = { source_id?: string; source_url?: string; id?: string; answer?: string; summary?: string };
type Translation = { slug?: string; translatedContent?: string; translatedSummary?: string };
type Document = { id: bigint; content_text: string; summary: string };
const write = process.env.WRITE_BACK === 'true';
const backup = process.env.ACOG_CLEAN_BACKUP_DIR;
const root = process.cwd();

function existingPaths(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean).filter(p => fs.existsSync(p)).map(p => fs.realpathSync(p)))];
}
function read<T>(file: string): T { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; }
function cleaned(text = ''): string {
  const result = stripAcogArticleChrome(text);
  if (text && !result) throw new Error('Refusing to replace nonempty content with empty content');
  return result;
}

async function main() {
  const files: Array<{ file: string; value: unknown; changed: number }> = [];
  const affected = new Set<string>();
  for (const file of existingPaths([path.join(root, 'data/authority-knowledge-cache.json'), '/tmp/authority-knowledge-cache.json'])) {
    const rows = read<CacheRecord[]>(file);
    let changed = 0;
    rows.forEach((row, index) => {
      if (!isAcogSource(row)) return;
      const answer = cleaned(row.answer), summary = cleaned(row.summary);
      if (answer === row.answer && summary === row.summary) return;
      changed++;
      buildAuthoritySlugCandidates(row, index).forEach(slug => affected.add(slug));
      row.answer = answer;
      row.summary = summary;
    });
    if (changed) files.push({ file, value: rows, changed });
  }
  for (const file of existingPaths([process.env.AUTHORITY_TRANSLATION_CACHE_PATH || '', path.join(root, 'data/authority-translation-cache.json'), '/tmp/authority-translation-cache.json'])) {
    const rows = read<Record<string, Translation>>(file);
    let changed = 0;
    for (const [slug, row] of Object.entries(rows)) {
      if (!slug.startsWith('authority-acog-')) continue;
      const content = cleaned(row.translatedContent), summary = cleaned(row.translatedSummary);
      if (content === row.translatedContent && summary === row.translatedSummary) continue;
      changed++;
      affected.add(slug);
      row.translatedContent = content;
      row.translatedSummary = summary;
      // Preserve freshness metadata. Reading repairs fingerprints only after its normal freshness check.
    }
    if (changed) files.push({ file, value: rows, changed });
  }
  for (const file of existingPaths([process.env.KNOWLEDGE_LAYOUT_CACHE_PATH || '', path.join(root, 'data/authority-layout-cache.json'), '/tmp/authority-layout-cache.json'])) {
    const rows = read<Record<string, unknown>>(file);
    let changed = 0;
    for (const slug of affected) if (rows[slug]) { delete rows[slug]; changed++; }
    if (changed) files.push({ file, value: rows, changed });
  }
  const documents = await prisma.$queryRawUnsafe<Document[]>("SELECT id, content_text, summary FROM authority_normalized_documents WHERE source_id='acog'");
  const updates = documents.map(row => ({ ...row, content: cleaned(row.content_text), cleanSummary: cleaned(row.summary) }))
    .filter(row => row.content !== row.content_text || row.cleanSummary !== row.summary);
  const report = { mode: write ? 'write' : 'dry-run', files: files.map(({ file, changed }) => ({ file, changed })), documents: updates.length, affectedSlugs: [...affected] };
  console.log(JSON.stringify(report));
  if (!write) return;
  if (!backup || !path.isAbsolute(backup)) throw new Error('ACOG_CLEAN_BACKUP_DIR must be an absolute path');
  fs.mkdirSync(backup, { recursive: true });
  const backups = files.map(({ file }) => {
    const target = path.join(backup, 'files', file.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
    return { file, backup: target };
  });
  fs.writeFileSync(path.join(backup, 'cache-files.json'), JSON.stringify(backups, null, 2), { flag: 'wx' });
  fs.writeFileSync(path.join(backup, 'documents.json'), JSON.stringify(updates.map(({ id, content_text, summary }) => ({ id: id.toString(), content_text, summary }))), { flag: 'wx' });
  await prisma.$transaction(updates.map(row => prisma.$executeRawUnsafe(
    "UPDATE authority_normalized_documents SET content_text=?, summary=? WHERE id=? AND source_id='acog' AND content_text=?",
    row.content, row.cleanSummary, row.id, row.content_text,
  )));
  for (const { file, value } of files) {
    const temporary = `${file}.acog-clean-${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
    fs.renameSync(temporary, file);
  }
  fs.writeFileSync(path.join(backup, 'result.json'), JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
