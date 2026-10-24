import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// База данных (берется из настроек Render)
const db = createClient({ 
  url: process.env.TURSO_URL, 
  authToken: process.env.TURSO_TOKEN 
});

// Создаем таблицу для видео, если её еще нет
async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      video_url TEXT NOT NULL,
      cover_url TEXT
    )
  `);
}
initDB();

// Проверка входа (сверяет с твоим банком)
app.post('/api/login', async (req, res) => {
  const { email, pwd, secret } = req.body;
  try {
    const result = await db.execute({
      sql: 'SELECT email, display_name, role, secret_word FROM users WHERE email = ? AND pwd = ?',
      args: [email.toLowerCase(), pwd]
    });
    
    if (result.rows.length === 0) return res.status(401).json({ error: 'Неверный email или пароль' });
    
    const user = result.rows[0];
    if (user.secret_word !== secret) return res.status(401).json({ error: 'Неверное секретное слово' });

    res.json({ ok: true, user: { email: user.email, name: user.display_name, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

// Получить список видео
app.get('/api/videos', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM videos ORDER BY id DESC');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка загрузки видео' });
  }
});

// Добавить видео (только для админа)
app.post('/api/videos', async (req, res) => {
  const { title, description, video_url, cover_url, adminEmail } = req.body;
  
  // Проверяем, что запрос делает админ
  const check = await db.execute({ sql: 'SELECT role FROM users WHERE email = ?', args: [adminEmail] });
  if (check.rows.length === 0 || check.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Только админ может добавлять видео' });
  }

  try {
    await db.execute({
      sql: 'INSERT INTO videos (title, description, video_url, cover_url) VALUES (?, ?, ?, ?)',
      args: [title, description, video_url, cover_url]
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// Раздаем HTML страницу (она ниже)
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BOBOR PRODUCTION на :${PORT}`));
