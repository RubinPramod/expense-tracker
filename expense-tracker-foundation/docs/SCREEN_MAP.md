# Screen Map and Shared Components

| Route | Purpose | Key shared elements |
|---|---|---|
| `/(tabs)/index` | Overview | SummaryCard, ReviewAlert, UpcomingBillRow, RecentTransactionRow |
| `/(tabs)/transactions` | Ledger | Persistent SearchBar, QuickFilterChips, FilterBottomSheet, TransactionRow |
| `/(tabs)/add` | Add transaction | TransactionFlowSelector, AmountInput, AccountPicker, AI suggestion |
| `/(tabs)/reports` | Reports | PeriodSelector, TrendChart, CategoryBreakdown, MerchantRanking |
| `/(tabs)/settings` | Settings | SettingsSection, SettingsRow |
| `/accounts` | Accounts & Cards | AccountCard, AccountTypeTabs |
| `/review` | AI Review Queue | ReviewItem, DuplicateComparison, SuggestedClassification |
| `/import/statements` | Statement import | ImportStepper, ColumnMapper, ValidationSummary |
| `/import/messages` | Message import | PasteMessage, Share guidance, source preview |
| `/bills` | Bills & Recurring | UpcomingBillRow, RecurringScheduleRow |
| `/settings/data` | Backup/restore | BackupExport, RestorePreview, CSV/XLSX export |
| `/settings/ai-privacy` | AI & Privacy | Local model status, external export consent, provider settings |
| `/settings/rules` | Merchant aliases/rules | MerchantAliasEditor, CategorisationRuleEditor |

All amounts are formatted by a shared INR formatter; no screen hardcodes a total. Use sample/demo fixtures only in development and label them clearly.
