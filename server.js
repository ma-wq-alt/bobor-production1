import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_TOKEN;
const db = (TURSO_URL && TURSO_TOKEN) ? createClient({ url: TURSO_URL, authToken: TURSO_TOKEN }) : null;

const ADMIN_PASSWORD = 'тсб';
const NEWS_ID = 'news_channel';

async function initDB() {
  if (!db) return console.log('Нет базы, данные не сохранятся!');
  try {
    await db.batch([
      `CREATE TABLE IF NOT EXISTS cinema_videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, season INTEGER, episode INTEGER, url TEXT)`,
      `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT, from_name TEXT, text TEXT, date TEXT)`
    ]);
    console.log('✅ База готова (видео и чат)');
  } catch (e) { console.error(e.message); }
}

app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) res.json({ success: true });
  else res.status(401).json({ error: 'Неверный пароль' });
});

app.get('/api/videos', async (req, res) => {
  if (!db) return res.json([]);
  const r = await db.execute('SELECT * FROM cinema_videos ORDER BY season, episode');
  res.json(r.rows);
});

app.post('/api/videos', async (req, res) => {
  const { password, title, season, episode, url } = req.body;
  if (password !== ADMIN_PASSWORD || !db) return res.status(401).json({});
  await db.execute({ sql: 'INSERT INTO cinema_videos (title, season, episode, url) VALUES (?, ?, ?, ?)', args: [title, season, episode, url] });
  res.json({ success: true });
});

app.delete('/api/videos/:id', async (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD || !db) return res.status(401).json({});
  await db.execute({ sql: 'DELETE FROM cinema_videos WHERE id = ?', args: [req.params.id] });
  res.json({ success: true });
});

app.get('/api/messages/:chat_id', async (req, res) => {
  if (!db) return res.json([]);
  const r = await db.execute({ sql: 'SELECT * FROM messages WHERE chat_id = ? ORDER BY id', args: [req.params.chat_id] });
  res.json(r.rows);
});

app.post('/api/messages', async (req, res) => {
  const { chat_id, from_name, text } = req.body;
  if (!db) return res.status(500).json({});
  await db.execute({ sql: 'INSERT INTO messages (chat_id, from_name, text, date) VALUES (?, ?, ?, ?)', args: [chat_id, from_name, text, new Date().toLocaleString('ru-RU')] });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
initDB().then(() => app.listen(PORT, () => console.log(`🎬 BOBOR PRODUCTION на :${PORT}`)));
