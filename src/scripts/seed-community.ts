import '../config/env'

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const TOTAL_POSTS = 100
const TOTAL_ROOT_COMMENTS = 80
const TOTAL_REPLY_COMMENTS = 120
const PASSWORD = 'Test123456!'
const SEED_EMAIL_PREFIX = 'community.seed.'

type SeedUserProfile = {
  username: string
  nickname: string
  gender: number
  pregnancyStatus: number
}

type CategoryInfo = {
  id: bigint
  name: string
  slug: string
}

type TagInfo = {
  id: bigint
  name: string
}

type TopicTemplate = {
  keywords: string[]
  titleTemplates: string[]
  contentTemplates: string[]
}

type CreatedPost = {
  id: bigint
  authorId: bigint
  createdAt: Date
}

type CreatedRootComment = {
  id: bigint
  postId: bigint
  authorId: bigint
  createdAt: Date
}

const seedUserProfiles: SeedUserProfile[] = [
  { username: 'beiyun_xiaoyu', nickname: '备孕小雨', gender: 2, pregnancyStatus: 1 },
  { username: 'beiyun_anning', nickname: '备孕安宁', gender: 2, pregnancyStatus: 1 },
  { username: 'liangdao_ganggang', nickname: '两道杠杠', gender: 2, pregnancyStatus: 1 },
  { username: 'yesuan_rourou', nickname: '叶酸柔柔', gender: 2, pregnancyStatus: 1 },
  { username: 'yunzao_mumu', nickname: '孕早沐沐', gender: 2, pregnancyStatus: 2 },
  { username: 'yunzao_keke', nickname: '孕早可可', gender: 2, pregnancyStatus: 2 },
  { username: 'yunma_anning', nickname: '孕妈阿宁', gender: 2, pregnancyStatus: 2 },
  { username: 'yunzhong_wanwan', nickname: '孕中晚晚', gender: 2, pregnancyStatus: 2 },
  { username: 'taidong_mama', nickname: '胎动妈妈', gender: 2, pregnancyStatus: 2 },
  { username: 'chanjian_xiaotang', nickname: '产检小棠', gender: 2, pregnancyStatus: 2 },
  { username: 'dayi_mama', nickname: '大姨妈妈', gender: 2, pregnancyStatus: 2 },
  { username: 'yunyun_mama', nickname: '孕云妈妈', gender: 2, pregnancyStatus: 2 },
  { username: 'yunwan_xiaoli', nickname: '孕晚小梨', gender: 2, pregnancyStatus: 2 },
  { username: 'daichan_bao', nickname: '待产包包', gender: 2, pregnancyStatus: 2 },
  { username: 'yuezi_xiaotang', nickname: '月子小棠', gender: 2, pregnancyStatus: 3 },
  { username: 'xinshoumama_keke', nickname: '新手妈妈可可', gender: 2, pregnancyStatus: 3 },
  { username: 'naifen_mama', nickname: '奶粉妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'muru_xiaoqi', nickname: '母乳小七', gender: 2, pregnancyStatus: 3 },
  { username: 'hongshui_ma', nickname: '哄睡妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'paige_yaya', nickname: '拍嗝芽芽', gender: 2, pregnancyStatus: 3 },
  { username: 'xinshou_yuer', nickname: '新手育儿', gender: 2, pregnancyStatus: 3 },
  { username: 'baobao_mili', nickname: '宝宝米粒', gender: 2, pregnancyStatus: 3 },
  { username: 'mengtong_mama', nickname: '萌童妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'duoduo_mama', nickname: '朵朵妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'guaiqiao_bao', nickname: '乖巧包包', gender: 2, pregnancyStatus: 3 },
  { username: 'tuiban_baba', nickname: '托班爸爸', gender: 1, pregnancyStatus: 3 },
  { username: 'ketang_baba', nickname: '课堂爸爸', gender: 1, pregnancyStatus: 3 },
  { username: 'erbao_mama', nickname: '二宝妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'ertai_wanwan', nickname: '二胎晚晚', gender: 2, pregnancyStatus: 3 },
  { username: 'zaojiao_mumu', nickname: '早教沐沐', gender: 2, pregnancyStatus: 3 },
  { username: 'fushimama', nickname: '辅食妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'changgaowawa', nickname: '长高娃娃', gender: 2, pregnancyStatus: 3 },
  { username: 'miaomiao_mama', nickname: '喵喵妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'zhouzhou_mama', nickname: '周周妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'nuonuo_mama', nickname: '糯糯妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'guoguo_mama', nickname: '果果妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'xiyou_mama', nickname: '西柚妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'tangtang_ma', nickname: '糖糖妈', gender: 2, pregnancyStatus: 3 },
  { username: 'chengcheng_ma', nickname: '橙橙妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'lele_mami', nickname: '乐乐妈咪', gender: 2, pregnancyStatus: 3 },
  { username: 'qiaomai_mama', nickname: '荞麦妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'yuanan_mama', nickname: '予安妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'wenyan_mama', nickname: '温言妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'anan_mama', nickname: '安安妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'hehe_mama', nickname: '禾禾妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'zhizhi_mama', nickname: '芝芝妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'paofu_mama', nickname: '泡芙妈妈', gender: 2, pregnancyStatus: 3 },
  { username: 'zhouchou_baba', nickname: '粥粥爸爸', gender: 1, pregnancyStatus: 3 },
]

const topicTemplates: TopicTemplate[] = [
  {
    keywords: ['pregnancy', 'early', '备孕', '孕早', 'pregnancy-prep'],
    titleTemplates: [
      '备孕第{week}个月了，大家都怎么安排作息？',
      '孕早期总是犯困，正常上班怎么调整比较好？',
      '刚测出两道杠，第一时间需要做哪些准备？',
      '叶酸已经吃了{week}周，还需要补别的营养吗？',
    ],
    contentTemplates: [
      '这两天白天特别容易没精神，晚上又睡得不算踏实。想问下大家都是怎么安排三餐和休息的，能兼顾上班最好。',
      '刚进入这个阶段，很多事情都不太确定，家里人说法也不一样。想听听有经验的姐妹怎么做，心里能踏实一点。',
      '最近开始认真记录饮食和睡眠，但还是会担心自己做得不够好。有没有比较实用、不过度折腾的日常建议？',
    ],
  },
  {
    keywords: ['pregnancy-mid', '孕中', '营养', 'nutrition-pregnancy'],
    titleTemplates: [
      '孕{week}周胃口突然变好，体重控制要注意什么？',
      '孕中期开始有胎动了，大家会固定做胎动记录吗？',
      '大排畸前有点紧张，想听听大家都是怎么准备的',
      '孕中期腰酸明显，坐办公室有没有缓解办法？',
    ],
    contentTemplates: [
      '最近胃口比前阵子好很多，但也怕长得太快。饭量增加之后怎么吃会更稳一些，想参考大家的搭配。',
      '工作日坐得比较久，下午腰背容易酸，回家也懒得动。有没有简单一点、在家就能做的舒缓方法？',
      '开始能感受到小家伙动来动去，心情会变好很多，但偶尔又担心是不是动得太少。大家一般怎么观察会比较安心？',
    ],
  },
  {
    keywords: ['pregnancy-late', 'pregnancy-birth', '孕晚', '分娩'],
    titleTemplates: [
      '孕晚期晚上翻身好困难，大家都用什么睡姿？',
      '待产包准备到第{week}周比较合适？',
      '快到预产期了，假性宫缩和临产怎么区分？',
      '孕晚期脚肿得厉害，白天工作要怎么缓解？',
    ],
    contentTemplates: [
      '最近晚上睡觉频繁醒，翻身也不太方便。枕头已经垫了好几个，还是想看看大家有没有更好用的办法。',
      '家里已经开始准备宝宝用品了，但总觉得自己漏东西。有没有大家反复用下来觉得真的有必要带去医院的物品？',
      '越接近预产期越有点紧张，身体一点小变化都会多想。想提前做做功课，免得到时候手忙脚乱。',
    ],
  },
  {
    keywords: ['parenting', '0-1', '新生儿', 'nutrition-baby'],
    titleTemplates: [
      '宝宝{week}个月睡眠有点倒退，大家怎么接住这个阶段？',
      '新生儿白天睡整觉、晚上闹腾，作息还能调整回来吗？',
      '母乳转混合喂养第一周，有没有容易踩坑的地方？',
      '宝宝吐奶有点频繁，拍嗝和喂养节奏怎么安排？',
    ],
    contentTemplates: [
      '这几天明显感觉宝宝的节奏变了，抱睡和放下之间反复拉扯。想问问大家是不是都会遇到这个阶段，最后怎么慢慢稳定下来的。',
      '家里老人和我在喂养方式上意见不太统一，我也怕自己太焦虑。希望听一些更接地气、好执行的经验。',
      '我有在记录吃奶和睡眠情况，但看久了反而更紧张。有没有适合新手爸妈的判断标准，知道什么时候算正常就行。',
    ],
  },
  {
    keywords: ['1-3', '3-6', '育儿', 'faq-growth', 'faq-psychology'],
    titleTemplates: [
      '两岁宝宝最近特别黏人，是分离焦虑还是安全感不足？',
      '宝宝吃饭总要追着喂，大家是怎么慢慢改过来的？',
      '准备上幼儿园了，孩子最近情绪波动有点大',
      '三岁半突然爱说“不”，这个阶段怎么沟通更顺？',
    ],
    contentTemplates: [
      '最近明显感觉孩子情绪起伏比较大，尤其是我去上班或者出门一会儿的时候。想听听大家怎么做过渡，会不会需要提前练习。',
      '我们家小朋友脾气其实不算大，但一碰到吃饭或者出门就开始拖拉。讲道理能听一点，就是执行总是反复。',
      '很想用温和一点的方式和孩子沟通，但有时候自己也会被消耗。希望看看大家有没有既不太硬碰硬、又比较有效的方法。',
    ],
  },
  {
    keywords: ['faq-vaccine', 'faq-disease', 'parenting-safety', 'nutrition-child'],
    titleTemplates: [
      '宝宝打完疫苗当天有点闹，大家一般怎么护理？',
      '换季后孩子总是反复流鼻涕，居家护理先做什么？',
      '开始上托班后总生病，家长心态怎么稳住？',
      '孩子最近挑食明显，晚饭总吃两口就不肯吃了',
    ],
    contentTemplates: [
      '知道小朋友成长过程中难免会经历这些，但轮到自己还是会紧张。想先听听大家在家通常会怎么观察、怎么护理。',
      '家里老人一着急就想给很多处理意见，我反而更容易乱。有没有比较简单的经验可以参考，至少心里有个顺序。',
      '最近天气变化比较快，孩子状态也跟着起伏。想看看大家有没有容易坚持的日常做法，帮助娃稳定一点。',
    ],
  },
]

const rootCommentTemplates = [
  '我前阵子也经历过，先别太焦虑，先把作息和吃饭节奏稳住会好很多。',
  '这个阶段真的很常见，我当时是先观察两三天，再决定要不要调整方式。',
  '可以先记一下时间点和触发场景，很多时候规律找到了就没那么慌。',
  '我们家那会儿也是这样，后来把节奏放慢一点，反而状态更稳定。',
  '理解你现在的心情，我当时也是一边查资料一边担心，后来发现很多情况没想得那么严重。',
  '如果只是最近这几天明显一点，可以先看看是不是睡眠、天气或者饮食变化带来的。',
  '家里人意见多的时候更容易焦虑，你先按自己觉得最稳妥的一套执行两天看看。',
  '可以先从最容易做到的一件小事开始改，不用一下子把所有环节都调整。',
]

const replyCommentTemplates = [
  '赞同你这个办法，我后来也是这么做，确实没那么手忙脚乱了。',
  '这个提醒很有用，尤其是先观察再调整，心态会稳很多。',
  '我准备也试试你说的节奏，感觉比一味硬扛更适合普通家庭。',
  '看到你的分享安心不少，原来不是只有我们家会反复这样。',
  '这个细节我之前没注意到，难怪总觉得自己越忙越乱。',
  '谢谢你说得这么具体，这种真实经验比网上那些模板化建议实用多了。',
  '我们家情况有点像，回头我也按你这个顺序试试。',
  '确实，很多时候不是一下就好，但慢慢调整会看到变化。',
]

function createRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function randomInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function pickOne<T>(rng: () => number, items: T[]): T {
  return items[randomInt(rng, 0, items.length - 1)]
}

function pickUnique<T>(rng: () => number, items: T[], count: number): T[] {
  const copy = [...items]
  const result: T[] = []
  const take = Math.min(count, copy.length)

  for (let index = 0; index < take; index += 1) {
    const pickedIndex = randomInt(rng, 0, copy.length - 1)
    const [item] = copy.splice(pickedIndex, 1)
    result.push(item)
  }

  return result
}

function buildAvatarUrl(nickname: string) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nickname)}`
}

function toSeedEmail(index: number) {
  return `${SEED_EMAIL_PREFIX}${String(index + 1).padStart(3, '0')}@example.com`
}

function pickTopic(index: number) {
  return topicTemplates[index % topicTemplates.length]
}

function findCategoryForTopic(topic: TopicTemplate, categories: CategoryInfo[], rng: () => number) {
  const matched = categories.filter((category) =>
    topic.keywords.some((keyword) => category.slug.includes(keyword) || category.name.includes(keyword))
  )

  if (matched.length > 0) {
    return pickOne(rng, matched)
  }

  return categories.length > 0 && rng() > 0.2 ? pickOne(rng, categories) : null
}

function createPostTitle(topic: TopicTemplate, index: number) {
  const raw = topic.titleTemplates[index % topic.titleTemplates.length]
  return raw.replaceAll('{week}', String((index % 28) + 8))
}

function createPostContent(topic: TopicTemplate, nickname: string, index: number) {
  const detail = topic.contentTemplates[index % topic.contentTemplates.length]
  const openerPool = [
    `${nickname}来社区请教一下，`,
    '这几天一直在想这件事，',
    '想认真听听大家的真实经验，',
    '家里最近围绕这个问题讨论很多，',
  ]
  const closerPool = [
    '如果你们有踩坑或者有效的小经验，也欢迎一起说说。',
    '希望能听到一些日常家庭里真正能执行的建议。',
    '谢谢大家，先提前收藏学习一下。',
    '不求一步到位，先把心态稳住也很重要。',
  ]

  return `${openerPool[index % openerPool.length]}${detail}${closerPool[index % closerPool.length]}`
}

function createRootCommentContent(index: number) {
  return rootCommentTemplates[index % rootCommentTemplates.length]
}

function createReplyCommentContent(index: number) {
  return replyCommentTemplates[index % replyCommentTemplates.length]
}

function createPostCreatedAt(index: number, rng: () => number) {
  const now = Date.now()
  const baseOffsetHours = (TOTAL_POSTS - index) * 6
  const jitterMinutes = randomInt(rng, 5, 150)
  return new Date(now - baseOffsetHours * 60 * 60 * 1000 - jitterMinutes * 60 * 1000)
}

function createEngagementCreatedAt(baseDate: Date, rng: () => number, minMinutes: number, maxMinutes: number) {
  return new Date(baseDate.getTime() + randomInt(rng, minMinutes, maxMinutes) * 60 * 1000)
}

async function clearExistingCommunitySeedData(seedUserIds: bigint[]) {
  if (seedUserIds.length === 0) return

  console.log('🧹 清理旧的社区种子数据...')

  await prisma.communityReport.deleteMany({
    where: {
      OR: [
        { reporterId: { in: seedUserIds } },
        { post: { authorId: { in: seedUserIds } } },
        { comment: { authorId: { in: seedUserIds } } },
      ],
    },
  })

  await prisma.communityPostLike.deleteMany({
    where: {
      OR: [
        { userId: { in: seedUserIds } },
        { post: { authorId: { in: seedUserIds } } },
      ],
    },
  })

  await prisma.communityComment.deleteMany({
    where: {
      authorId: { in: seedUserIds },
    },
  })

  await prisma.communityPost.deleteMany({
    where: {
      authorId: { in: seedUserIds },
    },
  })
}

async function main() {
  console.log('🌱 开始生成社区种子数据...')

  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const rng = createRng(20260405)

  const existingSeedUsers = await prisma.user.findMany({
    where: {
      email: {
        startsWith: SEED_EMAIL_PREFIX,
      },
    },
    select: { id: true },
  })

  await clearExistingCommunitySeedData(existingSeedUsers.map((item) => item.id))

  console.log(`👥 准备社区用户 ${seedUserProfiles.length} 个...`)

  const users = []
  for (let index = 0; index < seedUserProfiles.length; index += 1) {
    const profile = seedUserProfiles[index]
    const seedEmail = toSeedEmail(index)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: seedEmail },
          { username: profile.username },
        ],
      },
      select: { id: true },
    })

    const userData = {
      username: profile.username,
      email: seedEmail,
      passwordHash,
      nickname: profile.nickname,
      avatar: buildAvatarUrl(profile.nickname),
      gender: profile.gender,
      pregnancyStatus: profile.pregnancyStatus,
      status: 1,
    }

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: userData,
          select: {
            id: true,
            nickname: true,
          },
        })
      : await prisma.user.create({
          data: userData,
          select: {
            id: true,
            nickname: true,
          },
        })

    users.push(user)
  }

  const [categories, tags] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: 1 },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, name: true, slug: true },
    }),
    prisma.tag.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  console.log(`📝 开始创建帖子 ${TOTAL_POSTS} 条...`)

  const posts: CreatedPost[] = []
  for (let index = 0; index < TOTAL_POSTS; index += 1) {
    const topic = pickTopic(index)
    const author = pickOne(rng, users)
    const createdAt = createPostCreatedAt(index, rng)
    const category = findCategoryForTopic(topic, categories, rng)
    const postTags = tags.length > 0 && rng() > 0.15
      ? pickUnique(rng, tags, randomInt(rng, 0, Math.min(tags.length, 2)))
      : []

    const post = await prisma.communityPost.create({
      data: {
        authorId: author.id,
        title: createPostTitle(topic, index),
        content: createPostContent(topic, author.nickname || '宝妈', index),
        categoryId: category?.id ?? null,
        viewCount: randomInt(rng, 28, 680),
        likeCount: 0,
        commentCount: 0,
        status: 'published',
        isAnonymous: rng() > 0.86 ? 1 : 0,
        isPinned: index < 3 ? 1 : 0,
        isFeatured: index < 8 ? 1 : 0,
        createdAt,
        updatedAt: createdAt,
        tags: postTags.length > 0
          ? {
              create: postTags.map((tag) => ({
                tagId: tag.id,
                createdAt,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        authorId: true,
        createdAt: true,
      },
    })

    posts.push(post)
  }

  console.log('👍 开始补充点赞数据...')

  for (const post of posts) {
    const likerCandidates = users.filter((user) => user.id !== post.authorId)
    const likeCount = likerCandidates.length > 0 ? randomInt(rng, 0, Math.min(12, likerCandidates.length)) : 0
    const likers = pickUnique(rng, likerCandidates, likeCount)

    if (likers.length === 0) continue

    await prisma.communityPostLike.createMany({
      data: likers.map((liker) => ({
        postId: post.id,
        userId: liker.id,
        createdAt: createEngagementCreatedAt(post.createdAt, rng, 30, 60 * 24 * 5),
      })),
    })

    await prisma.communityPost.update({
      where: { id: post.id },
      data: { likeCount: likers.length },
    })
  }

  console.log(`💬 开始创建一级评论 ${TOTAL_ROOT_COMMENTS} 条...`)

  const rootComments: CreatedRootComment[] = []
  for (let index = 0; index < TOTAL_ROOT_COMMENTS; index += 1) {
    const post = pickOne(rng, posts)
    const commentAuthorPool = users.filter((user) => user.id !== post.authorId)
    const author = commentAuthorPool.length > 0 ? pickOne(rng, commentAuthorPool) : pickOne(rng, users)
    const createdAt = createEngagementCreatedAt(post.createdAt, rng, 20, 60 * 24 * 7)

    const comment = await prisma.communityComment.create({
      data: {
        postId: post.id,
        authorId: author.id,
        content: createRootCommentContent(index),
        createdAt,
        updatedAt: createdAt,
      },
      select: {
        id: true,
        postId: true,
        authorId: true,
        createdAt: true,
      },
    })

    rootComments.push(comment)
  }

  console.log(`↩️ 开始创建楼中回复 ${TOTAL_REPLY_COMMENTS} 条...`)

  for (let index = 0; index < TOTAL_REPLY_COMMENTS; index += 1) {
    const rootComment = pickOne(rng, rootComments)
    const replyAuthorPool = users.filter((user) => user.id !== rootComment.authorId)
    const author = replyAuthorPool.length > 0 ? pickOne(rng, replyAuthorPool) : pickOne(rng, users)
    const createdAt = createEngagementCreatedAt(rootComment.createdAt, rng, 10, 60 * 24 * 4)

    await prisma.communityComment.create({
      data: {
        postId: rootComment.postId,
        authorId: author.id,
        parentId: rootComment.id,
        replyToId: rootComment.id,
        content: createReplyCommentContent(index),
        createdAt,
        updatedAt: createdAt,
      },
    })
  }

  console.log('🔢 回写帖子评论统计...')

  const commentCounts = await prisma.communityComment.groupBy({
    by: ['postId'],
    _count: { _all: true },
  })

  for (const item of commentCounts) {
    await prisma.communityPost.update({
      where: { id: item.postId },
      data: { commentCount: item._count._all },
    })
  }

  const [postCount, commentCount, likeCount] = await Promise.all([
    prisma.communityPost.count({
      where: {
        authorId: {
          in: users.map((user) => user.id),
        },
      },
    }),
    prisma.communityComment.count({
      where: {
        authorId: {
          in: users.map((user) => user.id),
        },
      },
    }),
    prisma.communityPostLike.count({
      where: {
        userId: {
          in: users.map((user) => user.id),
        },
      },
    }),
  ])

  console.log('✅ 社区种子数据生成完成！')
  console.log(`  - 社区用户: ${users.length} 个`)
  console.log(`  - 帖子: ${postCount} 条`)
  console.log(`  - 评论/回复: ${commentCount} 条`)
  console.log(`  - 点赞: ${likeCount} 条`)
  console.log(`  - 默认密码: ${PASSWORD}`)
}

main()
  .catch((error) => {
    console.error('❌ 社区种子数据生成失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
