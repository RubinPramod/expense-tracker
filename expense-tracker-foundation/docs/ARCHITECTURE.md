# Architecture

## Principles
1. **Local-first:** app works without an account or backend. SQLite is the canonical ledger.
2. **Domain before UI:** transaction invariants live in `src/domain`, not React components.
3. **One ledger:** dashboard, reports and review counts are projections of canonical transactions.
4. **Explicit classification:** transaction flow/type, category, purpose, merchant and counterparty are distinct dimensions.
5. **Provenance:** imported records retain source metadata and source text. A source event can be associated with an existing transaction rather than forcing a second ledger entry.
6. **Human control:** AI and duplicate matching can suggest, but user confirmation controls destructive or ambiguous changes.
7. **Platform-aware intake:** statement file import is shared; message import has platform-specific capabilities.
8. **Provider-neutral AI:** the app talks to a local classifier interface and an explicit external-assistance interface. No provider-specific assumptions in domain models.

## Layering

- `app/`: route-level screens and navigation.
- `src/components/`: reusable presentation components.
- `src/domain/`: types, invariants and pure calculation functions.
- `src/database/`: SQLite opening, migrations and schema.
- `src/repositories/`: persistence access; only this layer issues SQL for domain records.
- `src/services/`: import orchestration, deduplication, exports, reminders and AI adapters.
- `src/theme/`: colours, spacing, typography and touch target tokens.

Dependency direction: routes/components -> services/repositories -> domain. Domain code must not import React Native or SQLite.

## Main transaction model

`flow` describes the direction (`expense`, `income`, `transfer`). `kind` refines the event (`purchase`, `card_repayment`, `refund`, `reimbursement`, `loan_given`, `loan_repayment`, `shared_expense`, etc.). `category_id` and `purpose` are separate. A transfer requires source and destination accounts. A card repayment is a transfer to a credit-card liability account, not a new expense.

## Deduplication and imports

Import stages: select source -> parse/map -> normalize -> validate -> compare candidates -> user review -> commit in a database transaction. Store import batch and source record metadata. Candidate matching should consider account, amount, date/time, normalized description and reference. A score is a review aid, never authorization to delete/merge.

## AI boundaries

- Local model adapter: routine classification and entity suggestions; model/runtime can be replaced without changing domain code.
- External AI: explicit user action only in initial release; show what fields will be exported and validate returned transaction IDs/schema/enums before applying.
- AI cannot directly write SQL, delete records, merge records, or silently overwrite user-confirmed values.
- Keep confidence and explanation as metadata; don't treat confidence as proof.

## Storage and privacy

Use Expo SQLite. Keep database schema versioned with migrations. Consider SQLCipher only after verifying the current Expo SDK/native build configuration and secure key storage on each platform. Database encryption is separate from app lock, OS device encryption, backup security and AI data sharing.

Backups should be versioned JSON with integrity validation. CSV/XLSX exports are reporting formats, not complete backups. Restores must preview and validate before replacing or merging live data.

## Navigation map

Bottom navigation: Overview, Transactions, central Add, Reports, Settings. Bills & Recurring is reached from Overview and Settings. Accounts & Cards, AI Review Queue, Import from Messages, Import Statement & Review, Backup & Restore, Rules and AI/Privacy settings are supporting routes, not all bottom tabs.
