const fs = require("node:fs"),
  path = require("node:path");
const app = path.resolve(__dirname, ".."),
  out =
    process.env.AUTHORITY_QUALITY_BATCH_DIR ||
    path.join(app, "data", "quality-backfill");
const service = require(app + "/dist/services/authority-translation.service");
const { buildStableAuthoritySlug } = require(
  app + "/dist/utils/authority-identity",
);
const { buildAuthorityTranslationSourceFingerprint: fingerprint } = require(
  app + "/dist/utils/authority-translation-source",
);
const full = require(app + "/dist/utils/authority-full-translation");
const kl = require(app + "/dist/utils/knowledge-layout");
const layout = require(app + "/dist/services/knowledge-layout.service");
const prisma = require(app + "/dist/config/database").default;
const held = new Set([
  "authority-acog-9nj69u",
  "authority-medlineplus-447he7",
  "authority-medlineplus-1gz9qej",
  "authority-medlineplus-oav3nh",
  "authority-medlineplus-e7o0a1",
  "authority-medlineplus-7n3y4l",
  "authority-medlineplus-1f8mkkf",
  "authority-medlineplus-1womrga",
]);
const backup = process.env.QUALITY_APPLY_BACKUP;
if (!backup) throw new Error("backup path required");
const names = [
  "authority-knowledge-cache.json",
  "authority-translation-cache.json",
  "authority-layout-cache.json",
];
const files = names.map((n) => app + "/data/" + n),
  original = files.map((f) => fs.readFileSync(f));
const [records, translations, layouts] = original.map((b) => JSON.parse(b));
const map = new Map(
  records.map((r, i) => [
    buildStableAuthoritySlug(r, i),
    { raw: r, record: service.normalizeAuthorityCacheRecord(r) },
  ]),
);
const report = { translated: [], formatted: [], held: [], skipped: [] },
  pending = [];
function atomic(file, data) {
  const temp = file + ".quality.tmp";
  fs.writeFileSync(temp, JSON.stringify(data));
  const stat = fs.statSync(file);
  fs.chownSync(temp, stat.uid, stat.gid);
  fs.chmodSync(temp, stat.mode);
  fs.renameSync(temp, file);
}
(async () => {
  for (const file of fs.readdirSync(out + "/items")) {
    const r = JSON.parse(fs.readFileSync(out + "/items/" + file));
    if (!r.complete) continue;
    const current = map.get(r.slug);
    if (!current || fingerprint(current.record) !== r.sourceFingerprint) {
      report.skipped.push({ slug: r.slug, reason: "source changed" });
      continue;
    }
    if (r.reviewerVersion === 5 && !r.audit?.exportable) held.add(r.slug);
    if (r.slug === "authority-acog-9nj69u")
      r.audit = {
        decision: "review",
        contentType: "guidance",
        confidence: 1,
        exportable: false,
        reasons: [
          "原网页将胎儿睾丸下降方向写为from the scrotum，存在基础解剖方向错误，需原文更正后复核",
        ],
        provider: "manual-source-verification",
        model: "source-integrity-check",
      };
    if (held.has(r.slug)) {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT id,content_text,metadata_json,publish_status FROM authority_normalized_documents WHERE source_id=? AND source_url=?",
        current.record.source_id,
        current.record.source_url,
      );
      const row = rows[0];
      if (
        !row ||
        full.getAuthorityTranslationSource(
          service.normalizeAuthorityCacheRecord({
            ...current.record,
            answer: row.content_text,
          }).answer,
        ) !== full.getAuthorityTranslationSource(current.record.answer)
      ) {
        report.skipped.push({ slug: r.slug, reason: "database changed" });
        continue;
      }
      const review = {
        ...r.audit,
        reviewedAt: r.finishedAt,
        exportable: false,
      };
      const metadata = JSON.parse(row.metadata_json || "{}");
      pending.push({
        id: row.id.toString(),
        before: {
          metadata_json: row.metadata_json,
          publish_status: row.publish_status,
        },
        metadata: { ...metadata, aiQualityReview: review },
        nextStatus: r.slug === "authority-acog-9nj69u" ? "rejected" : "review",
      });
      current.raw.metadata = {
        ...current.raw.metadata,
        aiQualityReview: review,
      };
      current.raw.status =
        r.slug === "authority-acog-9nj69u" ? "rejected" : "review";
      report.held.push(r.slug);
      continue;
    }
    if (!r.audit?.exportable || !r.layout) continue;
    let translated = r.translation || translations[r.slug];
    try {
      if (r.translation) {
        if (
          !r.recheck?.translationApproved ||
          !r.recheck?.exportable ||
          (!r.translation.isSourceChinese &&
            !r.translation.qualityReview?.approved)
        )
          throw new Error("independent approval missing");
        full.validateAuthorityTranslationSegment(
          full.getAuthorityTranslationSource(current.record.answer),
          r.translation.translatedContent,
        );
        full.validateAuthorityTranslationTerminology(
          current.record.answer,
          r.translation.translatedContent,
        );
      }
      const source = kl.getKnowledgeLayoutSourceText(
        translated?.translatedContent || current.record.answer,
      );
      if (
        !source ||
        r.layout.sourceFingerprint !==
          layout.buildKnowledgeLayoutSourceFingerprint(source)
      )
        throw new Error("layout source changed");
      kl.parseKnowledgeLayoutOutput(
        JSON.stringify({ blocks: r.layout.blocks }),
        source,
      );
      if (r.translation) {
        translations[r.slug] = r.translation;
        report.translated.push(r.slug);
      }
      layouts[r.slug] = r.layout;
      report.formatted.push(r.slug);
    } catch (e) {
      report.skipped.push({ slug: r.slug, reason: e.message });
    }
  }
  if (process.env.AUTHORITY_QUALITY_APPLY_DRY_RUN === "true") {
    console.log(JSON.stringify({ ...report, dryRun: true }));
    return;
  }
  fs.writeFileSync(backup + "/database-before.json", JSON.stringify(pending));
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const row of pending)
          await tx.$executeRawUnsafe(
            "UPDATE authority_normalized_documents SET metadata_json=?, publish_status=? WHERE id=?",
            JSON.stringify(row.metadata),
            row.nextStatus,
            row.id,
          );
        [records, translations, layouts].forEach((data, i) =>
          atomic(files[i], data),
        );
      },
      { timeout: 30000 },
    );
  } catch (e) {
    original.forEach((bytes, i) => {
      const t = files[i] + ".restore.tmp";
      fs.writeFileSync(t, bytes);
      const st = fs.statSync(files[i]);
      fs.chownSync(t, st.uid, st.gid);
      fs.chmodSync(t, st.mode);
      fs.renameSync(t, files[i]);
    });
    throw e;
  }
  fs.writeFileSync(backup + "/applied.json", JSON.stringify(report));
  console.log(JSON.stringify(report));
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
