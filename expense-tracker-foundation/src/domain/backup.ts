import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToUtf8, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { z } from 'zod';

export const BACKUP_VERSION = 1;
const KDF_ITERATIONS = 120_000;

const backupSchema = z.object({
  schemaVersion: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  accounts: z.array(z.record(z.unknown())),
  categories: z.array(z.record(z.unknown())),
  merchants: z.array(z.record(z.unknown())),
  merchantAliases: z.array(z.record(z.unknown())),
  counterparties: z.array(z.record(z.unknown())),
  transactions: z.array(z.record(z.unknown())),
  transactionSources: z.array(z.record(z.unknown())),
  rules: z.array(z.record(z.unknown())),
  recurring: z.array(z.record(z.unknown())),
  importBatches: z.array(z.record(z.unknown())),
  metadata: z.array(z.record(z.unknown())),
});

export type BackupDocument = z.infer<typeof backupSchema>;

export interface EncryptedBackup {
  format: 'expense-tracker-backup';
  version: 1;
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export function createBackupDocument(input: Omit<BackupDocument, 'schemaVersion'>): BackupDocument {
  return backupSchema.parse({ schemaVersion: BACKUP_VERSION, ...input });
}

export function encryptBackup(document: BackupDocument, passphrase: string): EncryptedBackup {
  if (passphrase.trim().length < 8) throw new Error('Use a passphrase of at least 8 characters.');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2(sha256, utf8ToBytes(passphrase), salt, { c: KDF_ITERATIONS, dkLen: 32 });
  const ciphertext = gcm(key, iv).encrypt(utf8ToBytes(JSON.stringify(document)));
  return {
    format: 'expense-tracker-backup',
    version: 1,
    kdf: 'pbkdf2-sha256',
    iterations: KDF_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

export function decryptBackup(payload: EncryptedBackup, passphrase: string): BackupDocument {
  if (payload.format !== 'expense-tracker-backup' || payload.version !== 1 || payload.kdf !== 'pbkdf2-sha256') {
    throw new Error('This file is not an expense tracker backup.');
  }
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = pbkdf2(sha256, utf8ToBytes(passphrase), salt, { c: payload.iterations, dkLen: 32 });
  let plain: Uint8Array;
  try {
    plain = gcm(key, iv).decrypt(base64ToBytes(payload.ciphertext));
  } catch {
    throw new Error('Could not decrypt the backup. Check the passphrase.');
  }
  return backupSchema.parse(JSON.parse(bytesToUtf8(plain)));
}

export function backupCounts(document: BackupDocument) {
  return {
    accounts: document.accounts.length,
    categories: document.categories.length,
    transactions: document.transactions.length,
    rules: document.rules.length,
    recurring: document.recurring.length,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
