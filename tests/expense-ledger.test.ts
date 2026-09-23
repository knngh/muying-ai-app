import { expenseApiInput, expenseFromRemote, formatExpenseCents, parseExpenseCents, summarizeExpenseMonth } from '../mini-program/src/utils/expense-ledger';
import { historyDetails, historyTitle } from '../mini-program/src/utils/tool-history';
import { reviewInputs } from '../mini-program/src/utils/tool-review';
import type { LocalToolRecord } from '../mini-program/src/utils/tool-records';

function entry(id: string, payload: LocalToolRecord['payload']): LocalToolRecord {
  return { id, toolId: 'expenses', recordType: 'entry', payload, createdAt: '2026-09-23T10:00:00Z', updatedAt: '2026-09-23T10:00:00Z', syncStatus: 'local' };
}
it('parses decimal yuan to integer cents without rounding extra digits or accepting implicit formats', () => {
  expect(['0.01', '0.1', '0.2', '1.01', ' 0012.30 ', '.50', '1000000'].map(parseExpenseCents)).toEqual([1, 10, 20, 101, 1230, 50, 100000000]);
  for (const value of ['', ' ', '0', '-2', '1.005', '1e3', '0x10', '1,000', 'Infinity', '1000000.01', null, true, NaN]) expect(parseExpenseCents(value)).toBeNull();
  expect(formatExpenseCents(100000001)).toBe('1,000,000.01');
  expect(formatExpenseCents(-101)).toBe('-1.01');
});
it('separates expenses, refunds and transfers and bases category percentages on expenses only', () => {
  const result = summarizeExpenseMonth([
    entry('small1', { date: '2026-09-01', amount: 0.1, category: 'feeding' }),
    entry('small2', { date: '2026-09-30', amount: 0.2, category: 'feeding', direction: 'expense' }),
    entry('checkup', { date: '2026-09-12', amount: 0.7, category: 'checkup' }),
    entry('refund', { date: '2026-09-13', amount: 2, category: 'feeding', direction: 'refund' }),
    entry('transfer', { date: '2026-09-14', amount: 100, category: 'feeding', direction: 'transfer' }),
    entry('last-month', { date: '2026-08-31', amount: 99, category: 'feeding' }),
  ], '2026-09');
  expect(result).toMatchObject({ expenseCents: 100, refundCents: 200, transferCents: 10000, netCents: -100 });
  expect(result.entries.map(item => item.record.id)).toEqual(['small2', 'transfer', 'refund', 'checkup', 'small1']);
  expect(result.categories.map(item => [item.id, item.cents, item.percent])).toEqual([['checkup', 70, 70], ['feeding', 30, 30]]);
});
it('keeps refund-only months visible without implying any spending or counting a transfer as income', () => {
  const result = summarizeExpenseMonth([
    entry('refund', { date: '2026-09-01', amount: 120, category: 'feeding', direction: 'refund' }),
    entry('transfer', { date: '2026-09-02', amount: 1000, category: 'other', direction: 'transfer' }),
  ], '2026-09');
  expect(result).toMatchObject({ expenseCents: 0, refundCents: 12000, transferCents: 100000, netCents: -12000, categories: [] });
  expect(result.entries).toHaveLength(2);
});
it('rejects impossible dates and invalid values, keeps unknown categories separate, and exposes excluded sources', () => {
  const unknown = entry('unknown-category', { date: '2026-09-01', amount: 10, category: '老分类' });
  const invalid = [
    entry('bad-date', { date: '2026-02-30', amount: 10, category: 'feeding' }),
    entry('missing-date', { amount: 10 }),
    entry('bad-amount', { date: '2026-09-01', amount: 1.005 }),
    entry('bad-direction', { date: '2026-09-01', amount: 10, direction: 'income' }),
    { ...entry('old-cloud', { date: '2026-09-01', amount: 20 }), syncStatus: 'synced' as const },
  ];
  const result = summarizeExpenseMonth([unknown, ...invalid, { ...unknown, toolId: 'weight' as const }], '2026-09');
  expect(result.expenseCents).toBe(1000);
  expect(result.categories[0]).toMatchObject({ id: 'other', label: '其他/未分类', cents: 1000 });
  expect(result.excludedRecords.map(item => item.id)).toEqual(invalid.map(item => item.id));
  expect(summarizeExpenseMonth([unknown], '2026-13').entries).toEqual([]);
  expect(summarizeExpenseMonth([entry('leap', { date: '2024-02-29', amount: 1 })], '2024-02').entries).toHaveLength(1);
});
it('updates a month after source edits or deletion and never mutates the source order', () => {
  const record = entry('source', { date: '2026-09-01', amount: 10, category: 'feeding' });
  expect(summarizeExpenseMonth([record], '2026-09').expenseCents).toBe(1000);
  record.payload.amount = 12;
  expect(summarizeExpenseMonth([record], '2026-09').expenseCents).toBe(1200);
  record.payload.date = '2026-08-31';
  expect(summarizeExpenseMonth([record], '2026-09').entries).toEqual([]);
  expect(summarizeExpenseMonth([], '2026-08').expenseCents).toBe(0);
  const records = [record, entry('newer', { date: '2026-08-31', amount: 20 })];
  summarizeExpenseMonth(records, '2026-08');
  expect(records.map(item => item.id)).toEqual(['source', 'newer']);
});
it('retains refund/transfer directions through API conversion and history for review', () => {
  for (const direction of ['refund', 'transfer'] as const) {
    const remote = { id: '1', occurredAt: '2026-09-01', amountCents: 101, direction, category: 'feeding', note: '合成核对', createdAt: '2026-09-01', updatedAt: '2026-09-01' };
    const record = entry('local-1', expenseFromRemote(remote));
    expect(expenseApiInput(record)).toEqual({ occurredAt: '2026-09-01', amountCents: 101, direction, category: 'feeding', note: '合成核对', clientOperationId: 'local-1' });
    const title = direction === 'refund' ? '退款' : '转账';
    expect(historyTitle(record)).toContain(title);
    expect(historyDetails(record)).toContainEqual({ label: '类型', value: title });
    expect(historyDetails(record)).toContainEqual({ label: '分类', value: '奶粉/喂养' });
    expect(reviewInputs([record])[0].content).toContain('类型：' + title);
  }
  expect(expenseApiInput(entry('invalid', { date: '2026-09-01', amount: 1.005, category: 'feeding' }))).toBeNull();
});
