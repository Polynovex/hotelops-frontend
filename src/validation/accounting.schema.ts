import { z } from 'zod';

export const chartOfAccountSchema = z.object({
  accountCode: z.string().min(3),
  accountName: z.string().min(2),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  openingBalance: z.coerce.number().min(0)
});

export const journalEntrySchema = z.object({
  description: z.string().min(2),
  reference: z.string().optional(),
  amount: z.coerce.number().positive(),
  debitAccount: z.string().min(1),
  creditAccount: z.string().min(1)
});

export type ChartOfAccountSchema = z.infer<typeof chartOfAccountSchema>;
export type JournalEntrySchema = z.infer<typeof journalEntrySchema>;
