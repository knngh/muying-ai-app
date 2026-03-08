import type { RecommendProduct, RecommendScene } from './types'

const MOCK_PRODUCTS: RecommendProduct[] = [
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
  },
]

/** 按场景获取推荐列表（场景化触发） */
export function getRecommendByScene(scene: RecommendScene): Promise<RecommendProduct[]> {
  const list = MOCK_PRODUCTS.filter((p) => p.scene === scene)
  return Promise.resolve(list.length ? list : MOCK_PRODUCTS.slice(0, 2))
}

/** 获取首页/综合推荐 */
export function getRecommendList(): Promise<RecommendProduct[]> {
  return Promise.resolve(MOCK_PRODUCTS)
}
