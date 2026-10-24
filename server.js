import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ПОДКЛЮЧЕНИЕ К БАЗЕ TURSO (берем из настроек Render)
const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_TOKEN;

let db = null;
if (TURSO_URL && TURSO_TOKEN) {
  db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
}

const ADMIN_PASSWORD = 'тсб';

// Создаем таблицу при запуске
async function initDB() {
  if (!db) {
    console.log('⚠️ Нет настроек Turso, видео будут храниться в памяти!');
    return;
  }
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS cinema_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        season INTEGER NOT NULL,
        episode INTEGER NOT NULL,
        url TEXT NOT NULL
      )
    `);
    console.log('✅ База данных готова');
  } catch (e) {
    console.error('Ошибка создания таблицы:', e.message);
  }
}

app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) res.json({ success: true });
  else res.status(401).json({ error: 'Неверный пароль' });
});

// Получить все видео
app.get('/api/videos', async (req, res) => {
  if (!db) return res.json([]); // Если базы нет, пусто
  try {
    const r = await db.execute('SELECT * FROM cinema_videos ORDER BY season ASC, episode ASC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Ошибка базы' }); }
});

// Добавить видео
app.post('/api/videos', async (req, res) => {
  const { password, title, season, episode, url } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Нет доступа' });
  if (!title || !url) return res.status(400).json({ error: 'Заполни данные' });
  
  if (!db) return res.status(500).json({ error: 'База данных не подключена' });
  try {
    await db.execute({
      sql: 'INSERT INTO cinema_videos (title, season, episode, url) VALUES (?, ?, ?, ?)',
      args: [title, Number(season) || 1, Number(episode) || 1, url]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Удалить видео
app.delete('/api/videos/:id', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Нет доступа' });
  
  if (!db) return res.status(500).json({ error: 'Нет базы' });
  try {
    await db.execute({ sql: 'DELETE FROM cinema_videos WHERE id = ?', args: [Number(req.params.id)] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => console.log(`🎬 КИНОТЕАТР на порту ${PORT}`));
});
