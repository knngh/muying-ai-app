import { buildKnowledgeRecommendedQuestions } from '../src/services/knowledge-promotion.service';

describe('knowledge promotion recommendations', () => {
  it('filters promotion-safe candidates by target stage', () => {
    const report = {
      promotion: {
        safeQuestionCandidates: {
          candidates: [
            {
              id: 'qa-feeding',
              question: '6 个月宝宝添加辅食要注意什么？',
              category: 'parenting-0-1',
              topic: 'feeding',
              targetStage: ['6-12-months'],
              riskLevel: 'green',
              suggestedUse: 'general_education',
              authorityReference: {
                sourceOrg: 'NHS',
                title: 'Your baby first solid foods',
              },
            },
            {
              id: 'qa-pregnancy',
              question: '孕中期胎动怎么数？',
              category: 'pregnancy-mid',
              topic: 'pregnancy',
              targetStage: ['second-trimester'],
              riskLevel: 'green',
              suggestedUse: 'general_education',
              authorityReference: {
                sourceOrg: 'ACOG',
                title: 'Fetal movement guidance',
              },
            },
          ],
        },
      },
    };

    const result = buildKnowledgeRecommendedQuestions({
      report,
      stage: '6-12-months',
      limit: 4,
    });

    expect(result).toMatchObject({
      stage: '6-12-months',
      source: 'knowledge_ops_report',
      total: 1,
    });
    expect(result.questions).toEqual([
      expect.objectContaining({
        id: 'qa-feeding',
        question: '6 个月宝宝添加辅食要注意什么？',
        searchKeyword: '6 个月宝宝添加辅食要注意什么',
        sourceOrg: 'NHS',
      }),
    ]);
  });

  it('does not expose baby-feeding questions to pregnancy stages when raw stage arrays are broad', () => {
    const report = {
      promotion: {
        safeQuestionCandidates: {
          candidates: [
            {
              id: 'qa-broad-feeding',
              question: '6 个月宝宝添加辅食要注意什么？',
              category: 'parenting-0-1',
              topic: 'feeding',
              targetStage: ['first-trimester', '0-6-months', '6-12-months'],
              riskLevel: 'green',
              suggestedUse: 'general_education',
              authorityReference: {
                sourceOrg: 'NHS',
                title: 'Your baby first solid foods',
              },
            },
            {
              id: 'qa-early',
              question: '孕早期产检要注意什么？',
              category: 'pregnancy-early',
              topic: 'pregnancy',
              targetStage: ['first-trimester'],
              riskLevel: 'green',
              suggestedUse: 'general_education',
              authorityReference: {
                sourceOrg: '国家卫健委',
                title: '孕产期保健',
              },
            },
          ],
        },
      },
    };

    const result = buildKnowledgeRecommendedQuestions({
      report,
      stage: 'first-trimester',
      limit: 4,
    });

    expect(result.questions.map((item) => item.id)).toEqual(['qa-early']);
    expect(result.questions[0].targetStage).toEqual(['first-trimester']);
  });

  it('preserves care-boundary notes for yellow candidates', () => {
    const result = buildKnowledgeRecommendedQuestions({
      report: {
        promotion: {
          safeQuestionCandidates: {
            candidates: [
              {
                id: 'qa-fever',
                question: '宝宝发热什么时候需要就医？',
                category: 'common-symptoms',
                topic: 'common-symptoms',
                targetStage: ['0-6-months'],
                riskLevel: 'yellow',
                suggestedUse: 'care_boundary',
                authorityReference: {
                  sourceOrg: 'AAP',
                  title: 'Fever in children',
                },
              },
            ],
          },
        },
      },
      stage: '0-6-months',
    });

    expect(result.questions[0]).toMatchObject({
      riskLevel: 'yellow',
      suggestedUse: 'care_boundary',
      boundaryNote: '仅用于科普与就医准备，不作为诊断或治疗建议。',
    });
  });

  it('uses fallback questions when no ops report candidates are available', () => {
    const result = buildKnowledgeRecommendedQuestions({
      report: null,
      stage: 'third-trimester',
      limit: 2,
    });

    expect(result.source).toBe('fallback');
    expect(result.total).toBe(1);
    expect(result.questions[0]).toMatchObject({
      question: '孕晚期入院信号要注意什么？',
      targetStage: ['third-trimester'],
    });
  });

  it('bounds requested limits', () => {
    const result = buildKnowledgeRecommendedQuestions({
      report: null,
      limit: 99,
    });

    expect(result.total).toBeLessThanOrEqual(12);
    expect(result.questions.length).toBe(result.total);
  });
});
