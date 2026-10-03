jest.mock('../src/services/typesafe.service', () => ({ askJevChoices: jest.fn() }));
import { askJevChoices } from '../src/services/typesafe.service';
import { extractExpenseAmounts, splitExpenseText, generateExpenseCandidates } from '../src/services/expense-candidates.service';
import { expenseCandidatesBody } from '../src/schemas/expense-candidates.schema';
const ask = askJevChoices as jest.Mock;
function answer(choice: string, confidence = .95) { return { choice, confidence }; }
function result(answers: Record<string, ReturnType<typeof answer>>) { return { model: 'jev-test', answers }; }
beforeEach(() => ask.mockReset());
it('keeps corrections and unfinished clauses with their original purchase', () => {
  expect(splitExpenseText('奶粉 268，尿布89，不是98；打算买奶瓶，预计50元，尚未付款')).toEqual(['奶粉 268', '尿布89，不是98', '打算买奶瓶，预计50元，尚未付款']);
});
it('extracts exact cents without treating dates, quantities, phone numbers or malformed numbers as money', () => {
  expect(extractExpenseAmounts('2026-09-23 买2罐奶粉268.09元，3段，900g，电话13800138000')).toEqual([{ text: '268.09', cents: 26809 }]);
  for (const text of ['价格1.234元', '-89元', '0元', '1,200元', '1e3元', '1000001元', '9月23日', '08:30', '两百元']) expect(extractExpenseAmounts(text)).toEqual([]);
});
it('maps only verbatim amount options and never invents a date', async () => {
  ask.mockResolvedValue(result({ direction_0: answer('expense'), category_0: answer('feeding'), amount_0: answer('value_0'), direction_1: answer('refund'), category_1: answer('supplies'), amount_1: answer('value_0') }));
  const response = await generateExpenseCandidates({ text: '奶粉268.09；尿布退款89元', consent: true });
  expect(response.source).toBe('ai');
  expect(response.candidates.map(x => [x.amountCents, x.direction, x.category, x.date])).toEqual([[26809, 'expense', 'feeding', null], [8900, 'refund', 'supplies', null]]);
  expect(response.candidates[0].fragment).toBe('奶粉268.09'); expect(ask).toHaveBeenCalledTimes(1);
});
it('keeps changed amounts in one fragment and selects only the actual payment', async () => {
  ask.mockResolvedValue(result({ direction_0: answer('expense'), category_0: answer('supplies'), amount_0: answer('value_1') }));
  const response = await generateExpenseCandidates({ text: '尿布原价98元，实际支付89元', consent: true });
  expect(response.candidates).toHaveLength(1); expect(response.candidates[0].amountCents).toBe(8900);
});
it('keeps diaper and wipe purchases out of feeding, while mixed-item fragments require manual category review', async () => {
  ask.mockResolvedValue(result({
    direction_0: answer('expense'), category_0: answer('feeding'), amount_0: answer('value_0'),
    direction_1: answer('expense'), category_1: answer('feeding'), amount_1: answer('value_0'),
  }));
  const response = await generateExpenseCandidates({ text: '尿布89元；尿布和奶粉100元', consent: true });
  expect(response.candidates.map(candidate => candidate.category)).toEqual(['supplies', null]);
});
it('keeps the only exact amount when Jev conservatively chooses none', async () => {
  ask.mockResolvedValue(result({ direction_0: answer('expense'), category_0: answer('feeding'), amount_0: answer('none') }));
  const response = await generateExpenseCandidates({ text: '奶粉268元', consent: true });
  expect(response.candidates[0]).toMatchObject({ amountCents: 26800, direction: 'expense', category: 'feeding' });
});
it('does not offer a completed entry for plans even when the model gets it wrong', async () => {
  ask.mockResolvedValue(result({ direction_0: answer('expense'), category_0: answer('feeding'), amount_0: answer('value_0') }));
  const response = await generateExpenseCandidates({ text: '打算买奶粉268元，还没付款', consent: true });
  expect(response.candidates[0]).toMatchObject({ amountCents: null, direction: null, status: 'not_recordable' });
});
it('clears uncertain and invalid model selections', async () => {
  ask.mockResolvedValue(result({ direction_0: answer('expense', .3), category_0: answer('made-up'), amount_0: answer('value_99') }));
  const response = await generateExpenseCandidates({ text: '奶粉268', consent: true });
  expect(response.candidates[0]).toMatchObject({ amountCents: null, category: null, direction: null });
});
it('returns manual candidates on provider failure without guessing type or amount', async () => {
  ask.mockRejectedValue(new Error('upstream private body'));
  const response = await generateExpenseCandidates({ text: '奶粉268', consent: true });
  expect(response.source).toBe('manual'); expect(response.candidates[0]).toMatchObject({ fragment: '奶粉268', amountCents: null, direction: null, category: null });
  expect(JSON.stringify(response)).not.toContain('private');
});
it('rejects excess fragments without silently dropping input or calling the model', () => {
  expect(expenseCandidatesBody.safeParse({ text: '奶粉1；尿布2；疫苗3；产检4；奶瓶5', consent: true }).success).toBe(false); expect(ask).not.toHaveBeenCalled();
});
it('does not call the provider for text with no supported money candidates', async () => {
  const response = await generateExpenseCandidates({ text: '今天没有买东西', consent: true });
  expect(response.source).toBe('manual'); expect(ask).not.toHaveBeenCalled();
});
