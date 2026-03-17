import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始种子数据...');

  // ============================================
  // 1. 创建一级分类
  // ============================================
  console.log('📂 创建一级分类...');
  
  const categoryPregnancy = await prisma.category.upsert({
    where: { slug: 'pregnancy' },
    update: {},
    create: {
      name: '孕期知识',
      slug: 'pregnancy',
      description: '孕期相关知识，包括备孕、孕早中晚期、分娩等内容',
      icon: 'icon-pregnancy',
      level: 1,
      sortOrder: 1,
      articleCount: 0,
      isActive: 1
    }
  });

  const categoryParenting = await prisma.category.upsert({
    where: { slug: 'parenting' },
    update: {},
    create: {
      name: '育儿知识',
      slug: 'parenting',
      description: '育儿相关知识，包括0-1岁、1-3岁、3-6岁、安全教育等',
      icon: 'icon-parenting',
      level: 1,
      sortOrder: 2,
      articleCount: 0,
      isActive: 1
    }
  });

  const categoryNutrition = await prisma.category.upsert({
    where: { slug: 'nutrition' },
    update: {},
    create: {
      name: '营养健康',
      slug: 'nutrition',
      description: '营养健康相关知识，包括孕期营养、婴幼儿营养等',
      icon: 'icon-nutrition',
      level: 1,
      sortOrder: 3,
      articleCount: 0,
      isActive: 1
    }
  });

  const categoryFaq = await prisma.category.upsert({
    where: { slug: 'faq' },
    update: {},
    create: {
      name: '常见问题',
      slug: 'faq',
      description: '常见问题解答，包括疾病护理、疫苗接种、生长发育、心理行为等',
      icon: 'icon-faq',
      level: 1,
      sortOrder: 4,
      articleCount: 0,
      isActive: 1
    }
  });

  // ============================================
  // 2. 创建二级分类
  // ============================================
  console.log('📂 创建二级分类...');

  // 孕期知识子分类
  const pregnancyCategories = [
    { name: '备孕指南', slug: 'pregnancy-prep', description: '孕前准备、身体调理、心理准备', sortOrder: 1 },
    { name: '孕早期', slug: 'pregnancy-early', description: '0-12周，孕吐、建档、产检', sortOrder: 2 },
    { name: '孕中期', slug: 'pregnancy-mid', description: '13-28周，胎动、大排畸、妊娠糖尿病筛查', sortOrder: 3 },
    { name: '孕晚期', slug: 'pregnancy-late', description: '29-40周，胎位、分娩准备、临产征兆', sortOrder: 4 },
    { name: '分娩知识', slug: 'pregnancy-birth', description: '分娩方式、产程、产后恢复', sortOrder: 5 }
  ];

  for (const cat of pregnancyCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: `icon-${cat.slug}`,
        parentId: categoryPregnancy.id,
        level: 2,
        sortOrder: cat.sortOrder,
        articleCount: 0,
        isActive: 1
      }
    });
  }

  // 育儿知识子分类
  const parentingCategories = [
    { name: '0-1岁', slug: 'parenting-0-1', description: '新生儿护理、喂养、睡眠、发育里程碑', sortOrder: 1 },
    { name: '1-3岁', slug: 'parenting-1-3', description: '幼儿期、语言发展、行为习惯、早教', sortOrder: 2 },
    { name: '3-6岁', slug: 'parenting-3-6', description: '学龄前、入园准备、性格培养、学习能力', sortOrder: 3 },
    { name: '安全教育', slug: 'parenting-safety', description: '居家安全、户外安全、急救知识', sortOrder: 4 }
  ];

  for (const cat of parentingCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: `icon-${cat.slug}`,
        parentId: categoryParenting.id,
        level: 2,
        sortOrder: cat.sortOrder,
        articleCount: 0,
        isActive: 1
      }
    });
  }

  // 营养健康子分类
  const nutritionCategories = [
    { name: '孕期营养', slug: 'nutrition-pregnancy', description: '孕期饮食、营养补充、体重管理', sortOrder: 1 },
    { name: '婴幼儿营养', slug: 'nutrition-baby', description: '辅食添加、奶粉选择、营养均衡', sortOrder: 2 },
    { name: '儿童营养', slug: 'nutrition-child', description: '成长营养、挑食问题、健康食谱', sortOrder: 3 },
    { name: '特殊饮食', slug: 'nutrition-special', description: '过敏宝宝、早产儿、特殊体质', sortOrder: 4 }
  ];

  for (const cat of nutritionCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: `icon-${cat.slug}`,
        parentId: categoryNutrition.id,
        level: 2,
        sortOrder: cat.sortOrder,
        articleCount: 0,
        isActive: 1
      }
    });
  }

  // 常见问题子分类
  const faqCategories = [
    { name: '疾病护理', slug: 'faq-disease', description: '常见疾病、家庭护理、就医指南', sortOrder: 1 },
    { name: '疫苗接种', slug: 'faq-vaccine', description: '疫苗时间表、接种注意事项、不良反应', sortOrder: 2 },
    { name: '生长发育', slug: 'faq-growth', description: '身高体重、发育评估、异常情况', sortOrder: 3 },
    { name: '心理行为', slug: 'faq-psychology', description: '情绪管理、行为问题、亲子关系', sortOrder: 4 }
  ];

  for (const cat of faqCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: `icon-${cat.slug}`,
        parentId: categoryFaq.id,
        level: 2,
        sortOrder: cat.sortOrder,
        articleCount: 0,
        isActive: 1
      }
    });
  }

  // ============================================
  // 3. 创建标签
  // ============================================
  console.log('🏷️ 创建标签...');

  const tags = [
    { name: '孕早期', slug: 'yun-zao-qi', color: '#FF6B6B' },
    { name: '孕中期', slug: 'yun-zhong-qi', color: '#4ECDC4' },
    { name: '孕晚期', slug: 'yun-wan-qi', color: '#45B7D1' },
    { name: '产检', slug: 'chan-jian', color: '#96CEB4' },
    { name: '营养', slug: 'ying-yang', color: '#FFEAA7' },
    { name: '辅食', slug: 'fu-shi', color: '#DDA0DD' },
    { name: '疫苗接种', slug: 'yi-miao', color: '#98D8C8' },
    { name: '新生儿', slug: 'xin-sheng-er', color: '#F7DC6F' },
    { name: '育儿', slug: 'yu-er', color: '#BB8FCE' },
    { name: '产后恢复', slug: 'chan-hou-hui-fu', color: '#85C1E9' }
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: {
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        articleCount: 0
      }
    });
  }

  // ============================================
  // 4. 创建作者
  // ============================================
  console.log('👨‍⚕️ 创建作者...');

  await prisma.author.upsert({
    where: { id: 1n },
    update: {},
    create: {
      name: '李医生',
      avatar: 'https://cdn.example.com/avatars/dr-li.jpg',
      title: '妇产科主任医师',
      bio: '从事妇产科临床工作20年，擅长高危妊娠管理和产前诊断。',
      isVerified: 1,
      status: 1
    }
  });

  await prisma.author.upsert({
    where: { id: 2n },
    update: {},
    create: {
      name: '王医生',
      avatar: 'https://cdn.example.com/avatars/dr-wang.jpg',
      title: '儿科主任医师',
      bio: '从事儿科临床工作15年，擅长儿童生长发育评估和常见病防治。',
      isVerified: 1,
      status: 1
    }
  });

  // ============================================
  // 5. 创建疫苗信息
  // ============================================
  console.log('💉 创建疫苗信息...');

  const vaccines = [
    {
      name: '乙肝疫苗',
      nameEn: 'Hepatitis B Vaccine',
      category: '一类疫苗',
      description: '预防乙型肝炎病毒感染',
      preventDisease: '乙型肝炎',
      minMonth: 0,
      doseCount: 3,
      doseInterval: 30
    },
    {
      name: '卡介苗',
      nameEn: 'BCG Vaccine',
      category: '一类疫苗',
      description: '预防结核病',
      preventDisease: '结核病',
      minMonth: 0,
      doseCount: 1
    },
    {
      name: '脊髓灰质炎疫苗',
      nameEn: 'Polio Vaccine',
      category: '一类疫苗',
      description: '预防脊髓灰质炎（小儿麻痹症）',
      preventDisease: '脊髓灰质炎',
      minMonth: 2,
      doseCount: 4,
      doseInterval: 30
    },
    {
      name: '百白破疫苗',
      nameEn: 'DTP Vaccine',
      category: '一类疫苗',
      description: '预防百日咳、白喉、破伤风',
      preventDisease: '百日咳、白喉、破伤风',
      minMonth: 3,
      doseCount: 4,
      doseInterval: 30
    },
    {
      name: '麻疹疫苗',
      nameEn: 'Measles Vaccine',
      category: '一类疫苗',
      description: '预防麻疹',
      preventDisease: '麻疹',
      minMonth: 8,
      doseCount: 2,
      doseInterval: 365
    },
    {
      name: '乙脑疫苗',
      nameEn: 'JE Vaccine',
      category: '一类疫苗',
      description: '预防流行性乙型脑炎',
      preventDisease: '流行性乙型脑炎',
      minMonth: 8,
      doseCount: 2
    },
    {
      name: '流感疫苗',
      nameEn: 'Influenza Vaccine',
      category: '二类疫苗',
      description: '预防流行性感冒',
      preventDisease: '流行性感冒',
      minMonth: 6,
      doseCount: 1
    },
    {
      name: '水痘疫苗',
      nameEn: 'Varicella Vaccine',
      category: '二类疫苗',
      description: '预防水痘',
      preventDisease: '水痘',
      minMonth: 12,
      doseCount: 2
    },
    {
      name: '肺炎疫苗',
      nameEn: 'Pneumococcal Vaccine',
      category: '二类疫苗',
      description: '预防肺炎球菌感染',
      preventDisease: '肺炎球菌性疾病',
      minMonth: 2,
      doseCount: 4
    },
    {
      name: '轮状病毒疫苗',
      nameEn: 'Rotavirus Vaccine',
      category: '二类疫苗',
      description: '预防轮状病毒引起的腹泻',
      preventDisease: '轮状病毒腹泻',
      minMonth: 2,
      doseCount: 3
    }
  ];

  for (const vaccine of vaccines) {
    await prisma.vaccine.upsert({
      where: { name: vaccine.name },
      update: {},
      create: vaccine
    });
  }

  // ============================================
  // 6. 创建测试用户
  // ============================================
  console.log('👤 创建测试用户...');

  const passwordHash = await bcrypt.hash('Test123456!', 10);

  await prisma.user.upsert({
    where: { username: 'testuser' },
    update: {},
    create: {
      username: 'testuser',
      passwordHash,
      nickname: '测试用户',
      email: 'test@example.com',
      phone: '13800138000',
      status: 1
    }
  });

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      nickname: '管理员',
      email: 'admin@example.com',
      status: 1
    }
  });

  // ============================================
  // 完成
  // ============================================
  console.log('✅ 种子数据创建完成！');
  
  // 统计
  const categoryCount = await prisma.category.count();
  const tagCount = await prisma.tag.count();
  const vaccineCount = await prisma.vaccine.count();
  const userCount = await prisma.user.count();
  const authorCount = await prisma.author.count();

  console.log('\n📊 种子数据统计:');
  console.log(`  - 分类: ${categoryCount} 个`);
  console.log(`  - 标签: ${tagCount} 个`);
  console.log(`  - 疫苗: ${vaccineCount} 种`);
  console.log(`  - 用户: ${userCount} 个`);
  console.log(`  - 作者: ${authorCount} 位`);
}

main()
  .catch((e) => {
    console.error('❌ 种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });