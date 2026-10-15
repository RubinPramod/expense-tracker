import { dateKey } from './dates';

export interface DuplicateCandidateInput {
  accountId: string | null;
  amountMinor: number;
  occurredAt: string;
  flow: string;
  descriptionNormalized: string;
  reference: string | null;
}

export interface DuplicateCandidateResult {
  score: number;
  reasons: string[];
  requiresHumanReview: true;
}

/** Heuristic for surfacing candidates only. It never authorizes automatic merging/deletion. */
export function scoreDuplicateCandidate(a: DuplicateCandidateInput, b: DuplicateCandidateInput): DuplicateCandidateResult {
  let score = 0;
  const reasons: string[] = [];
  if (a.amountMinor === b.amountMinor) { score += 0.30; reasons.push('Same amount'); }
  if (a.accountId && b.accountId && a.accountId === b.accountId) { score += 0.20; reasons.push('Same account'); }
  if (a.reference && b.reference && a.reference === b.reference) { score += 0.35; reasons.push('Same reference'); }
  if (a.descriptionNormalized && a.descriptionNormalized === b.descriptionNormalized) { score += 0.10; reasons.push('Same normalized description'); }
  const ta = Date.parse(a.occurredAt), tb = Date.parse(b.occurredAt);
  if (Number.isFinite(ta) && Number.isFinite(tb) && Math.abs(ta - tb) <= 48 * 60 * 60 * 1000) { score += 0.05; reasons.push('Within 48 hours'); }
  return { score: Math.min(score, 1), reasons, requiresHumanReview: true };
}

/** Stable reference, or account + date + amount + direction + normalized description. Amount and date alone never match. */
export function isExactDuplicate(a: DuplicateCandidateInput, b: DuplicateCandidateInput): boolean {
  const sameAccount = a.accountId != null && a.accountId === b.accountId;
  if (sameAccount && a.reference && b.reference && a.reference === b.reference) return true;
  return sameAccount
    && a.amountMinor === b.amountMinor
    && a.flow === b.flow
    && dateKey(a.occurredAt) === dateKey(b.occurredAt)
    && a.descriptionNormalized.length > 0
    && a.descriptionNormalized === b.descriptionNormalized;
}
