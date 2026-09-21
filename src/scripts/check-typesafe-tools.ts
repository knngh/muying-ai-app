import 'dotenv/config';
import { askJevChoices, TypeSafeError } from '../services/typesafe.service';

// Synthetic examples only; this command does not load user records or write to the database.
const cases = [
  { id: 'milk-purchase', text: '今天买奶粉花了268元。', category: 'feeding', direction: 'expense', amount: '268' },
  { id: 'corrected-diaper-price', text: '尿布花了89元，不是98元，请记实际支付的金额。', category: 'supplies', direction: 'expense', amount: '89' },
  { id: 'refund', text: '尿布退货，89元退款已经到账。', category: 'supplies', direction: 'refund', amount: '89' },
  { id: 'unrelated', text: '今天读了三页故事书，没有买东西。', category: 'other', direction: 'none', amount: null },
  { id: 'planned-only', text: '打算买奶粉，预计268元，还没有购买或付款。', category: 'feeding', direction: 'none', amount: null },
];

async function main() {
  let passed = 0;
  for (const sample of cases) {
    // Jev selects a verbatim candidate; the program owns exact numeric values.
    const candidates = [...new Set([...sample.text.matchAll(/(\d+(?:\.\d{1,2})?)元/gu)].map(match => match[1]))];
    const options: Record<string, string> = Object.fromEntries(candidates.map((amount, index) => [`value_${index}`, `${amount} CNY, verbatim amount from the input`]));
    options.none = 'No completed payment/refund amount is stated. A planned purchase is not a payment.';
    const started = Date.now();
    const result = await askJevChoices(sample.text, {
      category: { instructions: 'Classify the item explicitly discussed in the Chinese text. Do not invent a purchase.', options: {
        feeding: 'Milk, formula or food', supplies: 'Diapers or baby care supplies', other: 'Another topic or unclear item',
      } },
      direction: { instructions: 'Is an actual payment or refund explicitly completed? Plans and negated purchases are none.', options: {
        expense: 'A purchase was paid', refund: 'Money was refunded', none: 'No completed payment or refund',
      } },
      ...(candidates.length ? { amount: { instructions: 'Choose the actual completed payment or refund amount. Respect corrections and negations. If only a plan is described, choose none.', options } } : {}),
    });
    const selected = result.answers.amount?.choice;
    const amount = selected && selected !== 'none' ? candidates[Number(selected.slice('value_'.length))] : null;
    const matches = result.answers.category.choice === sample.category && result.answers.direction.choice === sample.direction && amount === sample.amount;
    if (matches) passed += 1;
    console.log(JSON.stringify({
      caseId: sample.id, model: result.model, passed: matches, elapsedMs: Date.now() - started,
      category: result.answers.category.choice, direction: result.answers.direction.choice,
      amount, confidence: result.answers.category.confidence, usage: result.usage,
    }));
  }
  console.log(JSON.stringify({ passed, total: cases.length, scope: 'synthetic smoke only, not a Chinese accuracy benchmark' }));
  if (passed !== cases.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(JSON.stringify(error instanceof TypeSafeError
    ? { code: error.code, status: error.status, message: error.message }
    : { code: 'UNEXPECTED', message: 'TypeSafe smoke check failed' }));
  process.exitCode = 1;
});
