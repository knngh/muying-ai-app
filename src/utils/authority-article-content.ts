import { isAcogSource, stripAcogArticleChrome } from './acog-content';

export interface AuthorityArticleSource {
  slug?: string;
  source_id?: string;
  sourceId?: string;
  source_url?: string;
  sourceUrl?: string;
  source_org?: string;
  source?: string;
}

function sourceFamily(source: AuthorityArticleSource): string {
  const id = source.source_id || source.sourceId;
  if (id) return id.toLowerCase();
  const slugFamily = source.slug?.match(/^authority-(msd-manuals-cn|mayo-clinic-zh|medlineplus|acog|nhs|aap|who|cdc)-/i)?.[1];
  if (slugFamily) return slugFamily.toLowerCase();
  try {
    const host = new URL(source.source_url || source.sourceUrl || '').hostname;
    const hosts: Record<string, string> = {
      'nhs.uk': 'nhs', 'healthychildren.org': 'aap', 'medlineplus.gov': 'medlineplus',
      'msdmanuals.com': 'msd-manuals-cn', 'mayoclinic.org': 'mayo-clinic-zh',
      'who.int': 'who', 'cdc.gov': 'cdc',
    };
    return Object.entries(hosts).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] || '';
  } catch { return ''; }
}

function trimAtFirst(text: string, patterns: RegExp[]): string {
  const offsets = patterns.map(pattern => text.search(pattern)).filter(index => index >= 0);
  return (offsets.length ? text.slice(0, Math.min(...offsets)) : text)
    .replace(/\n\s*[*#>_-]+\s*$/u, '').trim();
}

// These are publisher UI boundaries, not medical keywords. Keep references and
// clinical advice; inline media metadata must never truncate the text after it.
export function stripAuthorityArticleChrome(input: string, source: AuthorityArticleSource): string {
  let text = input.trim();
  const family = sourceFamily(source);
  if (family === 'acog' || isAcogSource(source)) {
    text = stripAcogArticleChrome(text);
    return trimAtFirst(text, [
      /(?:发布|发表)(?:于|时间|日期)?\s*[:：]?\s*\d{4}\s*年\s*\d{1,2}\s*月(?=[\s\S]{0,600}(?:最后|最近)(?:审查|审核|审阅)[\s\S]{0,400}(?:主题|话题)[\s\S]{0,300}$)/u,
      /最后(?:更新|审查|审核|审阅)(?:时间|日期|于)?\s*[:：]?\s*\d{4}\s*年\s*\d{1,2}\s*月(?=[\s\S]{0,400}(?:主题|话题)[\s\S]{0,300}$)/u,
      /\bPFSI\d{3}\s+(?=最后更新)/u,
    ]);
  }

  if (family === 'medlineplus') {
    text = trimAtFirst(text, [
      /\bReview Date\s*:?\s*\d{1,2}\/\d{1,2}\/\d{4}\b/iu,
      /(?:审核|审查|复审|评审|审阅)日期\s*[:：]?\s*(?:\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日|\d{1,2}\/\d{1,2}\/\d{4})/u,
      /\bLearn how to cite this page\b|\bRelated MedlinePlus Health Topics\b/iu,
      /了解如何引用此页面|相关\s*MedlinePlus\s*健康主题|浏览百科全书/u,
      /(?:\bDisclaimer\s+MedlinePlus links to|免责声明\s*MedlinePlus链接至)/iu,
    ]);
  } else if (family === 'nhs') {
    text = text
      .replace(/\bMedia (?:last reviewed|review due)\s*:\s*\d{1,2}\s+[a-z]+\s+\d{4}/giu, '')
      .replace(/媒体(?:上次|最后)?(?:审查|审核|审阅)(?:(?:到期|截止)?(?:日期|日)?)?\s*[:：]\s*\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日[。.;；]?/gu, '')
      .replace(/\bGet (?:Best Start in Life|Start4Life) pregnancy and baby emails\b(?:\s+Sign up for emails[^.\n]{0,350}\.)?/giu, '')
      .replace(/(?:获取|订阅|接收|注册(?:订阅)?)[“"「]?(?:人生最佳开端|生命最佳(?:开端|起点)|Best Start in Life|Start4Life)[”"」]?[^。！？\n]{0,60}(?:电子邮件|邮件)(?:\s*(?:注册接收|报名接收)[^。！？\n]{0,250}。|[，,]\s*(?:获取|获得|接收)[^。！？\n]{0,250}。)?/giu, '');
    text = trimAtFirst(text, [
      /\bFind out more\s+(?=Tommy[’']s\s*[:：]|Royal College of Obstetricians and Gynaecologists\s*(?:\(RCOG\))?\s*[:：])/iu,
      /\bMore in\s+(?=[\s\S]{0,2500}\bPage last reviewed\s*:)/iu,
      /更多关于\s*[“"「](?=[\s\S]{0,2500}页面(?:上次|最后)(?:审查|审核|审阅))/u,
      /(?:^|(?<=[。！？\n]))\s*更多(?:关于|相关内容|健康(?:相关)?内容)[^。！？\n]{0,80}(?=[\s\S]{0,2500}页面(?:上次|最后)(?:审查|审核|审阅))/u,
      /(?:^|(?<=\n))[^。！？\n]{1,60}的更多信息[:：]\s*\n(?=[\s\S]{0,2500}页面(?:上次|最后)(?:审查|审核|审阅))/u,
      /(?:^|(?<=\n))\s*(?:\*\*)?(?:Find out more|了解更多(?:信息)?)[:：]?[^\S\n]*\n(?![\s\S]*(?:[。！？]|[.!?](?:\s|$)))\s*(?:[^\n]+\n\s*){1,20}[^\n]*$/iu,
      /(?:^|(?<=\n))\s*(?:\*\*)?(?:更多信息|更多相关信息请参阅|关于[^。！？\n]{1,60}的更多内容)[:：]?[^\S\n]*\n(?:[^\n。]+\n){1,20}[^\n。]*$/u,
      /\bPage last reviewed\s*:|\bNext review due\s*:/iu,
      /页面(?:上次|最后)(?:审查|审核|审阅)(?:日期|时间)?\s*[:：]|下次(?:审查|审核|审阅)(?:到期|截止)?(?:日期|时间|日)?\s*[:：]/u,
    ]);
  } else if (family === 'msd-manuals-cn') {
    text = trimAtFirst(text, [/\bTest your Knowledge\s+Take a Quiz/iu]);
    text = text
      .replace(/(?:版权所有|Copyright)\s*©?\s*\d{4}\s*Merck\s*&(?:amp;)?\s*Co\.,\s*Inc\.,\s*Rahway,\s*NJ,\s*USA\s*(?:and its affiliates\.\s*All rights reserved\.|及其附属公司。\s*保留所有权利。)/giu, '')
      .replace(/\s*关于\s*免责声明\s*$/u, '').trim();
  } else if (family === 'aap') {
    text = trimAtFirst(text, [
      /\b(?:Additional|More) Information from HealthyChildren\.org/iu,
      /来自\s*HealthyChildren\.org\s*的更多(?:信息|资讯|资料)/iu,
      /HealthyChildren\.org\s*上的更多(?:信息|资讯|资料)/iu,
      /\bMore information\s*:?\s+(?=[A-Z])/u,
      /(?:^|(?<=[。！？\n]))\s*(?:\*\*|#{1,6}\s*)?更多信息\s*[:：]/u,
      /\bAbout the [Aa]uthors?\b/iu,
      /关于作者\s*[:：]?/u,
    ]);
  } else if (family === 'who') {
    text = trimAtFirst(text, [
      /\bSpeakers?\s+(?=[\s\S]{0,600}\b(?:View|See) all episodes\b)/iu,
      /演讲者(?:简介|关键信息|列表)(?=[\s\S]{0,600}查看(?:全部剧集|所有集数))/u,
    ]);
  } else if (family === 'mayo-clinic-zh') {
    text = trimAtFirst(text, [
      /(?:症状与病因|诊断与治疗)\s+疾病与状况/u,
      /疾病与状况\s+[^。\n]{0,150}\s+-\s+(?:Symptoms & causes|Diagnosis & treatment)\s+-\s+Mayo Clinic/iu,
      /显示更多来自妙佑医疗国际的产品和服务/u,
      /相关\s+相关医疗程序(?=[\s\S]{0,500}显示更多相关医疗程序)/u,
      /\bAdvertisement\s+妙佑医疗国际不为任何公司或产品背书/iu,
      /\bCON-\d{6,}\b/u,
    ]);
    text = text.replace(/产品与服务\s*(?:(?:书籍\s*[:：]\s*《[^》]+》|简报\s*[:：]\s*妙佑医疗国际卫生来信\s*[—–-]\s*数字版)\s*)+/gu, '').trim();
  } else if (family === 'cdc') {
    text = trimAtFirst(text, [
      /\bPrint\s+Share\s+Facebook\b/iu,
      /\bImprimir\s+Compartir\s+Facebook\b/iu,
      /打印\s*分享\s*Facebook\b/iu,
    ]);
  }
  return text.trim();
}
