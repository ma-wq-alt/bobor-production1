import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// База в памяти (просто массив)
let videos = [];
let nextId = 1;
const ADMIN_PASSWORD = 'тсб'; // Пароль админа для входа

// Вход админа
app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Неверный пароль' });
  }
});

// Получить все видео
app.get('/api/videos', (req, res) => {
  res.json(videos);
});

// Добавить видео (только с паролем)
app.post('/api/videos', (req, res) => {
  const { password, title, season, episode, url } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Нет доступа' });
  }
  if (!title || !url) {
    return res.status(400).json({ error: 'Заполни название и ссылку' });
  }
  
  const video = {
    id: nextId++,
    title,
    season: Number(season) || 1,
    episode: Number(episode) || 1,
    url
  };
  videos.push(video);
  res.json({ success: true, video });
});

// Удалить видео (только с паролем)
app.delete('/api/videos/:id', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Нет доступа' });
  
  videos = videos.filter(v => v.id !== Number(req.params.id));
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎬 КИНОТЕАТР на порту ${PORT}`));
