import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export const getDb = async () => {
  if (dbInstance) return dbInstance;

  const dbPath = path.join(__dirname, '../hume_configs.db');
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS configs (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  return dbInstance;
};

export const getConfigId = async (): Promise<string | null> => {
  const db = await getDb();
  const result = await db.get('SELECT value FROM configs WHERE key = ?', 'hume_config_id');
  return result?.value || null;
};

export const setConfigId = async (id: string) => {
  const db = await getDb();
  await db.run('INSERT OR REPLACE INTO configs (key, value) VALUES (?, ?)', 'hume_config_id', id);
};
