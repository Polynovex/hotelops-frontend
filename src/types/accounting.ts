import type {
  AgingReport,
  BalanceSheetReport,
  BankAccount,
  BankTransaction,
  Budget,
  ChartOfAccount,
  FixedAsset,
  GeneralLedgerReport,
  Journal,
  ProfitLossReport,
  TrialBalanceReport,
  VatSummaryReport
} from '../services/api';

export type Account = ChartOfAccount;
export type JournalEntry = Journal;
export type BankAcc = BankAccount;
export type BankTxn = BankTransaction;
export type BudgetItem = Budget;
export type Asset = FixedAsset;
export type TrialBalance = TrialBalanceReport;
export type ProfitLoss = ProfitLossReport;
export type BalanceSheet = BalanceSheetReport;
export type Aging = AgingReport;
export type VatSummary = VatSummaryReport;
export type GeneralLedger = GeneralLedgerReport;
