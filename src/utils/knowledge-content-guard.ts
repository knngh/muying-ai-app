import { getMedicalPlatformQualityDropReason } from './medical-platform-quality';

export interface KnowledgeGuardRecord {
  title?: string;
  question?: string;
  answer?: string;
  summary?: string;
  content?: string;
  contentText?: string;
  category?: string;
  tags?: string[];
  source?: string;
  sourceOrg?: string;
  source_org?: string;
  sourceId?: string;
  source_id?: string;
  sourceClass?: string;
  source_class?: string;
  sourceUrl?: string;
  source_url?: string;
  url?: string;
  source_updated_at?: string;
  updated_at?: string;
  updatedAt?: string;
  published_at?: string;
  created_at?: string;
}

const PRODUCT_SCOPE_PATTERN = /怀孕|孕妇|孕期|孕早期|孕中期|孕晚期|孕周|孕吐|产检|B超|彩超|羊水|双顶|股骨|胎儿|胎动|胎心|宫缩|破水|预产期|分娩|顺产|剖宫产|产后|坐月子|月子|哺乳|母乳|备孕|孕前|叶酸|排卵|宝宝|小宝|婴儿|新生儿|幼儿|小孩|孩子|月龄|辅食|喂奶|吃奶|奶量|配方奶|疫苗|接种|预防针|黄疸|脐带|湿疹|尿布|纸尿裤/u;

const OFF_SCOPE_ADULT_HEALTH_PATTERN = /阳痿|早泄|前列腺|阴茎|阴囊|龟头|包皮|手淫|遗精|精液|射精|不洁性交|处女|阴道口|阴毛|性病|尖锐湿疣|梅毒|艾滋|淋病|尿道口|隆胸|丰胸|乳房(?:下垂|干瘪|萎缩)|飞机场|狐臭|脱发|斑秃|痔疮|肛裂|肛瘘|混合痔|内痔|外痔|脱肛|屁眼|肛门|痘痘|痤疮|美容|整形|抽脂|减肥|肾虚|心梗|癫痫|脑出血|腰椎间盘突出/u;

const ADULT_DERMATOLOGY_CASE_PATTERN = /(?:我的脚|脚气|涂料厂上班|手指.{0,12}(?:水疱|开裂|皮肤变硬)|我的手臂).{0,60}(?:湿疹|皮肤|水疱|水泡|脚气|传染给小孩)|(?:湿疹|皮肤|水疱|水泡|脚气).{0,60}(?:我的脚|脚气|涂料厂上班|手指.{0,12}(?:水疱|开裂|皮肤变硬)|我的手臂|抱她|传染给小孩)/u;

const BEYOND_CHILD_AGE_PATTERN = /青春期|青少年|中小学生|小学|初中|高中|学龄儿童|学龄期|学生近视|早恋/u;

const OLDER_CHILD_AGE_PATTERN = /(?:孩子|小孩|宝宝|男孩|女孩|女儿|儿子|男童|女童|儿童).{0,12}(?:(?<!\d)(?:[7-9]|1\d|2[0-5])(?!\d)\s*(?:岁|周岁|岁半|了)|(?:七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五)\s*(?:岁|周岁|岁半|了))|(?:(?<!\d)(?:[7-9]|1\d|2[0-5])(?!\d)\s*(?:岁|周岁|岁半|了)|(?:七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五)\s*(?:岁|周岁|岁半|了)).{0,12}(?:孩子|小孩|宝宝|男孩|女孩|女儿|儿子|男童|女童|儿童)/u;

const TODDLER_OR_PRESCHOOL_AGE_PATTERN = /(?:孩子|小孩|宝宝|男孩|女孩|女儿|儿子|男童|女童|儿童).{0,12}(?:(?<!\d)1(?!\d)\s*(?:岁|周岁)\s*半|一\s*(?:岁|周岁)\s*半|(?<!\d)[2-6](?!\d)\s*(?:岁|周岁|岁半)|(?:两|二|三|四|五|六)\s*(?:岁|周岁|岁半))|(?:(?<!\d)1(?!\d)\s*(?:岁|周岁)\s*半|一\s*(?:岁|周岁)\s*半|(?<!\d)[2-6](?!\d)\s*(?:岁|周岁|岁半)|(?:两|二|三|四|五|六)\s*(?:岁|周岁|岁半)).{0,12}(?:孩子|小孩|宝宝|男孩|女孩|女儿|儿子|男童|女童|儿童)/u;

const NON_CONTENT_PATTERN = /中文调研|调查问卷|问卷|调研|调查研究|课题研究|示范城市|民用机场|文旅|消防安全/u;

const SUPPORT_POLICY_QUERY_PATTERN = /育儿补贴|生育保险|个税|个人所得税|专项附加扣除|医保|托育服务|普惠托育|补贴申领/u;

