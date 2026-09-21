/**
 * 预生成起名库的第一批样本。
 *
 * 候选名和释义由 AI 辅助整理，尚待人工内容审核；不得标为人工编写或免标识内容。
 * 线上只做筛选。sourceQuote 仅记录古典原句，用字组合不宣称出自古诗词。
 */
export type NameGender = 'boy' | 'girl' | 'neutral';

export interface NameLibraryItem {
  id: string;
  givenName: string;
  gender: NameGender;
  pinyin: string;
  meaning: string;
  source: string;
  sourceQuote?: string;
  contentOrigin: 'ai_assisted';
}

export const NAME_LIBRARY_VERSION = '2026.09.21-preview';
export const NAME_LIBRARY_DISCLOSURE = '名字释义由 AI 辅助整理，样本待人工复核；仅供文化参考，不提供重名统计或吉凶判断。';

export const NAME_LIBRARY: readonly NameLibraryItem[] = ([
  { id: 'jing-shu', givenName: '静姝', gender: 'girl', pinyin: 'jìng shū', meaning: '寄托娴静美好的祝愿', source: '《诗经·邶风·静女》', sourceQuote: '静女其姝，俟我于城隅。' },
  { id: 'qing-yang', givenName: '清扬', gender: 'neutral', pinyin: 'qīng yáng', meaning: '取清朗明丽之意', source: '《诗经·郑风·野有蔓草》', sourceQuote: '有美一人，清扬婉兮。' },
  { id: 'zi-jin', givenName: '子衿', gender: 'neutral', pinyin: 'zǐ jīn', meaning: '由青色衣领的意象引申文雅之意', source: '《诗经·郑风·子衿》', sourceQuote: '青青子衿，悠悠我心。' },
  { id: 'qiao-mu', givenName: '乔木', gender: 'boy', pinyin: 'qiáo mù', meaning: '取树木挺拔向上之意', source: '《诗经·小雅·伐木》', sourceQuote: '出自幽谷，迁于乔木。' },
  { id: 'jia-shu', givenName: '嘉树', gender: 'boy', pinyin: 'jiā shù', meaning: '取美好树木的意象', source: '《楚辞·九章·橘颂》', sourceQuote: '后皇嘉树，橘徕服兮。' },
  { id: 'huai-jin', givenName: '怀瑾', gender: 'neutral', pinyin: 'huái jǐn', meaning: '以美玉寄托珍视品德的心意', source: '《楚辞·九章·怀沙》', sourceQuote: '怀瑾握瑜兮，穷不知所示。' },
  { id: 'wang-shu', givenName: '望舒', gender: 'neutral', pinyin: 'wàng shū', meaning: '借神话中为月驾车者之名寄托明净之意', source: '《楚辞·离骚》', sourceQuote: '前望舒使先驱兮，后飞廉使奔属。' },
  { id: 'yun-fan', givenName: '云帆', gender: 'boy', pinyin: 'yún fān', meaning: '寄托迎风远行的志向', source: '李白《行路难·其一》', sourceQuote: '长风破浪会有时，直挂云帆济沧海。' },
  { id: 'qing-quan', givenName: '清泉', gender: 'neutral', pinyin: 'qīng quán', meaning: '取清澈泉水的意象', source: '王维《山居秋暝》', sourceQuote: '明月松间照，清泉石上流。' },
  { id: 'xing-chui', givenName: '星垂', gender: 'neutral', pinyin: 'xīng chuí', meaning: '取原野上星空辽阔的意象', source: '杜甫《旅夜书怀》', sourceQuote: '星垂平野阔，月涌大江流。' },
  { id: 'zhi-chun', givenName: '知春', gender: 'girl', pinyin: 'zhī chūn', meaning: '由春雨应时的意象寄托体贴之意', source: '杜甫《春夜喜雨》', sourceQuote: '好雨知时节，当春乃发生。' },
  { id: 'yun-qi', givenName: '云起', gender: 'neutral', pinyin: 'yún qǐ', meaning: '取云起悠然之意', source: '王维《终南别业》', sourceQuote: '行到水穷处，坐看云起时。' },
  { id: 'an-ran', givenName: '安然', gender: 'neutral', pinyin: 'ān rán', meaning: '寄托平安从容的祝愿' },
  { id: 'yi-heng', givenName: '奕衡', gender: 'boy', pinyin: 'yì héng', meaning: '寄托神采明朗、处事有度的祝愿' },
  { id: 'jing-heng', givenName: '景恒', gender: 'boy', pinyin: 'jǐng héng', meaning: '寄托心有光景、持之以恒的祝愿' },
  { id: 'mu-chuan', givenName: '沐川', gender: 'boy', pinyin: 'mù chuān', meaning: '取清润川流的意象' },
  { id: 'zhi-yuan', givenName: '知远', gender: 'boy', pinyin: 'zhī yuǎn', meaning: '寄托求知、志向长远的祝愿' },
  { id: 'wan-ning', givenName: '婉宁', gender: 'girl', pinyin: 'wǎn níng', meaning: '寄托温婉安宁的祝愿' },
  { id: 'yi-ning', givenName: '依宁', gender: 'girl', pinyin: 'yī níng', meaning: '寄托安宁自在的祝愿' },
  { id: 'xin-yue', givenName: '心月', gender: 'girl', pinyin: 'xīn yuè', meaning: '取心境如月清明的意象' },
  { id: 'qing-he', givenName: '清禾', gender: 'girl', pinyin: 'qīng hé', meaning: '取禾苗清新生长的意象' },
  { id: 'zhi-yi', givenName: '知意', gender: 'girl', pinyin: 'zhī yì', meaning: '寄托善解人意的祝愿' },
  { id: 'yu-xin', givenName: '予欣', gender: 'girl', pinyin: 'yǔ xīn', meaning: '寄托分享欣喜的心意' },
  { id: 'mu-xi', givenName: '沐曦', gender: 'neutral', pinyin: 'mù xī', meaning: '取沐浴晨光的意象' },
  { id: 'an', givenName: '安', gender: 'neutral', pinyin: 'ān', meaning: '寄托平安安定的祝愿' },
  { id: 'ning', givenName: '宁', gender: 'neutral', pinyin: 'níng', meaning: '取安宁之意' },
  { id: 'jin', givenName: '瑾', gender: 'neutral', pinyin: 'jǐn', meaning: '取美玉之意' },
  { id: 'heng', givenName: '恒', gender: 'boy', pinyin: 'héng', meaning: '取恒心、持久之意' },
  { id: 'ze', givenName: '泽', gender: 'boy', pinyin: 'zé', meaning: '取润泽之意' },
  { id: 'yue', givenName: '悦', gender: 'girl', pinyin: 'yuè', meaning: '取喜悦之意' },
  { id: 'qing', givenName: '晴', gender: 'girl', pinyin: 'qíng', meaning: '取晴朗之意' },
  { id: 'he', givenName: '禾', gender: 'neutral', pinyin: 'hé', meaning: '取禾苗生长的意象' },
] satisfies Array<Omit<NameLibraryItem, 'source' | 'contentOrigin'> & { source?: string }>).map(item => ({
  ...item,
  source: item.source || '用字组合（非古诗词原句）',
  contentOrigin: 'ai_assisted' as const,
}));
