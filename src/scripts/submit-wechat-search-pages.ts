import prisma from '../config/database';
import {
  DEFAULT_WECHAT_SEARCH_CATEGORY_ID,
  DEFAULT_WECHAT_SEARCH_PAGE_PATH,
  DEFAULT_WECHAT_SEARCH_STRUCTURED_TYPE,
  buildWechatSearchSubmitPayload,
  chunkWechatSearchPages,
  fetchWechatAccessToken,
  submitWechatSearchPages,
  type WechatSearchStructuredType,
} from '../services/wechat-search-submit.service';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveStructuredType(value: string | undefined): WechatSearchStructuredType {
  return value === 'wxsearch_cpdata' ? 'wxsearch_cpdata' : DEFAULT_WECHAT_SEARCH_STRUCTURED_TYPE;
}

async function main() {
  const limit = parsePositiveInt(process.env.WECHAT_SEARCH_SUBMIT_LIMIT || process.env.LIMIT, 100);
  const categoryId = parsePositiveInt(process.env.WECHAT_SEARCH_CATEGORY_ID, DEFAULT_WECHAT_SEARCH_CATEGORY_ID);
  const path = process.env.WECHAT_SEARCH_PAGE_PATH || DEFAULT_WECHAT_SEARCH_PAGE_PATH;
  const structuredType = resolveStructuredType(process.env.WECHAT_SEARCH_STRUCTURED_TYPE);
  const dryRun = process.env.WECHAT_SEARCH_SUBMIT_DRY_RUN !== 'false';
  const configuredAccessToken = process.env.WECHAT_SEARCH_ACCESS_TOKEN || '';

  const articles = await prisma.article.findMany({
    where: {
      status: 1,
      deletedAt: null,
      slug: { not: null },
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      seoTitle: true,
      summary: true,
      seoDescription: true,
      content: true,
      coverImage: true,
      source: true,
      viewCount: true,
      likeCount: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      tags: {
        select: {
          tag: {
            select: { name: true },
          },
        },
      },
    },
  });

  const { payload, skipped } = buildWechatSearchSubmitPayload(articles.map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    seoTitle: article.seoTitle,
    summary: article.summary,
    seoDescription: article.seoDescription,
    content: article.content,
    coverImage: article.coverImage,
    source: article.source,
    viewCount: article.viewCount,
    likeCount: article.likeCount,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    tags: article.tags.map((item) => item.tag.name),
  })), {
    path,
    categoryId,
    structuredType,
  });

  console.log(`[WeChat Search] prepared ${payload.pages.length} pages, skipped ${skipped.length}`);
  if (skipped.length > 0) {
    console.log('[WeChat Search] skipped sample:', JSON.stringify(skipped.slice(0, 10), null, 2));
  }

  if (payload.pages.length > 0) {
    console.log('[WeChat Search] first page sample:', JSON.stringify(payload.pages[0], null, 2));
  }

  if (dryRun) {
    console.log('[WeChat Search] dry run enabled. Set WECHAT_SEARCH_SUBMIT_DRY_RUN=false and WECHAT_SEARCH_ACCESS_TOKEN to submit.');
    return;
  }

  const accessToken = configuredAccessToken.trim()
    || await fetchWechatAccessToken(process.env.WECHAT_APPID || '', process.env.WECHAT_APP_SECRET || '');

  for (const [index, chunk] of chunkWechatSearchPages(payload.pages).entries()) {
    const result = await submitWechatSearchPages(accessToken, chunk);
    console.log(`[WeChat Search] submitted batch ${index + 1}:`, JSON.stringify(result));
  }
}

main()
  .catch((error) => {
    console.error('[WeChat Search] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
