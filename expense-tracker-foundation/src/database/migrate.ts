import { SCHEMA_SQL } from './schemaSql';

export const SCHEMA_VERSION = 1;

export interface MigrationDb {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

export async function applyMigrations(db: MigrationDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;
  await db.execAsync('PRAGMA foreign_keys = ON;');
  if (current < 1) {
    await db.execAsync(SCHEMA_SQL);
    await db.execAsync('PRAGMA user_version = 1;');
  }
}
