import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync } from 'node:sqlite';
import { applyMigrations } from '../../src/database/migrate';
import { seedIfEmpty } from '../../src/database/seed';
import { setDatabaseForTests } from '../../src/database/client';

type BindValue = string | number | null | Uint8Array;

export async function useMemoryLedger(): Promise<void> {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    async execAsync(source: string) {
      sqlite.exec(source);
    },
    async runAsync(source: string, ...params: BindValue[]) {
      sqlite.prepare(source).run(...params);
    },
    async getFirstAsync<T>(source: string, ...params: BindValue[]): Promise<T | null> {
      const row = sqlite.prepare(source).get(...params);
      return (row as T | undefined) ?? null;
    },
    async getAllAsync<T>(source: string, ...params: BindValue[]): Promise<T[]> {
      return sqlite.prepare(source).all(...params) as T[];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await applyMigrations(db);
  await seedIfEmpty(db as unknown as SQLiteDatabase);
  setDatabaseForTests(db as unknown as SQLiteDatabase);
}

export function closeMemoryLedger(): void {
  setDatabaseForTests(null);
}
