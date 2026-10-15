# Architecture Decision Records

## ADR-001: React Native + TypeScript + Expo
**Decision:** Use React Native, TypeScript and Expo for shared Android/iOS UI. Use development builds for native capabilities not available in Expo Go.
**Reason:** Shared UI and a manageable mobile toolchain.
**Trade-off:** Native AI and platform-specific message capabilities need custom native integration and platform testing.

## ADR-002: SQLite as canonical local ledger
**Decision:** Use Expo SQLite with versioned migrations. No mandatory backend.
**Reason:** Persistent relational data, queries and offline operation.
**Trade-off:** Backups are user-controlled in v1; no automatic multi-device sync.

## ADR-003: Domain-separated transaction semantics
**Decision:** Separate flow, transaction kind, category, purpose, merchant, counterparty and accounts.
**Reason:** Prevent false spend totals and represent loans/reimbursements/transfers correctly.

## ADR-004: Human-confirmed AI and deduplication
**Decision:** AI suggestions are advisory; ambiguous duplicate candidates require user review. No silent merge/delete.
**Reason:** Financial data integrity and user trust.

## ADR-005: Manual external AI in v1
**Decision:** External AI is only invoked through an explicit export/import workflow. No background requests or embedded secret keys.
**Reason:** Privacy and predictable cost/control. Returned suggestions must be schema-validated.

## ADR-006: On-device model behind adapter
**Decision:** Prototype a Gemma 3 1B Instruct + LiteRT-LM route on the Galaxy S24 Ultra as a benchmark candidate, not a guaranteed production dependency. Keep an adapter boundary and benchmark memory, latency, thermal behaviour, battery and structured-output reliability. Validate iOS separately.
**Reason:** Keep routine classification private where feasible while avoiding tight coupling to a single runtime.

## ADR-007: Message import by platform
**Decision:** Paste/share/file workflows are the baseline. Android SMS capture is conditional on permissions, store policy and a compliant implementation. No assumption of unrestricted iOS SMS inbox access.
**Reason:** Platform restrictions and privacy.

## ADR-008: No Drive/Email integration in v1
**Decision:** Use local file picker/share workflows for statements; no dedicated Drive or Email integration.
**Reason:** Explicit user decision; lower permissions and integration complexity.

## ADR-009: UI icon system
**Decision:** Use Lucide React Native for general UI icons; approved merchant/institution logos and custom illustrations remain image assets. Do not use generated mockup logos as production logos.
**Reason:** Consistent vector icons and maintainable assets.
