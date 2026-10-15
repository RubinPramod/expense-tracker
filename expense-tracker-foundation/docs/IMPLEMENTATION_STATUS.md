# Implementation Status

## Included in this foundation
- Architecture and product requirements docs
- Screen map and architecture decision records
- Transaction domain types and validation
- Gross-spending guard for transfers/card repayments/loans
- Duplicate-candidate heuristic that always requires human review
- SQLite schema with accounts, categories, merchants/aliases, counterparties, transactions, provenance, import batches, duplicate candidates, rules and recurring schedules
- SQLite connection starter, repository starter and theme/icon primitives
- Minimal Expo Router shell and placeholder tabs for Overview, Transactions, Add, Reports and Settings
- Initial ledger-rule tests

## Still required before calling this a runnable MVP
- Align dependency versions with the current Expo SDK and install packages
- Implement versioned migration runner and seed default categories
- Wire DB initialization into app startup and resolve schema bundling strategy
- Add update/delete/list/search repository methods and transaction detail/edit screens
- Build Filter bottom sheet and real transaction form
- Add accounts, import flows, AI review queue, recurring schedule UI, backup/restore and settings subroutes
- Configure a test runner compatible with the chosen Expo SDK and run tests
- Add iOS/Android build validation and device tests
- Add database encryption only after native build/key-storage design is verified
- Implement local AI adapter and benchmark Gemma 3 1B + LiteRT-LM on target hardware; validate iOS separately
- Validate Android SMS policy/permissions before implementing any automatic capture

Do not interpret this scaffold as compiled or device-tested.