const UNSUPPORTED_SERVICE_REQUEST_PATTERN = /哪家医院(?:最好|好)|(?:医院|儿科|产科|妇产科|治疗医院).{0,12}(?:最好|好一点|哪家)|哪家医院.{0,16}(?:孕前干预|干预|检查|治疗)|(?:孕前干预|产前诊断|遗传咨询).{0,20}哪家医院|(?:免费治疗|接受免费治疗)|(?:挂|看|预约).{0,8}(?:哪个|哪一个|什么|那个).{0,4}(?:科|科室)|(?:哪个|哪一个|什么|那个).{0,4}(?:科|科室).{0,8}(?:挂|看|预约)|(?:高考|学校).{0,8}体检.{0,30}(?:怀孕|孕|抽血|报告)|(?:怀孕|孕).{0,30}(?:高考|学校).{0,8}体检|(?:孩子|宝宝).{0,12}(?:是谁的|谁的)|(?:是谁的|谁的).{0,12}(?:孩子|宝宝)|(?:你这边|这边|你们医院|贵院).{0,28}(?:可以做|能做|做检查|做治疗|预约|治疗)|(?:想去|预约一下去).{0,18}(?:医院|上海|北京|妇幼|儿科).{0,18}(?:检查|治疗)|(?:彩超|四维|B超|b超).{0,24}(?:可以|能).{0,14}(?:做出|查出|看出).{0,24}(?:疾病|毛病|对眼|心脏)|(?:几个月|什么时候|多久|双胞胎).{0,18}(?:做胎儿心脏彩超|胎儿心脏彩超)|尽快.{0,16}(?:恢复健康|治好)/u;

const SERVICE_ADMIN_REQUEST_PATTERN = /(?:四维|彩超|唐氏|DNA|hcg|HCG|产检|检查|建大卡|怀孕|孕妇).{0,32}(?:多少钱|价钱|费用|准备多少钱)|(?:多少钱|价钱|费用|准备多少钱).{0,32}(?:四维|彩超|唐氏|DNA|hcg|HCG|产检|检查|建大卡|怀孕|孕妇)|(?:微量元素|四维|彩超|产检|检查).{0,24}(?:周日|什么时候出结果|挂号|挂什么|什么科|哪科|预约时间|预约挂号)|(?:你们医院|贵院|本院|我院|妇幼保健院|儿童医院).{0,40}(?:四维|彩超|预约|挂号|多少钱|费用|光盘|身份证|户口本|工作日|能做|是否有|什么时候能做|安排)|(?:疫苗|预防肺结核|B型流感).{0,24}(?:多少钱|价钱|费用|花钱|元|自愿)|(?:多少钱|价钱|费用|花钱|元).{0,24}(?:疫苗|预防肺结核|B型流感)/u;

const ENVIRONMENTAL_DIAGNOSTIC_REQUEST_PATTERN = /(?:甲醛|装修).{0,50}(?:检测(?:宝宝|孩子|婴儿|新生儿).{0,12}(?:体内|含量)|一定会得病|如何补救|怎么补救)|(?:宝宝|孩子|婴儿|新生儿).{0,32}甲醛.{0,32}(?:检测|补救|得病)/u;

const ADULT_VACCINE_OR_INJURY_PATTERN = /(?:成年人|成人).{0,20}(?:接种|疫苗)|(?:注射|接种).{0,16}疫苗.{0,24}(?:喝酒|头发麻|不清醒)|(?:狂犬疫苗|被狗咬).{0,48}(?:保护期|加强针|全程注射)/u;

const CHILD_CARE_SUBJECT_PATTERN = /宝宝|小宝|婴儿|新生儿|幼儿|小孩|孩子|男孩|女孩|女儿|儿子|儿童|月龄/u;

const FETAL_CONTEXT_IN_PARENTING_CATEGORY_PATTERN = /孕妇|怀孕|胎儿|胎动|胎心|入盆|宫缩|预产期|羊水|脐带(?:绕|缠)|四维彩超|唐氏|双顶[径颈]|股骨长|腹中|肚子里(?:面)?的?宝宝|宝宝动得我肚子|小孩不大才\d|小孩怎么才长|吃橙子会有黄疸/u;

const PERSONAL_TREATMENT_REQUEST_PATTERN = /(?:用|抹|涂|吃|服用|注射).{0,10}(?:药|药膏|康瑞保|美皮护|抗生素|消炎药|退烧药|针剂).{0,12}(?:有用|管用|可以|行吗|能用|能吃)|(?:用|抹|涂|擦|吃|服用|服|喝).{0,8}(?:什么|哪种|哪类|哪两种|啥|什么样的).{0,6}(?:药|药膏|软膏|中成药|西药|抗生素|消炎药|退烧药)|(?:用|抹|涂|擦|吃|服用|注射).{0,16}(?:行么|行吗|可以吗|能吗|能不能).{0,16}(?:湿疹|黄疸|腹泻|发烧|咳嗽|疫苗|药)|(?:什么药|哪种|哪类|哪两种|哪两种药|两种药).{0,12}(?:药|药膏|软膏|药店|治|治疗|擦|抹|效果|配合|能买到)|(?:西红柿汁|松花粉|施巴|洗发沐浴露|红霉素软膏|抹点东西).{0,36}(?:宝宝|孩子|湿疹|红疙瘩|耳朵|诱出来|合适|可以|怎么办)|(?:茵栀黄|妈咪爱|思密达|腹泻奶粉|琥珀抱龙丸|护脑针|抗病毒合剂|消炎药|感冒冲剂|双黄消炎片|利君沙|优思明|妈富隆|阿托品|开塞露|三金片|小快克|退烧药|胰岛素|孕妇金花片|诺氟沙星|小儿氨酚黄那敏|大麦芽|回奶药).{0,32}(?:可以|能|还要|是不是|是否|影响|多久|多长|怎么办|怎么回事|适合|更适合|需要|吃多了|会(?:降|好)|什么时候|改用|换|服用|用|吃|快吗)|(?:补钙|缺钙).{0,30}(?:哪种|那种|什么|牌|钙维D|软胶囊|可以吗|能吃)|(?:药(?!店)|药膏|软膏|中成药|西药).{0,12}(?:效果好|最好|更适合)|(?:用药|吃药|服药).{0,30}(?:喂奶|吃奶|母乳|小时|时间)|(?:喂奶|吃奶|母乳).{0,30}(?:用药|吃药|服药|药效)|(?:请专家)?帮(?:我)?配药|(?:如何|怎么|怎样).{0,8}(?:治疗|用药)|(?:应如何|怎么).{0,8}治疗/u;

