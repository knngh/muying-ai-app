import '../config/env';
import prisma from '../config/database';
import { shouldFilterAuthoritySourceUrl } from '../utils/authority-source-url';
import {
  containsDeathRelatedTerms,
  isHighRiskOrClickbaitTitle,
  isOffTopicGovPolicyTitle,
} from '../services/authority-adapters/base.adapter';
import { exportPublishedAuthoritySnapshot } from '../services/authority-sync.service';

interface CandidateRow {
  id: bigint;
  source_id: string;
  source_org: string;
  source_url: string;
  title: string;
  summary: string | null;
  content_text: string | null;
}

const TARGET_SOURCE_IDS = [
  'ncwch-maternal-child-health',
  'mchscn-monitoring',
  'cnsoc-dietary-guidelines',
  'chinanutri-maternal-child',
  'govcn-muying',
  'govcn-jiedu-muying',
  'familydoctor-maternal',
  'youlai-pregnancy-guide',
  'yilianmeiti-maternal-child',
  'chunyu-maternal',
  'dxy-maternal',
  'aap',
  'acog',
  'cdc',
  'nhs',
  'who',
  'mayo-clinic-zh',
  'msd-manuals-cn',
  'nhc-fys',
  'nhc-rkjt',
  'chinacdc-immunization',
  'chinacdc-nutrition',
  'ndcpa-immunization',
  'ndcpa-public-health',
];

function isNavigationTitle(title: string): boolean {
  return /^(首页|网站首页|新闻中心|图片新闻|文字新闻|技术规范|工作指南|监测结果|通讯专栏|继续教育|基层交流|共享资源|调查问卷|关于我们|国际合作|期刊杂志|工作动态|科普知识|政策文件|科研成果|科研动态|项目申报|学习园地|中心党建|地方经验|通知公告|行业动态|科普宣传|中国居民膳食指南|中国妇幼健康监测)$/u.test(title.trim());
}

function isInstitutionalChinanutriNews(row: CandidateRow): boolean {
  return row.source_id === 'chinanutri-maternal-child'
    && /(?:营养所|学术年会|民主生活会|工会|联欢会|招生|招聘|课题招标|公开征求意见)/u.test(row.title)
    && !/(儿童|婴幼儿|孕妇|孕产|乳母|母乳|喂养|辅食|膳食指南|营养健康提示)/u.test(row.title);
}

function isOffTopicChinanutriDocument(row: CandidateRow): boolean {
  return row.source_id === 'chinanutri-maternal-child'
    && !/(婴幼儿|新生儿|儿童|青少年|孕妇|孕产|乳母|母乳|喂养|辅食|膳食|营养|维生素|生长|发育|五健|健康提示|指南)/u.test(row.title);
}

function shouldReject(row: CandidateRow): boolean {
  if (shouldFilterAuthoritySourceUrl({
    source_id: row.source_id,
    source_org: row.source_org,
    source_url: row.source_url,
    title: row.title,
  })) {
    return true;
  }

  return isNavigationTitle(row.title)
    || isInstitutionalChinanutriNews(row)
    || isOffTopicChinanutriDocument(row)
    || isOffTopicGovPolicyTitle(row.title, row.source_id) !== null
    || isHighRiskOrClickbaitTitle(row.title) !== null
    || containsDeathRelatedTerms(`${row.summary || ''} ${row.content_text || ''}`);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<CandidateRow[]>(
    `SELECT id, source_id, source_org, source_url, title, summary, content_text
     FROM authority_normalized_documents
     WHERE publish_status <> 'rejected'
       AND source_id IN (${TARGET_SOURCE_IDS.map(() => '?').join(', ')})`,
    ...TARGET_SOURCE_IDS,
  );

  const rejected = rows.filter(shouldReject);
  for (const row of rejected) {
    await prisma.$executeRawUnsafe(
      'UPDATE authority_normalized_documents SET publish_status = ? WHERE id = ?',
      'rejected',
      row.id,
    );
  }

  if (rejected.length > 0) {
    await exportPublishedAuthoritySnapshot();
  }

  console.log(JSON.stringify({
    scanned: rows.length,
    rejected: rejected.length,
    rejectedDocuments: rejected.map((row) => ({
      id: Number(row.id),
      sourceId: row.source_id,
      title: row.title,
      sourceUrl: row.source_url,
    })),
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Authority Clean] failed:', error);
    process.exit(1);
  });
