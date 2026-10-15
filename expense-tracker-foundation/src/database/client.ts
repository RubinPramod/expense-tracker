import * as SQLite from 'expo-sqlite';
import { applyMigrations, SCHEMA_VERSION } from './migrate';
import { seedIfEmpty } from './seed';

export const DATABASE_NAME = 'expense-tracker.db';
export { SCHEMA_VERSION };

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let databaseOverride: SQLite.SQLiteDatabase | null = null;

/** Jest supplies an in-memory database. The app always uses the on-device file. */
export function setDatabaseForTests(db: SQLite.SQLiteDatabase | null): void {
  databaseOverride = db;
  databasePromise = null;
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databaseOverride) return Promise.resolve(databaseOverride);
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await applyMigrations(db);
      await seedIfEmpty(db);
      return db;
    });
  }
  return databasePromise;
}

export async function assertDatabaseReady(): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  if (!row || row.user_version < SCHEMA_VERSION) {
    throw new Error(`Database migration required. Current=${row?.user_version ?? 0}, expected=${SCHEMA_VERSION}.`);
  }
}