const SPECIFIC_PRODUCT_OR_EXPOSURE_RISK_PATTERN = /(?:贝特晓芙|叶酸铁钙片|复方葡萄糖酸钙|铁之缘|鹿角|止疼片|阿莫西林|妥布霉素|滴眼液|眼药水|双黄消炎片|避孕药|避孕要|染头发|拉直头发).{0,36}(?:可以|能不能|能用|能吃|是否|影响|有影响|怎么样|怎么回事|怎么办|怎莫办|继续|口服|吃了|用了)|(?:可以|能不能|能用|能吃|是否|影响|有影响|怎么样|怎么办|怎莫办|继续|口服|吃了|用了).{0,36}(?:贝特晓芙|叶酸铁钙片|复方葡萄糖酸钙|铁之缘|鹿角|止疼片|阿莫西林|妥布霉素|滴眼液|眼药水|双黄消炎片|避孕药|避孕要|染头发|拉直头发)|(?:CT|ct|胸透|拍片子?|做了ct|肺部ct).{0,40}(?:怀孕|宝宝|孩子|小孩|母乳|吃奶|哺乳|要小孩|要孩子|有影响|影响|多久)|(?:怀孕|宝宝|孩子|小孩|母乳|吃奶|哺乳|要小孩|要孩子).{0,40}(?:CT|ct|胸透|拍片子?|做了ct|肺部ct).{0,30}(?:影响|多久|可以|能不能)/u;

const PERSONAL_MEDICATION_OR_EXPOSURE_PATTERN = /(?:可以|能不能|能否|能|是否|要不要|有没有必要|行不行).{0,12}(?:吃|用|服|打|点).{0,8}(?:药|针|疫苗|麻药|眼药水)|(?:吃|用|服|打|点).{0,8}(?:药|针|麻药|眼药水).{0,24}(?:影响|可以|能不能|必要|多久|多长|行不行)|(?:输液|打麻药|眼部打麻药|红外线|贴膏药|米酒).{0,40}(?:怀孕|胎儿|宝宝|孩子|母乳|吃奶|哺乳|影响|多久|多长|怎么办)|(?:怀孕|胎儿|宝宝|孩子|母乳|吃奶|哺乳).{0,40}(?:输液|打麻药|眼部打麻药|红外线|贴膏药|米酒).{0,24}(?:影响|多久|多长|怎么办)|(?:药有没有必要|眼药水行不行)/u;

const DIAGNOSED_CASE_FOLLOWUP_PATTERN = /(?:去医院检查|医院检查|检查了|检查说|医生说|诊断为|确诊为|患有|得了).{0,30}(?:支气管哮喘|脑桥小脑角综合征|脑积水|白癜风|白癫风|胆囊癌|肿瘤|癌|综合征|罕见病|发育迟缓|脑室|侧脑室|颅后窝池|颅骨骨折|鼻漏|肾.{0,8}(?:囊肿|发育不正常|积水|积液|脏不好)|双肾积水|巨型输尿管|心内膜垫缺损|二尖瓣反流|三尖瓣反流|风疹综合症|鼻骨缺失|地中海贫血|溶血|房缺|室间隔缺损|小脑发育不良|羊角风|胎位不正|脐带绕颈|肠管扩张|心脏.{0,8}亮斑|手腕.{0,12}骨头|肘关节骨头)|(?:医生建议|配合治疗|治疗方案|复查结果|检查结果|核磁共振|磁共振|脑电图|心脏彩超|血常规|B超|彩超|三维|四维).{0,40}(?:治疗|用药|手术|康复|多久|饮食习惯|注意事项|严重吗|怎么办|正常吗|有影响|必要|复发)|(?:重型手足口病|脑炎|颅骨骨折|鼻漏|运动神经发育迟缓|第三脑室|巨型输尿管|肾.{0,8}(?:囊肿|发育不正常|积水|积液|脏不好)|双肾积水|心内膜垫缺损|风疹综合症|羊水过多|抽脐带血|鼻骨缺失|地中海贫血|房缺|室间隔缺损|小脑发育不良|脉络丛囊肿|胎儿肠管扩张|胎儿.{0,12}心脏.{0,12}(?:亮斑|问题)|球形红细胞增多症|ABO溶血|abo溶血|锁骨摔断|骨折|手腕.{0,12}骨头|肘关节骨头).{0,70}(?:怎么办|治疗|康复|影响|生活能行|严重吗|检查|什么时候|手术|后遗症|必要|还用|需要|正常吗|复发|能治|能生|结果|有什么问题)|(?:黄疸|黄胆).{0,50}(?:照蓝光|蓝光).{0,50}(?:检查头部|还需治疗|反弹|复发)|(?:出血|见红).{0,80}(?:孕囊形态|胚芽小|先兆流产|胎儿发育迟缓)|(?:孕囊形态|胚芽小|先兆流产|胎儿发育迟缓).{0,80}(?:出血|问题|怎么办|正常吗|发育)|(?:血常规|嗜酸性粒细胞).{0,50}(?:超高|指标高|医生不让|过敏|红色疹子)|(?:尿蛋白|尿隐血|肌酐|尿素氮).{0,80}(?:怀孕|生产|顺利生产|严重吗)|(?:鼻骨缺失|染色体检查).{0,80}(?:正常|结果|足月|出生|求)|(?:溶血|ABO溶血|abo溶血|a0型|A0型).{0,80}(?:能治|不能生孩子|复发|几率|影响|严重|会不会|发生)|(?:母亲|父亲|妈妈|爸爸).{0,20}(?:o型血|O型血|a型血|A型血).{0,60}溶血|(?:饮食欠佳|小便茶色|体重减轻|肝大|脾大).{0,120}(?:球形红细胞增多症|贫血|胆积水)|(?:CT|ct|24小时脑电图|脑电图|核磁共振|磁共振|心脏彩超).{0,80}(?:没查出|没查出来|更详细的检查|详细的检查|能治疗|治疗吗|复查|严重吗)|(?:左脑发育不太好|精神发育迟缓|智力达不到同龄|晕厥了几次).{0,80}(?:检查|治疗|没查出|原因)|(?:霰粒肿|白癜风|白癫风).{0,80}(?:医生说|治了|治疗|复发|等到|手术|怎么办|我该怎么办)|(?:抽脐带血|脐带血穿刺).{0,36}(?:必要|还用|需要|影响|风险|检查)/u;

