import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import webpush from 'web-push'; // ВОТ ЭТОЙ СТРОЧКИ НЕ ХВАТАЛО!

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_TOKEN;
const db = (TURSO_URL && TURSO_TOKEN) ? createClient({ url: TURSO_URL, authToken: TURSO_TOKEN }) : null;

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:mar.maks999@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const ADMIN_PASSWORD = 'тсб';

async function initDB() {
  if (!db) return console.log('⚠️ НЕТ БАЗЫ!');
  try {
    await db.batch([
      `CREATE TABLE IF NOT EXISTS cinema_videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, season INTEGER, episode INTEGER, url TEXT)`,
      `CREATE TABLE IF NOT EXISTS watch_progress (user_email TEXT, video_id INTEGER, progress REAL, duration REAL, updated_at TEXT, PRIMARY KEY (user_email, video_id))`,
      `CREATE TABLE IF NOT EXISTS cinema_push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
    ]);
    console.log('✅ База и прогресс готовы');
  } catch (e) { console.error('Ошибка базы:', e.message); }
}

app.post('/api/push/subscribe', async (req, res) => {
  const { email, subscription } = req.body;
  if (!db) return res.status(500).json({ error: 'Нет базы' });
  if (!email || !subscription?.endpoint || !subscription?.keys) return res.status(400).json({ error: 'Invalid payload' });
  
  try {
    await db.execute({
      sql: `INSERT INTO cinema_push_subscriptions (email, endpoint, p256dh, auth)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET email = excluded.email, p256dh = excluded.p256dh, auth = excluded.auth`,
      args: [email, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

async function sendPushToAll(title, body) {
  if (!db) return;
  try {
    const subs = await db.execute('SELECT endpoint, p256dh, auth FROM cinema_push_subscriptions');
    const payload = JSON.stringify({ title, body });
    for (const sub of subs.rows) {
      const pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
      try {
        await webpush.sendNotification(pushSubscription, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.execute({ sql: 'DELETE FROM cinema_push_subscriptions WHERE endpoint = ?', args: [sub.endpoint] });
        }
      }
    }
  } catch (err) { console.error('Push error:', err); }
}

app.post('/api/login', async (req, res) => {
  const { email, password, secret } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, user: { name: 'Админ', email: 'admin@bobor.ru', role: 'admin' } });
  }

  if (!db) return res.status(500).json({ error: 'Нет подключения к базе' });
  
  try {
    const u = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    if (u.rows.length === 0) return res.status(401).json({ error: 'Аккаунт не найден' });
    if (u.rows[0].pwd !== password) return res.status(401).json({ error: 'Неверный пароль' });
    if (u.rows[0].secret_word && secret && u.rows[0].secret_word !== secret) {
        return res.status(401).json({ error: 'Неверное секретное слово' });
    }
    
    const name = u.rows[0].display_name || u.rows[0].name;
    let finalRole = u.rows[0].role || 'user';
    if (email === 'mar.maks999@gmail.com') finalRole = 'admin';

    return res.json({ success: true, user: { name: name, email: u.rows[0].email, role: finalRole } });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка базы: ' + e.message });
  }
});

app.get('/api/videos', async (req, res) => {
  if (!db) return res.json([]);
  try {
    const r = await db.execute('SELECT * FROM cinema_videos ORDER BY season, episode');
    res.json(r.rows);
  } catch(e) { res.json([]); }
});

app.post('/api/videos', async (req, res) => {
  const { password, title, season, episode, url } = req.body;
  if (password !== ADMIN_PASSWORD && password !== '1495') return res.status(401).json({ error: 'Нет доступа' });
  if (!db) return res.status(500).json({ error: 'Нет базы' });
  try {
    await db.execute({ sql: 'INSERT INTO cinema_videos (title, season, episode, url) VALUES (?, ?, ?, ?)', args: [title, season, episode, url] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/videos/:id', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD && password !== '1495') return res.status(401).json({ error: 'Нет доступа' });
  if (!db) return res.status(500).json({ error: 'Нет базы' });
  try {
    await db.execute({ sql: 'DELETE FROM cinema_videos WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/progress/:email', async (req, res) => {
  if (!db) return res.json([]);
  try {
    const r = await db.execute({ sql: 'SELECT * FROM watch_progress WHERE user_email = ?', args: [req.params.email] });
    res.json(r.rows);
  } catch(e) { res.json([]); }
});

app.post('/api/progress', async (req, res) => {
  const { email, video_id, progress, duration } = req.body;
  if (!db || !email || email === 'guest') return res.json({ success: false });
  try {
    await db.execute({
      sql: `INSERT INTO watch_progress (user_email, video_id, progress, duration, updated_at) 
            VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(user_email, video_id) DO UPDATE SET progress = ?, duration = ?, updated_at = ?`,
      args: [email, video_id, progress, duration, new Date().toISOString(), progress, duration, new Date().toISOString()]
    });
    res.json({ success: true });
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/push/send', async (req, res) => {
  const { password, title, body } = req.body;
  if (password !== ADMIN_PASSWORD && password !== '1495') return res.status(401).json({ error: 'Нет доступа' });
  await sendPushToAll(title, body);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
initDB().then(() => app.listen(PORT, () => console.log(`🎬 BOBOR PRODUCTION на :${PORT}`)));
