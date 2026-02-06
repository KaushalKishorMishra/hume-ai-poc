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

export interface InterviewRecord {
  chatGroupId: string;
  transcript: unknown[];
  status: 'COMPLETED' | 'ERROR';
  disconnectReason: string | null;
  totalQuestions: number;
  durationMs: number;
  errorReason?: string;
}

export const saveInterview = async (record: InterviewRecord) => {
  const db = await getDb();
  
  // Check if we need to add new columns (migration)
  const tableInfo = await db.all("PRAGMA table_info(interviews)");
  const columns = tableInfo.map((col: { name: string }) => col.name);
  
  if (!columns.includes('status')) {
    await db.exec(`ALTER TABLE interviews ADD COLUMN status TEXT DEFAULT 'COMPLETED'`);
    await db.exec(`ALTER TABLE interviews ADD COLUMN disconnect_reason TEXT`);
    await db.exec(`ALTER TABLE interviews ADD COLUMN questions_answered INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE interviews ADD COLUMN total_questions INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE interviews ADD COLUMN duration_ms INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE interviews ADD COLUMN error_reason TEXT`);
  }
  
  await db.run(
    `INSERT INTO interviews 
     (chat_group_id, transcript, status, disconnect_reason, total_questions, duration_ms, error_reason) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    record.chatGroupId,
    JSON.stringify(record.transcript),
    record.status,
    record.disconnectReason,
    record.totalQuestions,
    record.durationMs,
    record.errorReason || null
  );
  
  const statusEmoji = record.status === 'COMPLETED' ? '✅' : '❌';
  console.log(
    `${statusEmoji} Saved interview: ${record.chatGroupId} | Status: ${record.status} | ` +
    `Duration: ${Math.round(record.durationMs / 1000)}s | ` +
    `Reason: ${record.disconnectReason || 'N/A'}`
  );
};

// Legacy support - simple save
export const saveInterviewSimple = async (chatGroupId: string, transcript: unknown) => {
  await saveInterview({
    chatGroupId,
    transcript: Array.isArray(transcript) ? transcript : [],
    status: 'COMPLETED',
    disconnectReason: 'completed',
    totalQuestions: 0,
    durationMs: 0,
  });
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