const COMPLEX_NEONATAL_DIAGNOSED_CASE_PATTERN = /(?:出生|新生儿|宝宝|孩子).{0,24}(?:查出|诊断|诊断为|确诊|发现).{0,40}(?:先心病|室间隔缺损|卵圆孔未闭|重度肺炎|轻度脑病|脑病|核黄疸|蛛网膜(?:下腔)?出血|颅内出血)|(?:诊断为|确诊为).{0,16}(?:先心病|室间隔缺损|卵圆孔未闭)|(?:核黄疸|胆红素\s*\d{3,}|黄疸\s*\d{3,}).{0,40}(?:嗜睡|拒奶|吸允力变差|精神差|严重|几率|怎么办)|(?:先心病|室间隔缺损|卵圆孔未闭|重度肺炎|轻度脑病|脑病|蛛网膜(?:下腔)?出血|颅内出血).{0,36}(?:怎么办|严重|影响|后遗症|治疗)/u;

const PERSONAL_BIRTH_DECISION_PATTERN = /(?:过预产期|预产期过了|预产期.{0,30}分娩症状|还有.{0,8}天.{0,8}预产期|胎儿.{0,12}入盆|宝宝.{0,12}入盆|还没有入盆|一点点入盆|脐带(?:绕(?:脖子|颈)|缠绕)|胎位不正|臀位|宫口|骨缝|宫颈管|羊水浑浊|胎盘(?:3级|三级)|剖腹产|剖宫产|破腹产|抛腹产|开刀生产|带状疱疹).{0,80}(?:顺产|剖腹|刨腹|剖宫产|分娩方式|选择|还要不要.{0,8}检查|多久才生|可以么|可以吗|能不能|怎么办|调整|纠正|胸膝卧位|能生吗|催产|输催产液|危险|什么时候生|多久会分娩)|(?:顺产|剖腹|刨腹|剖宫产|分娩方式|多久才生|能生吗|催产液).{0,80}(?:过预产期|预产期|入盆|脐带|胎位不正|臀位|宫口|骨缝|宫颈管|羊水浑浊|胎盘|开刀生产|剖腹产|剖宫产|破腹产|抛腹产|带状疱疹)|(?:第一胎|头胎|第一个).{0,18}(?:剖腹|剖宫|破腹|抛腹).{0,60}(?:又怀孕|第二胎|顺产|能生)|(?:剖腹产后|剖宫产后|破腹产后|抛腹产后).{0,60}(?:又怀孕|能生|顺产|怎么办)|(?:室间隔缺损|先心病).{0,60}(?:怀孕|手术|生产之前)|(?:羊水.{0,12}偏多|心脏.{0,12}(?:亮光|有问题)|肚子里面的宝宝心脏|侧脑室宽|脊椎看不见).{0,60}(?:怎么办|怎么回事|控制|检查|正常吗|有事|问题|影响)/u;

const LOW_INFORMATION_CASE_TEMPLATE_PATTERN = /全部症状[:：].{0,140}发病时间及原因[:：].{0,140}治疗情况|全部症状[:：]\s*(?:发病时间|治疗情况)|发病时间及原因[:：]\s*治疗情况|患者信息[:：].{0,140}曾经治疗情况(?:及是否有过敏)?|想要得到什么帮助[（(]5个汉字以上[）)]|追问一下[，,、\s]*(?:宝宝|孩子|小孩)?.{0,16}(?:能吃吗|煮水|一次喝多少|喝多少)/u;

