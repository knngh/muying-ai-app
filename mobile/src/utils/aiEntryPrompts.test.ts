import { buildHomeSuggestedQuestion } from './aiEntryPrompts'
import { getQuickQuestions, resolveCaregiverRoleView } from './chatPrompts'

describe('AI entry prompts', () => {
  it('rotates the home question by day while keeping the same day stable', () => {
    const first = buildHomeSuggestedQuestion('pregnant_mid', { date: '2026-05-20' })
    const second = buildHomeSuggestedQuestion('pregnant_mid', { date: '2026-05-20' })
    const nextDay = buildHomeSuggestedQuestion('pregnant_mid', { date: '2026-05-21' })

    expect(first).toBe(second)
    expect(first).not.toBe(nextDay)
  })

  it('uses father-view questions when the caregiver role is father', () => {
    expect(resolveCaregiverRoleView(2)).toBe('father')
    expect(resolveCaregiverRoleView('father')).toBe('father')

    expect(getQuickQuestions('pregnant_mid', 2)[0]).toBe('孕中期这周我能帮她分担哪三件事？')
    expect(buildHomeSuggestedQuestion('pregnant_mid', { date: '2026-05-20', caregiverRole: 2 }))
      .toBe('孕中期这周我能帮她分担哪三件事？')
  })
})
