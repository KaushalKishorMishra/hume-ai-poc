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
    );
    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_group_id TEXT,
      transcript TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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

export const saveInterview = async (chatGroupId: string, transcript: any) => {
  const db = await getDb();
  await db.run(
    'INSERT INTO interviews (chat_group_id, transcript) VALUES (?, ?)',
    chatGroupId,
    JSON.stringify(transcript)
  );
  console.log(`💾 Saved interview for chat group: ${chatGroupId}`);
};

export const getInterviews = async () => {
  const db = await getDb();
  return await db.all('SELECT * FROM interviews ORDER BY created_at DESC');
};

export const resetDb = async () => {
  const db = await getDb();
  await db.exec('DELETE FROM configs');
  await db.exec('DELETE FROM interviews');
  console.log('🗑️ Database reset complete.');
};
