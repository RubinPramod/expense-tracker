import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing';

let pendingText: string | null = null;

export function stageSharedText(text: string): void {
  const trimmed = text.trim();
  if (trimmed) pendingText = trimmed;
}

export function takeSharedText(): string | null {
  const text = pendingText;
  pendingText = null;
  return text;
}

/** Reads text another app shared into this one. Expo Go has no share target, so a missing native method stays quiet. */
export function consumeIncomingShare(): string | null {
  try {
    const text = getSharedPayloads()
      .filter((payload) => payload.shareType === 'text' || (payload.mimeType ?? '').startsWith('text/'))
      .map((payload) => payload.value.trim())
      .filter(Boolean)
      .join('\n\n');
    if (!text) return null;
    try {
      clearSharedPayloads();
    } catch {
      // The payload was already read. Keeping it would import the same message again.
    }
    pendingText = text;
    return text;
  } catch {
    return null;
  }
}
