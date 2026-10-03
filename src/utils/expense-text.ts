/** Conservative text boundaries: corrections and continuations stay with their source purchase. */
export function splitExpenseText(text: string): string[] {
  return text.split(/[；;。\n]+/u).flatMap(sentence => {
    const groups: string[] = [];
    for (const part of sentence.split(/[，,](?!\d{3}(?:\D|$))/u).map(x => x.trim()).filter(Boolean)) {
      const previous = groups[groups.length - 1];
      if (previous && (!extractExpenseAmounts(previous).length || /^(不是|而是|实付|实际|原价|改成|更正|不对|优惠|折后|预计|还|尚|未|没有|没|已|共|合计|总共|其中|退款|退了)/u.test(part))) groups[groups.length - 1] += '，' + part;
      else groups.push(part);
    }
    return groups;
  }).filter(Boolean);
}

export function extractExpenseAmounts(text: string): { text: string; cents: number }[] {
  // Mask dates/times, preserving positions. Quantities and unsupported formats are never rounded.
  const masked = text.replace(/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[:：]\d{2}|\d+(?:年|月|日|号)/gu, match => ' '.repeat(match.length));
  const amounts: { text: string; cents: number }[] = [];
  for (const match of masked.matchAll(/[-+]?\d+(?:[.,]\d+)*(?:e[-+]?\d+)?/giu)) {
    const value = match[0], start = match.index || 0;
    if (!/^\d+(?:\.\d{1,2})?$/u.test(value) || /[\w.+-]/u.test(masked[start - 1] || '')
      || /^\s*(?:[a-zA-Z\d.]|罐|包|盒|瓶|片|袋|个|次|段|克|斤|公斤|毫升|岁|周|天|折|%|％|万|千|百|角|分)/u.test(masked.slice(start + value.length))) continue;
    const [whole, fraction = ''] = value.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000 && !amounts.some(item => item.cents === cents)) amounts.push({ text: value, cents });
  }
  return amounts;
}
export const unfinishedExpense = /打算|计划|准备买|想买|预计|预算|没买|没有买|未买|未购买|没购|未付|没付|没有付|还没付|尚未付|待付|未到账|没到账|没有到账|申请退款|退款中|取消|不买/u;
