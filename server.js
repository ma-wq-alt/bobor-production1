import express from 'express';
import path from 'path';
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Берем токены из настроек Render
const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_TOKEN;
if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('Нет TURSO_URL или TURSO_TOKEN в переменных окружения');
  process.exit(1);
}
const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_PASSWORD = 'тсб';

// Создаем таблицу при запуске сервера
async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cinema (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      season INTEGER NOT NULL,
      episode INTEGER NOT NULL,
      url TEXT NOT NULL
    )
  `);
}
initDB().catch(console.error);

// Вход админа
app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Неверный пароль' });
  }
});

// Получить все видео
app.get('/api/videos', async (req, res) => {
  try {
    const r = await db.execute('SELECT * FROM cinema ORDER BY season ASC, episode ASC');
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Добавить видео
app.post('/api/videos', async (req, res) => {
  const { password, title, season, episode, url } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Нет доступа' });
  }
  if (!title || !url) {
    return res.status(400).json({ error: 'Заполни название и ссылку' });
  }
  
  try {
    await db.execute({
      sql: 'INSERT INTO cinema (title, season, episode, url) VALUES (?, ?, ?, ?)',
      args: [title, Number(season) || 1, Number(episode) || 1, url]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Удалить видео
app.delete('/api/videos/:id', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Нет доступа' });
  
  try {
    await db.execute({
      sql: 'DELETE FROM cinema WHERE id = ?',
      args: [Number(req.params.id)]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎬 BOBOR PRODUCTION на порту ${PORT}`));