const ADULT_REPRODUCTIVE_CASE_PATTERN = /(?:月经|大姨妈|房事|同房|性生活|紧急避孕药|安全期|宫颈(?:糜|靡)烂|利普刀|尿血|血块|膀胱下坠|尿急尿痛|妇科病|阴道炎).{0,36}(?:怀孕|宝宝|孩子|小孩|怎么办|什么原因|影响)|(?:男性|男方|丈夫|老公).{0,18}(?:发烧|打针|吃药|用药|接种).{0,24}(?:性生活|怀孕|胎儿|宝宝)|(?:生完(?:小孩|孩子|宝宝)|生了孩子|生宝宝|产后|断奶后|坐月子|月子里|哺乳期).{0,80}(?:会阴撕裂|宫颈(?:糜|靡)烂|宫颈.{0,6}充血|利普刀|月经|月子病|关节疼痛|下面.{0,12}(?:有血|出血|流血)|乳房.{0,20}(?:一变大一变小|明显|大小不一|肿块|胀痛|疼|小了|变大)|尿血|膀胱下坠|高血压|血压|眼睛模糊|手麻|腿肿|尿道炎|尿急|漏尿|尿湿|侧切|伤口|阴道|盆腔炎|子宫增大|黑头|染头发|拉直头发|避孕)|(?:产后|剖腹产).{0,80}(?:便秘).{0,80}(?:中药|不敢瞎用药|胃肠科)|流产后.{0,80}(?:腰|膝|坐骨|神经|麻痹|风湿|优思明|妈富隆)|孩子.{0,8}两岁.{0,36}(?:体重|胖|170斤)|(?:性生活|同房).{0,24}(?:怀孕|胎儿|宝宝|影响)/u;

const EMERGENCY_OR_POISONING_CASE_PATTERN = /(?:水银|纽扣电池|异物|颗粒|硬币).{0,20}(?:吃了|吞了|入口|进嘴|误食|误吞)|(?:误吃|误服|误食|误吞).{0,24}(?:胶囊|药|药片|药丸|颗粒|益母草)|(?:呼吸困难|呼吸不畅|喘气不匀|昏睡|抽搐|抽风|窒息).{0,24}(?:宝宝|孩子|小孩|婴儿|新生儿|预防针|接种)|(?:宝宝|孩子|小孩|婴儿|新生儿).{0,24}(?:呼吸困难|呼吸不畅|喘气不匀|昏睡|抽搐|抽风|窒息)|(?:接种|疫苗|预防针|白百破|流感嗜血杆菌).{0,40}(?:嗜睡|没精神|急急急)|(?:嗜睡|没精神|急急急).{0,40}(?:接种|疫苗|预防针|白百破|流感嗜血杆菌)|(?:高烧|发高烧|高热|高烧不退).{0,40}(?:呕吐|腹泻|嗜睡|抽搐|抽风|针眼|发炎|红肿|宝宝|孩子)|(?:针眼|发炎|红肿).{0,40}(?:高烧不退|高烧|高热)|(?:血项|白细胞).{0,20}(?:30000|3万|高).{0,50}(?:反复发烧|反复发热|高烧|高热|肚子痛|腹痛)|(?:宝宝|孩子|小孩|婴儿|新生儿).{0,60}(?:水泡样|水泡)|(?:水泡样|水泡).{0,60}(?:宝宝|孩子|小孩|婴儿|新生儿)|(?:蛋花|水样|拉水|拉稀水).{0,40}(?:不爱喝奶|没有食欲|不吃奶|脱水)|(?:诊断|医生诊断).{0,40}(?:手足口病|病毒合并细菌感染).{0,80}(?:反复发热|反复发烧|发烧38|发热38|急急急|输液|挂水)|(?:食物中毒|野生菌).{0,60}(?:怀孕|孕|胎儿|腹痛|腹泻|呕吐|治疗)|(?:怀孕|孕).{0,40}(?:强烈撞击|撞击肚子|外伤).{0,40}(?:感觉不到胎动|胎动.{0,12}(?:没有|减少)|宝宝会不会出问题)|(?:颗粒|戒指|异物|木头).{0,24}(?:进嘴|入口|吃掉|吞|取出来)|(?:猫抓|狗咬|犬咬|抓伤).{0,40}(?:宝宝|孩子|小孩|女儿|儿子|打针|没打针|怕吗)|(?:发热|发烧).{0,8}39度.{0,24}(?:疫苗|接种|注射|怎么治|宝宝|孩子)|(?:接种|疫苗|预防针|百白破|脊灰).{0,50}(?:流鼻血|鼻血)|(?:孩子|宝宝|小孩).{0,20}(?:疼起来|疼得|特别厉害|使劲哭)/u;

const BIOMETRIC_MEASUREMENT_PATTERNS = [
  /双顶[径颈]/u,
  /BPD/iu,
  /HC/iu,
  /FL/iu,
  /AC/iu,
  /股骨(?:长)?/u,
  /头围/u,
  /腹围/u,
  /肱骨长/u,
  /羊水(?:指数|量|最大深度)?/u,
  /侧脑室/u,
  /颅后窝池/u,
  /脐动脉|S\/D/u,
  /B超|彩超|三维|四维/u,
];

const BIOMETRIC_CALCULATION_INTENT_PATTERN = /算(?:出|下)?|估计|大概|多重|多长|体重|身高|腿长|腿短|发育正常|正常吗|好生|顺产|专业解释|办法/u;

