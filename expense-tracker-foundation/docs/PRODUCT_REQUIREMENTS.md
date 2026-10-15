# Product Requirements Baseline

## Core screens
1. Welcome & Setup: Quick, Guided and Custom; Skip for now; no permissions on welcome.
2. Overview: month spending, six-month comparison, recent transactions, upcoming bills, review alert. Exclude internal transfers and card repayments from spend totals.
3. Transactions: search stays at the top; only key filter shortcuts are visible; remaining filters live in a bottom sheet. Date grouping and readable transaction rows.
4. Add/Edit Transaction: adaptive Expense, Income and Transfer modes; support refund, reimbursement, loan and shared expense without treating every person-to-person payment as consumption.
5. Import Statement & Review: CSV/XLSX first; PDF only when extraction is reliable; mapping, validation, duplicate review and confirmation as separate steps.
6. Reports & Insights: category, monthly trend, purpose, top merchants and six-month comparison; drill through to ledger rows.
7. Settings, Privacy & Data: accounts, import history, categories/rules, AI preferences, backup/restore and privacy.
8. Accounts & Cards: bank accounts, credit cards, cash/other accounts; source/destination selection and optional user-entered/reconciled balances.
9. AI Review Queue: uncategorised/low-confidence items, possible transfers and duplicate candidates; explicit confirm/edit/skip controls.
10. Import from Messages: paste/share/import; Android capture only if supported and policy-compliant; iOS uses supported share/paste/file workflows.
11. Bills & Recurring: reminders, recurring templates, suggested bills (confirmation required), upcoming and history.

## Confirmed extra-feature decisions
- Remove Drive import from v1.
- Remove Email import from v1.
- Keep Quick/Guided/Custom setup and Skip for now.
- Keep six-month spending comparison.
- Keep suggested recurring bills/subscriptions; suggestions require confirmation.
- Keep AI suggestion in Add Transaction, always editable.
- Keep dashboard review alert.
- Keep brief, contextual, dismissible first-run tips.

## Mobile requirements
- Important touch targets at least 44 x 44 points; allow adequate spacing.
- Search visible at top of Transactions; advanced filters in a bottom sheet.
- Body text generally 14–16 pt where practical; do not shrink essential metadata to fit.
- Vertical scroll and progressive disclosure; no horizontal scroll for essential transaction data.
- Respect safe areas, keyboard, dynamic type, contrast and screen-reader labels.
- Validate at 375 pt width and an iPhone 11-sized viewport, plus Android devices.

## Accounting invariants
- Internal transfers are not expenses.
- Card purchases are expenses; card repayments are not second expenses.
- A transfer to a person is not automatically a purchase/expense.
- Refunds should link to original purchase when known and affect net spending by explicit rules.
- AI never automatically merges/deletes transactions.
- User corrections take precedence over future AI suggestions unless user opts into a rule.
