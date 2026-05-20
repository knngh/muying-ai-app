import {
  buildKnowledgeHeaderCopy,
  buildKnowledgeShareMessage,
  getKnowledgeShareActionLabel,
} from './fatherView'

describe('fatherView', () => {
  it('uses father-oriented knowledge copy for father caregiver role', () => {
    expect(buildKnowledgeHeaderCopy(2, '孕中期', false)).toMatchObject({
      title: '按爸爸能执行的下一步看权威内容',
      searchPlaceholder: '搜索孕中期检查、报告、分工',
    })
    expect(getKnowledgeShareActionLabel(2)).toBe('发给我太太')
  })

  it('keeps default partner sharing copy for non-father roles', () => {
    expect(getKnowledgeShareActionLabel(1)).toBe('发给我老公')
    expect(buildKnowledgeShareMessage({
      caregiverRole: 1,
      title: '孕中期产检',
      summary: '糖耐和胎动需要关注。',
    })).toContain('方便分工时对齐重点')
  })
})