const HIGH_SENSITIVITY_PATTERN = /人流|人工流产|想要流产|引产|堕胎|坠胎|清宫|药流|药物流产|打掉(?:孩子|小孩|胎儿)|流掉(?:孩子|小孩|胎儿)|不要(?:这个)?(?:孩子|小孩|胎儿)|不想要(?:这个)?(?:孩子|小孩|胎儿)|不能要(?:了|这个)?(?:孩子|小孩|宝宝|胎儿)|继续留下.{0,12}(?:孩子|小孩|宝宝|胎儿)|孩子是不是不能要|(?:孩子|小孩|宝宝|胎儿).{0,8}(?:能不能要|能要吗|能要么|可以要吗|还能要吗)|(?:能不能要|能要吗|能要么|可以要吗|还能要吗).{0,8}(?:孩子|小孩|宝宝|胎儿)|宫外孕|异位妊娠|胎停|稽留流产|胎死|死胎|死产|死亡|猝死|畸形|大出血|脑内出血|缺氧|心脏发育异常|唐氏儿|癌|肿瘤/u;

const SENSITIVE_REPRODUCTIVE_DECISION_PATTERN = /(?:聋哑|遗传病|小三阳|大三阳|乙肝).{0,40}(?:可以|能不能|能否|是否).{0,8}(?:生孩子|要小孩|要孩子|怀孕)|(?:可以|能不能|能否|是否).{0,8}(?:生孩子|要小孩|要孩子|怀孕).{0,40}(?:聋哑|遗传病|小三阳|大三阳|乙肝)/u;

// Product-level blocklist for knowledge articles and authority cache records.
// Death-related terms are intentionally broad: even statistical/public-policy
// mentions such as "孕产妇死亡率" should not surface in the user-facing
// knowledge base.
const DEATH_RELATED_ZH_PATTERN = /死亡|死产|胎死|胎停|稽留流产|致死|猝死|身亡|溺亡|窒息死|遗体|讣告|殉职|殉难|哀悼|遇难|罹难|逝世|去世|过世|病故|早夭|夭折|死胎|尸检|尸体|要命/u;

const DEATH_RELATED_EN_PATTERN = /\b(?:deaths?|died|dying|deceased|fatal|fatality|fatalities|stillbirths?|stillborn|mortality|demise|perinatal\s+mortality|neonatal\s+deaths?|infant\s+deaths?|sudden\s+infant\s+death|sids|miscarriages?|stillbirth)\b/i;

const HIGH_SENSITIVITY_TOPIC_PATTERN = /胎死(?:腹中|宫内)?|胎停(?:育)?|稽留流产|胎儿宫内死亡|胎儿畸形(?:引产|终止妊娠)|引产案例|引产经历|堕胎(?:经历|过程|手术)|药流|打掉(?:孩子|小孩|胎儿)|流掉(?:孩子|小孩|胎儿)|不要(?:这个)?(?:孩子|小孩|胎儿)|遗腹子/u;

const SENSATIONAL_LANGUAGE_PATTERN = /(?:很要命|后患无穷|致命|可怕|惊人|惊悚|惊呆|噩耗|崩溃|惨剧|惨痛|血淋淋|绝症|悲剧|越来越多|不敢相信|高度警惕|都怪|这件事能|赶紧拿|赶紧用|分分钟|惊天|揪心|哭了|崩溃了|无人不知|无人不晓|惊曝|曝光|警惕!|当心!|千万别|太可怕|必看|秒懂|不妨试试|绝招|招数|支招|智力受损|补脑|不防不行|妈妈要早知|值得家长一看)/u;

const PSEUDO_MEDICAL_GENDER_SELECTION_PATTERN = /(?:备孕|怀孕|二胎|三胎|想要|要想|准备)[^，。！？]{0,8}(?:男孩|女孩|男宝|女宝|男娃|女娃|儿子)(?![名个])|(?:生|怀|要)(?:个)?(?:男孩|女孩|男宝|女宝|男娃|女娃)(?:[^，。！？]{0,12}(?:秘诀|偏方|方法|妙招|妙方|技巧|吃什么|怎么吃|食谱|配方|攻略|科学|备孕|攻略|攻略)|$|？|\?)|(?:男孩|女孩|男宝|女宝)[^，。！？]{0,6}(?:秘诀|偏方|妙方)|生男生女(?:秘诀|预测|看|早知道|提前知道)|清宫(?:表|图)预测|(?:酸性体质|碱性体质)[^，。！？]{0,8}(?:生男|生女|男孩|女孩)/u;

const PSEUDO_MEDICAL_QUACK_PATTERN = /(?:转骨|穿胎|安胎药偏方)|快速.{0,4}(?:根治|痊愈|康复)|根治.{0,4}(?:湿疹|肾病|白血病|脑瘫)|包治|祖传秘方|神奇.{0,4}(?:配方|方法|偏方)/u;

function getQuestion(record: KnowledgeGuardRecord): string {
  return (record.question || record.title || '').replace(/\s+/g, ' ').trim();
}

function getRecordText(record: KnowledgeGuardRecord): string {
  return [
    record.title || '',
    record.question || '',
    record.summary || '',
    record.answer || '',
    record.content || '',
    record.contentText || '',
    record.category || '',
    ...(record.tags || []),
    record.source || '',
    record.sourceOrg || '',
    record.source_org || '',
    record.sourceId || '',
    record.source_id || '',
    record.sourceClass || '',
    record.source_class || '',
    record.sourceUrl || '',
    record.source_url || '',
    record.url || '',
  ].join(' ');
}

export function containsDeathRelatedTerms(text: string): boolean {
  if (!text) {
    return false;
  }

  return DEATH_RELATED_ZH_PATTERN.test(text) || DEATH_RELATED_EN_PATTERN.test(text);
}

