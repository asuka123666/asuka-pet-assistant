function chatBubbleHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      color: #f8fafc;
      user-select: none;
    }
    .chat {
      width: 100vw;
      height: 100vh;
      padding: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: rgba(30, 36, 48, 0.92);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 24px;
      flex-shrink: 0;
      margin-bottom: 6px;
    }
    .header-title {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
    }
    .close-btn {
      background: none;
      border: none;
      color: rgba(255,255,255,0.4);
      font-size: 14px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .close-btn:hover { color: #f8fafc; }
    .messages {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      font-size: 12px;
      line-height: 1.4;
      margin-bottom: 6px;
    }
    .messages::-webkit-scrollbar { width: 2px; }
    .messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
    .msg { margin-bottom: 2px; word-break: break-all; }
    .msg.user { color: rgba(255,255,255,0.8); }
    .msg.reply { color: #bbf7d0; }
    .input-row {
      height: 34px;
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .input-row input {
      flex: 1;
      min-width: 0;
      height: 34px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      padding: 0 8px;
      color: #f8fafc;
      font-size: 12px;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      outline: none;
    }
    .input-row input::placeholder { color: rgba(255,255,255,0.25); }
    .input-row input:focus { border-color: rgba(255,255,255,0.25); }
    .send-btn {
      flex: 0 0 48px;
      height: 34px;
      background: rgba(34, 197, 94, 0.22);
      border: 1px solid rgba(34, 197, 94, 0.35);
      border-radius: 6px;
      color: #bbf7d0;
      font-size: 12px;
      cursor: pointer;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
    }
    .send-btn:hover { background: rgba(34, 197, 94, 0.32); }
  </style>
</head>
<body>
  <div class="chat">
    <div class="header">
      <span class="header-title">对话</span>
      <button class="close-btn" id="closeChat">&times;</button>
    </div>
    <div class="messages" id="messages"></div>
    <div class="input-row">
      <input type="text" id="chatInput" placeholder="想说什么？" autocomplete="off" />
      <button class="send-btn" id="sendBtn">发送</button>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require("electron");
    const input = document.getElementById("chatInput");
    const msgs = document.getElementById("messages");
    const sendBtn = document.getElementById("sendBtn");
    const MAX_MSGS = 6;
    let sending = false;
    let thinkingEl = null;

    function trimMessages() {
      while (msgs.children.length > MAX_MSGS * 2) {
        msgs.removeChild(msgs.firstChild);
      }
    }

    function addMsg(cls, text) {
      const div = document.createElement("div");
      div.className = "msg " + cls;
      div.textContent = text;
      msgs.appendChild(div);
      trimMessages();
      msgs.scrollTop = msgs.scrollHeight;
      return div;
    }

    async function send() {
      const text = input.value.trim();
      if (!text || sending) return;
      sending = true;
      sendBtn.disabled = true;
      sendBtn.textContent = "...";
      input.value = "";

      addMsg("user", "我：" + text);
      thinkingEl = addMsg("reply", "她：思考中……");

      try {
        const result = await ipcRenderer.invoke("chat-send", text);
        if (thinkingEl) {
          if (result.ok) {
            thinkingEl.textContent = "她：" + result.reply;
          } else {
            thinkingEl.textContent = "她：" + (result.error || "出错了");
          }
          thinkingEl = null;
        }
      } catch {
        if (thinkingEl) {
          thinkingEl.textContent = "她：连接失败，稍后再试。";
          thinkingEl = null;
        }
      }

      sending = false;
      sendBtn.disabled = false;
      sendBtn.textContent = "发送";
      input.focus();
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });
    document.getElementById("closeChat").addEventListener("click", () => {
      ipcRenderer.send("close-chat-bubble");
    });

    input.focus();
  </script>
</body>
</html>`;
}


module.exports = { chatBubbleHtml };
