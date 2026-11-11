import { reviewAuthorityTranslation } from '../src/services/authority-translation-review.service';

const source = { title: 'Newborn care', content: 'Do not stop prescribed medicine without discussing it with your doctor.' };
const translated = { title: '新生儿护理', summary: '遵医嘱用药。', content: '未与医生讨论前，不要停用处方药。' };
const route = { provider: 'freellm', model: 'auto', route: 'task' as const, label: 'review' };

it('uses a separate freellm review and accepts an explicit confident approval', async () => {
  const invokeModel = jest.fn().mockResolvedValue({ answer: '{"approved":true,"confidence":0.96,"issues":[]}', route });
  await expect(reviewAuthorityTranslation(source, translated, { invokeModel })).resolves.toMatchObject({ approved: true, version: 2, provider: 'freellm', reviewedChunks: 1, reviewedPasses: 2 });
  expect(invokeModel).toHaveBeenCalledWith('knowledge_review', expect.arrayContaining([expect.objectContaining({ role: 'user', content: JSON.stringify({ source, translated }) })]), expect.objectContaining({ primaryOnly: true, responseFormat: 'json_object' }));
});

it('does not publish after one approval when the next review finds a supported error', async () => {
  const issue = { sourceQuote: source.content, translationQuote: translated.content, problem: '用药警告存在实质含义错误' };
  const invokeModel = jest.fn()
    .mockResolvedValueOnce({ answer: '{"approved":true,"confidence":0.99,"issues":[]}', route })
    .mockResolvedValue({ answer: JSON.stringify({ approved: false, confidence: .96, issues: [issue] }), route });
  await expect(reviewAuthorityTranslation(source, translated, { invokeModel })).rejects.toThrow('用药警告');
});

it('does not treat an approval followed by provider failure as a completed review', async () => {
  const invokeModel = jest.fn()
    .mockResolvedValueOnce({ answer: '{"approved":true,"confidence":0.99,"issues":[]}', route })
    .mockRejectedValue(new Error('review route unavailable'));
  await expect(reviewAuthorityTranslation(source, translated, { invokeModel })).rejects.toThrow('unavailable');
});

it.each(['invalid', '{"approved":true}', '{"approved":true,"confidence":0.4,"issues":[]}', '{"approved":false,"confidence":0.95,"issues":["遗漏不要停药的警告"]}', '{"approved":true,"confidence":0.99,"issues":["警告反转"]}'])('rejects unverifiable or clinically incorrect translations: %s', async answer => {
  const invokeModel = jest.fn().mockResolvedValue({ answer, route });
  await expect(reviewAuthorityTranslation(source, translated, { invokeModel })).rejects.toThrow(/翻译审查/);
});

it('checks quoted evidence again before rejecting a translation', async () => {
  const issue = { sourceQuote: source.content, translationQuote: translated.content, problem: '否定警告遗漏' };
  const invokeModel = jest.fn().mockResolvedValue({ answer: JSON.stringify({ approved: false, confidence: .96, issues: [issue] }), route });
  await expect(reviewAuthorityTranslation(source, translated, { invokeModel })).rejects.toThrow('否定警告遗漏');
  expect(invokeModel).toHaveBeenCalledTimes(2);
  expect(invokeModel.mock.calls[1][1][2].content).toContain(source.content);
});

it('accepts an independent correction of an unsupported complaint', async () => {
  const invokeModel = jest.fn().mockResolvedValueOnce({ answer: JSON.stringify({ approved: false, confidence: .9, issues: [{ sourceQuote: 'Invented source text', translationQuote: '', problem: '推测原文有更多内容' }] }), route })
    .mockResolvedValue({ answer: '{"approved":true,"confidence":0.97,"issues":[]}', route });
  await expect(reviewAuthorityTranslation(source, translated, { invokeModel })).resolves.toMatchObject({ approved: true });
  expect(invokeModel.mock.calls[1][1][2].content).not.toContain('Invented source text');
});

it('rejects a known medical role substitution even when the model would approve it', async () => {
  const invokeModel = jest.fn().mockResolvedValue({ answer: '{"approved":true,"confidence":0.99,"issues":[]}', route });
  const source = { title: 'Baby movements', content: 'Call your midwife immediately.' };
  await expect(reviewAuthorityTranslation(source, { title: '胎动', summary: '及时就医。', content: '立即联系您的产科护士。' }, { invokeModel }))
    .rejects.toThrow(/独立翻译审查未通过.*midwife/);
  await expect(reviewAuthorityTranslation(source, { title: '胎动', summary: '及时就医。', content: '立即联系您的助产士。' }, { invokeModel }))
    .resolves.toMatchObject({ approved: true });
});