export function isHighRiskOrClickbaitTitle(title: string): string | null {
  const normalized = (title || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  if (!normalized) {
    return null;
  }

  if (containsDeathRelatedTerms(normalized)) {
    return 'death_related_term';
  }

  if (HIGH_SENSITIVITY_TOPIC_PATTERN.test(normalized)) {
    return 'high_sensitivity_topic';
  }

  if (PSEUDO_MEDICAL_GENDER_SELECTION_PATTERN.test(normalized)) {
    return 'pseudo_medical_gender_selection';
  }

  if (PSEUDO_MEDICAL_QUACK_PATTERN.test(normalized)) {
    return 'pseudo_medical_claim';
  }

  if (SENSATIONAL_LANGUAGE_PATTERN.test(normalized)) {
    return 'sensational_clickbait';
  }

  return null;
}

export function getAuthorityKnowledgeDropReason(record: KnowledgeGuardRecord): string | null {
  const titleReason = isHighRiskOrClickbaitTitle(getQuestion(record));
  if (titleReason) {
    return titleReason;
  }

  if (containsDeathRelatedTerms(getRecordText(record))) {
    return 'death_related_term';
  }

  if (HIGH_SENSITIVITY_TOPIC_PATTERN.test(getRecordText(record))) {
    return 'high_sensitivity_topic';
  }

  const medicalPlatformReason = getMedicalPlatformQualityDropReason({
    title: getQuestion(record),
    summary: record.summary,
    answer: record.answer || record.content,
    contentText: record.contentText,
    sourceId: record.sourceId || record.source_id,
    sourceOrg: record.sourceOrg || record.source_org,
    source: record.source,
    sourceClass: record.sourceClass || record.source_class,
    sourceUrl: record.sourceUrl || record.source_url || record.url,
    updatedAt: record.updatedAt || record.source_updated_at || record.updated_at || record.published_at || record.created_at,
  });
  if (medicalPlatformReason) {
    return medicalPlatformReason;
  }

  return null;
}

function hasProductScope(text: string): boolean {
  return PRODUCT_SCOPE_PATTERN.test(text);
}

function isPregnancyOrPostpartumContext(text: string): boolean {
  return /怀孕|孕妇|孕期|孕周|产检|胎儿|胎动|胎心|宫缩|预产期|分娩|顺产|剖宫产|产后|坐月子|月子|哺乳|母乳|备孕|孕前/u.test(text);
}

function isInfantChildCareContext(text: string): boolean {
  const planningContext = /准备要宝宝|想要宝宝|要宝宝|要孩子|准备要孩子|想要孩子|生孩子|生小孩/u.test(text);
  const careContext = /婴儿|新生儿|幼儿|小孩|孩子|月龄|辅食|喂奶|吃奶|奶量|配方奶|疫苗|接种|预防针|黄疸|脐带|湿疹|尿布|纸尿裤/u.test(text);
  const babyCareContext = /宝宝/u.test(text) && !planningContext;
  return careContext || babyCareContext;
}

function isPregnancyPlanningContext(text: string): boolean {
  return /备孕|孕前|准备怀孕|想怀孕|计划怀孕|准备要宝宝|想要宝宝|要宝宝|要孩子|准备要孩子|想要孩子|怀孕前|怀孕前期/u.test(text);
}

function isOffScopeAdultVaccineCase(text: string): boolean {
  return ADULT_VACCINE_OR_INJURY_PATTERN.test(text)
    && !isPregnancyOrPostpartumContext(text)
    && !isPregnancyPlanningContext(text)
    && !CHILD_CARE_SUBJECT_PATTERN.test(text);
}

function hasCategoryScopeConflict(record: KnowledgeGuardRecord): boolean {
  const category = record.category || '';
  const question = getQuestion(record);

  if ((category === 'parenting-newborn' || category === 'parenting-0-1') && TODDLER_OR_PRESCHOOL_AGE_PATTERN.test(question)) {
    return true;
  }

  if (category.startsWith('parenting-') && isPregnancyPlanningContext(question)) {
    return true;
  }

  if (category.startsWith('parenting-') && FETAL_CONTEXT_IN_PARENTING_CATEGORY_PATTERN.test(question)) {
    return true;
  }

  if (category.startsWith('parenting-') && isPregnancyOrPostpartumContext(question) && !isInfantChildCareContext(question)) {
    return true;
  }

  if (/^vaccine-/.test(category) && isPregnancyPlanningContext(question) && !CHILD_CARE_SUBJECT_PATTERN.test(question)) {
    return true;
  }

  if (category.startsWith('pregnancy-') && isInfantChildCareContext(question) && !isPregnancyOrPostpartumContext(question)) {
    return true;
  }

  if (/^vaccine-/.test(category) && !/疫苗|接种|打针|预防针|卡介|乙肝疫苗|百白破|麻腮风|脊灰/u.test(question)) {
    return true;
  }

  return false;
}

function isBiometricMeasurementCase(question: string): boolean {
  const matchedCount = BIOMETRIC_MEASUREMENT_PATTERNS.filter((pattern) => pattern.test(question)).length;
  if (matchedCount >= 2 && BIOMETRIC_CALCULATION_INTENT_PATTERN.test(question)) {
    return true;
  }

  if (/(?:BPD|HC|FL|AC)/iu.test(question) && /(?:体重|顺产|正常|发育|大小|小|估计|求)/u.test(question)) {
    return true;
  }

  if (/羊水(?:最大深度|指数|量|深径)?.{0,30}(?:胎儿体重|体重|\d+\s*g|少么|偏少|偏多|正常吗)|(?:胎儿体重|体重|\d+\s*g).{0,30}羊水/u.test(question)) {
    return true;
  }

  if (/做检查说股骨.{0,20}(?:腿短|有事|怎么办|正常吗)/u.test(question)) {
    return true;
  }

  return /(?:胎儿|宝宝|孩子).{0,18}(?:多重|多长|体重|身高)|(?:多重|多长|体重|身高).{0,18}(?:胎儿|宝宝|孩子)/u.test(question)
    && /(?:cm|mm|厘米|CM|MM|双顶|股骨|头围|腹围|肱骨)/u.test(question);
}

function isRepeatedQuestionTemplate(question: string): boolean {
  const normalized = question.replace(/[\s（）()【】？?。.!！,，:：、；;'"“”‘’~～-]/gu, '');
  if (normalized.length < 36) {
    return false;
  }

  return /^(.{12,80})\1{2,}/u.test(normalized);
}

export function getDatasetKnowledgeDropReason(record: KnowledgeGuardRecord): string | null {
  const question = getQuestion(record);
  if (!question || question.length < 4) {
    return 'empty_or_short_question';
  }

  const text = getRecordText(record);
  if (NON_CONTENT_PATTERN.test(text)) {
    return 'non_content_or_research';
  }

  if (LOW_INFORMATION_CASE_TEMPLATE_PATTERN.test(question) || isRepeatedQuestionTemplate(question)) {
    return 'low_information_case_template';
  }

  if (
    UNSUPPORTED_SERVICE_REQUEST_PATTERN.test(question)
    || SERVICE_ADMIN_REQUEST_PATTERN.test(question)
    || ENVIRONMENTAL_DIAGNOSTIC_REQUEST_PATTERN.test(question)
  ) {
    return 'unsupported_service_request';
  }

  if (!hasProductScope(question)) {
    return 'missing_product_scope';
  }

  if (BEYOND_CHILD_AGE_PATTERN.test(text) || OLDER_CHILD_AGE_PATTERN.test(question)) {
    return 'beyond_app_child_age';
  }

  if (OFF_SCOPE_ADULT_HEALTH_PATTERN.test(text) || ADULT_DERMATOLOGY_CASE_PATTERN.test(question)) {
    return 'off_scope_adult_health';
  }

  if (HIGH_SENSITIVITY_PATTERN.test(text) || SENSITIVE_REPRODUCTIVE_DECISION_PATTERN.test(question)) {
    return 'high_sensitivity_dataset_topic';
  }

  if (ADULT_REPRODUCTIVE_CASE_PATTERN.test(question)) {
    return 'adult_reproductive_case';
  }

  if (isOffScopeAdultVaccineCase(question)) {
    return 'category_scope_conflict';
  }

  if (
    DIAGNOSED_CASE_FOLLOWUP_PATTERN.test(question)
    || COMPLEX_NEONATAL_DIAGNOSED_CASE_PATTERN.test(question)
    || PERSONAL_BIRTH_DECISION_PATTERN.test(question)
  ) {
    return 'diagnosed_case_followup';
  }

  if (EMERGENCY_OR_POISONING_CASE_PATTERN.test(question)) {
    return 'emergency_or_poisoning_case';
  }

  if (isBiometricMeasurementCase(question)) {
    return 'biometric_measurement_case';
  }

  if (
    PERSONAL_TREATMENT_REQUEST_PATTERN.test(question)
    || SPECIFIC_PRODUCT_OR_EXPOSURE_RISK_PATTERN.test(question)
    || PERSONAL_MEDICATION_OR_EXPOSURE_PATTERN.test(question)
  ) {
    return 'personal_treatment_request';
  }

  const authorityReason = getAuthorityKnowledgeDropReason(record);
  if (authorityReason) {
    return authorityReason === 'death_related_term' || authorityReason === 'high_sensitivity_topic'
      ? 'high_sensitivity_dataset_topic'
      : authorityReason;
  }

  if (hasCategoryScopeConflict(record)) {
    return 'category_scope_conflict';
  }

  return null;
}

export function isOutOfScopeKnowledgeQuery(query: string): boolean {
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return false;
  }

  return NON_CONTENT_PATTERN.test(normalized)
    || SUPPORT_POLICY_QUERY_PATTERN.test(normalized)
    || UNSUPPORTED_SERVICE_REQUEST_PATTERN.test(normalized)
    || SERVICE_ADMIN_REQUEST_PATTERN.test(normalized)
    || ENVIRONMENTAL_DIAGNOSTIC_REQUEST_PATTERN.test(normalized)
    || isOffScopeAdultVaccineCase(normalized)
    || BEYOND_CHILD_AGE_PATTERN.test(normalized)
    || OFF_SCOPE_ADULT_HEALTH_PATTERN.test(normalized)
    || ADULT_DERMATOLOGY_CASE_PATTERN.test(normalized)
    || HIGH_SENSITIVITY_PATTERN.test(normalized)
    || SENSITIVE_REPRODUCTIVE_DECISION_PATTERN.test(normalized)
    || Boolean(isHighRiskOrClickbaitTitle(normalized))
    || containsDeathRelatedTerms(normalized);
}
