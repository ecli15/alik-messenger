const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Хранилище сообщений в памяти сервера
const messageHistory = [];
const MAX_HISTORY = 50;

// Клиентский HTML + CSS + JS в одном ответе
const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Telegram Web Mini</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #0f1721; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; }
    #chat-wrapper { width: 100%; max-width: 480px; height: 100vh; background: #17212b; display: flex; flex-direction: column; }
    @media (min-width: 481px) { #chat-wrapper { height: 90vh; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.4); } }
    #header { background: #242f3d; padding: 14px 20px; font-weight: 600; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #101721; }
    #header .status { font-size: 0.8rem; color: #7f91a4; font-weight: normal; }
    #messages { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: #0e1621; }
    .msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; background: #182533; align-self: flex-start; word-wrap: break-word; position: relative; }
    .msg.my-msg { background: #2b5278; align-self: flex-end; border-bottom-right-radius: 4px; }
    .msg.system-msg { background: transparent; color: #6c7e93; align-self: center; font-size: 0.8rem; text-align: center; margin: 4px 0; }
    .msg .username { font-size: 0.75rem; color: #64b5f6; font-weight: 600; margin-bottom: 3px; }
    .msg .time { font-size: 0.65rem; color: #7f91a4; float: right; margin-left: 8px; margin-top: 4px; }
    #form { display: flex; padding: 10px; background: #17212b; gap: 8px; align-items: center; }
    #input { flex: 1; padding: 12px 16px; border: none; border-radius: 20px; background: #242f3d; color: #fff; font-size: 0.95rem; outline: none; }
    #input::placeholder { color: #7f91a4; }
    #send-btn { background: #5288c1; border: none; width: 40px; height: 40px; border-radius: 50%; color: #fff; font-weight: bold; cursor: pointer; display: flex; justify-content: center; align-items: center; }
  </style>
</head>
<body>
  <div id="chat-wrapper">
    <div id="header">
      <span>Общий чат</span>
      <span class="status" id="user-display"></span>
    </div>
    <div id="messages"></div>
    <form id="form">
      <input id="input" autocomplete="off" placeholder="Написать сообщение..." />
      <button id="send-btn" type="submit">➔</button>
    </form>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let username = '';

    while (!username || !username.trim()) {
      username = prompt('Введите ваше имя:');
    }
    username = username.trim();
    document.getElementById('user-display').textContent = username;
    socket.emit('join', username);

    const form = document.getElementById('form');
    const input = document.getElementById('input');
    const messages = document.getElementById('messages');

    function renderMessage(data) {
      const div = document.createElement('div');
      if (data.user === 'Система') {
        div.className = 'msg system-msg';
        div.textContent = data.text;
      } else {
        const isMe = data.user === username;
        div.className = \`msg \${isMe ? 'my-msg' : ''}\`;
        div.innerHTML = \`
          \${!isMe ? \`<div class="username">\${escapeHtml(data.user)}</div>\` : ''}
          <span>\${escapeHtml(data.text)}</span>
          <span class="time">\${data.time}</span>
        \`;
      }
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function escapeHtml(text) {
      return text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value.trim()) {
        socket.emit('chat message', input.value);
        input.value = '';
      }
    });

    socket.on('history', (history) => {
      messages.innerHTML = '';
      history.forEach(renderMessage);
    });

    socket.on('chat message', renderMessage);
  </script>
</body>
</html>
`;

// Главная страница отдаёт интерфейс
app.get('/', (req, res) => {
  res.send(htmlContent);
});

// Логика работы чата
io.on('connection', (socket) => {
  let currentUser = '';

  socket.on('join', (username) => {
    currentUser = username || 'Аноним';
    socket.username = currentUser;

    socket.emit('history', messageHistory);

    io.emit('chat message', {
      user: 'Система',
      text: `${currentUser} вошел в чат`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('chat message', (text) => {
    if (!text || !text.trim()) return;

    const msgData = {
      user: socket.username || 'Аноним',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    messageHistory.push(msgData);
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();

    io.emit('chat message', msgData);
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      io.emit('chat message', {
        user: 'Система',
        text: `${currentUser} покинул чат`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});