const express = require('express');
const router = express.Router();

// 产品数据库
const PRODUCTS = [
  {
    id: '1',
    title: '高铁米粉',
    subtitle: '婴儿辅食首选',
    price: '39.9',
    originalPrice: '59',
    image: 'https://via.placeholder.com/200x200?text=米粉',
    scene: 'weaning',
    reason: '您正在关注辅食添加，适合6月龄左右首次添加',
    cpsId: 'mock-cps-1',
    category: '辅食'
  },
  {
    id: '2',
    title: '纸尿裤试用装',
    subtitle: '多品牌组合',
    price: '9.9',
    image: 'https://via.placeholder.com/200x200?text=纸尿裤',
    scene: 'newborn',
    reason: '新生儿阶段高频刚需',
    cpsId: 'mock-cps-2',
    category: '纸尿裤'
  },
  {
    id: '3',
    title: '孕期复合维生素',
    subtitle: '含叶酸',
    price: '128',
    image: 'https://via.placeholder.com/200x200?text=维生素',
    scene: 'pregnancy',
    reason: '孕12周仍建议持续补充叶酸与维生素',
    cpsId: 'mock-cps-3',
    category: '孕期营养'
  },
  {
    id: '4',
    title: '婴儿背带',
    subtitle: '省力抱娃神器',
    price: '89',
    image: 'https://via.placeholder.com/200x200?text=背带',
    scene: 'newborn',
    reason: '新生儿需要经常抱抱，省腰神器',
    cpsId: 'mock-cps-4',
    category: '喂养用品'
  },
  {
    id: '5',
    title: '婴儿理发器',
    subtitle: '静音安全',
    price: '69',
    originalPrice: '99',
    image: 'https://via.placeholder.com/200x200?text=理发器',
    scene: '0-6m',
    reason: '宝宝胎毛需要定期修剪',
    cpsId: 'mock-cps-5',
    category: '护理用品'
  },
  {
    id: '6',
    title: '儿童餐椅',
    subtitle: '培养自主进食',
    price: '199',
    image: 'https://via.placeholder.com/200x200?text=餐椅',
    scene: '6-12m',
    reason: '6月龄后开始添加辅食，需要餐椅培养进食习惯',
    cpsId: 'mock-cps-6',
    category: '辅食用品'
  },
  {
    id: '7',
    title: '婴儿绘本',
    subtitle: '早教启蒙',
    price: '35',
    image: 'https://via.placeholder.com/200x200?text=绘本',
    scene: '6-12m',
    reason: '6月龄后可以开始亲子阅读',
    cpsId: 'mock-cps-7',
    category: '早教玩具'
  },
  {
    id: '8',
    title: '儿童安全座椅',
    subtitle: '出行必备',
    price: '399',
    originalPrice: '599',
    image: 'https://via.placeholder.com/200x200?text=安全座椅',
    scene: '0-6m',
    reason: '出院回家必备，保障宝宝出行安全',
    cpsId: 'mock-cps-8',
    category: '出行用品'
  }
];

/**
 * 按场景获取推荐列表
 * GET /api/recommend?scene=weaning
 */
router.get('/', (req, res) => {
  const { scene } = req.query;
  
  let list;
  if (scene) {
    list = PRODUCTS.filter(p => p.scene === scene);
    if (!list.length) {
      list = PRODUCTS.slice(0, 4);
    }
  } else {
    // 默认返回全部产品
    list = PRODUCTS;
  }
  
  res.json({
    code: 0,
    data: list
  });
});

/**
 * 获取首页/综合推荐
 * GET /api/recommend/home
 */
router.get('/home', (req, res) => {
  // 返回热门推荐
  const hotProducts = PRODUCTS.slice(0, 4);
  
  res.json({
    code: 0,
    data: hotProducts
  });
});

/**
 * 获取所有场景
 * GET /api/recommend/scenes
 */
router.get('/scenes', (req, res) => {
  const scenes = [
    { id: 'pregnancy', name: '孕期', description: '孕期营养与护理' },
    { id: 'newborn', name: '新生儿', description: '0-6月龄宝宝用品' },
    { id: 'weaning', name: '辅食期', description: '6月龄起辅食添加' },
    { id: '0-6m', name: '0-6月', description: '婴儿日常护理' },
    { id: '6-12m', name: '6-12月', description: '宝宝成长期' }
  ];
  
  res.json({
    code: 0,
    data: scenes
  });
});

/**
 * 产品详情
 * GET /api/recommend/:id
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const product = PRODUCTS.find(p => p.id === id);
  
  if (!product) {
    return res.json({
      code: 404,
      message: '产品不存在'
    });
  }
  
  res.json({
    code: 0,
    data: product
  });
});

module.exports = router;
