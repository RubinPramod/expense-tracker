# Expense Tracker — Foundation

A local-first React Native + TypeScript + Expo foundation for the personal expense tracker discussed in the product plan.

## Product constraints captured
- Local-first ledger; no mandatory backend and no hidden/background LLM calls.
- SQLite is the source of truth. UI summaries/reports are derived from ledger queries.
- Money movement type is separate from category and purpose.
- Credit-card purchases count as spending; card repayments and transfers between owned accounts do not count as spending a second time.
- AI outputs are suggestions. Never silently merge/delete transactions or overwrite confirmed user edits.
- Statement and message imports share validation, provenance and duplicate-review workflows.
- External AI is manual/explicit for the initial version. On-device AI is behind an adapter boundary and must be benchmarked on target devices.
- iOS message intake uses supported paste/share/file workflows. Android SMS capture is not enabled by default and requires platform/policy review.

## This is a foundation, not a finished app
The project includes domain types, ledger rules, SQLite schema/bootstrap, repository contracts, theme tokens, navigation placeholders, architecture decisions and tests. Native message capture, AI runtime integration, full import UI, encryption configuration, and device testing remain planned work.

## Start locally

1. Install a current Node.js LTS and a compatible Expo toolchain.
2. In a terminal, create/align an Expo project for the current SDK if package versions have moved since this scaffold was generated. Keep the source and architecture decisions in this repository.
3. Install the dependencies listed in `package.json` using the Expo-compatible versions recommended for your SDK:
   - `expo-sqlite`
   - `expo-router`
   - `lucide-react-native`
   - `react-native-svg`
4. Run `npx expo start` and open it on a device or simulator.
5. Run tests with `npm test` after setting up Jest/ts-jest or the chosen Expo-compatible test runner.

Version policy: use `npx expo install` for native Expo packages rather than blindly upgrading versions. Verify the current Expo SDK and platform compatibility before locking dependencies for the real repository.

## Suggested first implementation milestone
1. Bootstrap database and migrations.
2. Build transaction list and add/edit form against SQLite.
3. Add ledger invariants and tests before implementing import or AI.
4. Implement accounts and transfer/card repayment flows.
5. Add CSV import preview and duplicate review.

See `docs/ARCHITECTURE.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/SCREEN_MAP.md`, and `docs/DECISIONS.md`.
