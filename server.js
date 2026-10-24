function renderMessageText(text) {
  // Ищем ссылки, начинающиеся с http:// или https://
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  const container = document.createElement('span');
  
  for (const part of parts) {
    if (part.match(urlRegex)) {
      // Если это ссылка, делаем ее кликабельной
      const a = document.createElement('a');
      a.href = part;
      a.target = '_blank'; // Открывать в новой вкладке
      a.rel = 'noopener noreferrer';
      a.textContent = part;
      a.style.color = '#C6FF00'; // Цвет TTFBL для ссылок
      a.style.textDecoration = 'underline';
      a.style.wordBreak = 'break-all'; // Чтобы длинные ссылки переносились
      container.appendChild(a);
    } else {
      // Если это обычный текст, просто добавляем его
      container.appendChild(document.createTextNode(part));
    }
  }
  
  return container;
}
