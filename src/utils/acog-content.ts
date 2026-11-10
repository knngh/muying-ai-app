/** Remove ACOG page controls and promotional widgets, never medical sentences. */
export function stripAcogArticleChrome(input: string): string {
  let text = input.trim();
  // This full sequence belongs to the share toolbar above the article.
  text = text
    .replace(/^[\s\S]*?\bShare\s+Facebook\s+(?:Email|E-mail)\s+Link\s+URL has been copied to the clipboard\s+Close\s+Print\s*/iu, '')
    .replace(/^[\s\S]*?\bShare\s+Facebook\s+Bluesky\s+LinkedIn\s+Email\s+Print\s*/iu, '')
    .replace(/^[\s\S]*?分享(?:到)?\s*Facebook\s*(?:电子邮件|邮件|邮箱)\s*链接\s*(?:网址|链接|URL)\s*已复制到剪贴板\s*关闭\s*打印\s*/iu, '');
  text = text
    .replace(/^(?:(?:Leer|Ver) en espa(?:ñ|&(?:amp;)?ntilde;)\s*ol|西班牙语阅读|用西班牙语阅读)\s*/iu, '')
    .replace(/^(?:Frequently Asked Questions|常见问题(?:解答)?|经常问答问题)\s*(?:Expand All|展开全部|全部展开)\s*/iu, '')
    .replace(/\bDownload as a PDF\s+Expand All\s+Collapse All\s*/giu, '')
    .replace(/\b(?:Expand All|Collapse All)\b/giu, '')
    .replace(/[（(]?(?:展开全部|全部展开|折叠全部|全部折叠)[）)]?/gu, '')
    .replace(/\bAdvertisement\s+ACOG does not endorse any companies or products\.?\s*/giu, '')
    .replace(/广告\s*ACOG\s*不认可任何公司或产品[。.]?\s*/gu, '');

  const boundaries = [
    /\bAbout\s+Ask\s+ACOG\b/iu,
    /关于\s*(?:询问|问)\s*ACOG/iu,
    /关于\s*Ask\s*ACOG\b/iu,
    /关于\s*ACOG(?:\s*问答)?\s*[你您](?:有|对)(?:关于)?女性健康/iu,
    /\bACOG\s+is here with answers to help you stay healthy/iu,
    /ACOG\s*(?:在这里|在此)为[您你]提供答案[，,]\s*帮助[您你]保持健康[。.]\s*浏览所有问题/iu,
    /\bWhat to Read Next\b/iu,
    /\bMore To Explore\s+(?:Physician FAQ|Patient Resources)\b/iu,
    /\bArticle continues below\s+Advertisement\b/iu,
    /\bArticle continues below\s+(?=If you have further questions)/iu,
    /以下内容继续以下页\s*(?=如果[您你]有进一步的问题)/u,
    /文章(?:正文)?继续于?下文\s*(?:广告\s*)?如果[您你]有进一步的问题/u,
    /下?文章(?:正文|其余部分)?(?:继续|在|下|见|将)[^。！？\n]{0,30}?\s*(?:广告|advertisement)/iu,
    /下文将继续[。.]?\s*广告/u,
    /以下内容继续阅读广告/u,
    /文章继续以下内容[:：]\s*如果[您你]有进一步的问题/u,
    /(?:常见问题(?:解答)?(?:FAQ)?|FAQ)\s*\d{3}\b[。.\s]*(?=(?:Last|最后|发布|发表|出版|最近))/iu,
    /\bMore To Explore\s+(?:Practice (?:Advisory|Bulletin)|Committee (?:Statement|Opinion)|Clinical Consensus)\b/iu,
    /更多探索\s*[:：]?\s*(?:实践(?:公报|简报|通告|建议)|委员会(?:声明|意见)|临床共识)/u,
    /(?:接下来阅读(?:什么)?|下一步阅读|推荐阅读)\s*[:：]?\s*(?:(?:常见问题|专家观点)\s*|(?:询问|问)\s*ACOG)/iu,
    /\bCopyright\s+\d{4}\s*(?:,?\s*by\s+)?the American College of Obstetricians/iu,
    /版权所有\s*\d{4}\s*年?/u,
    /临床医生\s*[:：]\s*(?:订购|订阅)(?:数字)?手册/u,
    /探索\s*ACOG\s*的?患者教育手册库/u,
    /本版块\s*女性健康\s*搜索\s*COVID-19/u,
  ];
  const offsets = boundaries.map(pattern => text.search(pattern)).filter(index => index >= 0);
  if (offsets.length) text = text.slice(0, Math.min(...offsets));
  return text.trim();
}

export function isAcogSource(record: { source_id?: string; sourceId?: string; source_url?: string; sourceUrl?: string; source?: string; source_org?: string }): boolean {
  if ((record.source_id || record.sourceId || '').toLowerCase() === 'acog') return true;
  try { return /(^|\.)acog\.org$/i.test(new URL(record.source_url || record.sourceUrl || '').hostname); }
  catch { return /\bACOG\b|American College of Obstetricians/i.test(record.source_org || record.source || ''); }
}
