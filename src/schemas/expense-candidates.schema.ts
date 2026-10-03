import { z } from 'zod';
import { splitExpenseText } from '../utils/expense-text';
export const expenseCandidatesBody = z.object({
  text: z.string().trim().min(1).max(500).refine(text => {
    const fragments = splitExpenseText(text);
    return fragments.length >= 1 && fragments.length <= 4;
  }, '每次最多整理 4 笔，请用分号分开账目'),
  consent: z.literal(true),
}).strict();
