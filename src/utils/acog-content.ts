/** Remove ACOG page controls and promotional widgets, never medical sentences. */
export function stripAcogArticleChrome(input: string): string {
  let text = input.trim();
  // This full sequence belongs to the share toolbar above the article.
  text = text
    .replace(/^[\s\S]*?\bShare\s+Facebook\s+(?:Email|E-mail)\s+Link\s+URL has been copied to the clipboard\s+Close\s+Print\s*/iu, '')
    .replace(/^[\s\S]*?分享\s*Facebook\s*(?:电子邮件|邮件|邮箱)\s*链接\s*(?:网址|链接|URL)已复制到剪贴板\s*关闭\s*打印\s*/iu, '');

  const boundaries = [
    /\bAbout\s+Ask\s+ACOG\b/iu,
    /关于\s*(?:询问|问)\s*ACOG/iu,
    /\bACOG\s+is here with answers to help you stay healthy/iu,
    /ACOG\s*(?:在这里|在此)为[您你]提供答案[，,]\s*帮助[您你]保持健康[。.]\s*浏览所有问题/iu,
    /\bWhat to Read Next\b/iu,
    /(?:接下来阅读(?:什么)?|下一步阅读|推荐阅读)\s*[:：]?\s*(?:(?:常见问题|专家观点)\s*|(?:询问|问)\s*ACOG)/iu,
    /\bCopyright\s+\d{4}\s*(?:,?\s*by\s+)?the American College of Obstetricians/iu,
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
