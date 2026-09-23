export interface ExpenseCandidatesRequest { text: string; consent: true }
export interface ExpenseCandidate {
  id: string;
  fragment: string;
  amountCents: number | null;
  direction: 'expense' | 'refund' | 'transfer' | null;
  category: 'checkup' | 'supplies' | 'feeding' | 'vaccine' | 'other' | null;
  date: null;
  status: 'review' | 'not_recordable';
  warnings: string[];
}
export interface ExpenseCandidatesResponse {
  source: 'ai' | 'manual';
  model?: string;
  candidates: ExpenseCandidate[];
}
