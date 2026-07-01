function reminderHtml() {
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
    .panel {
      margin: 6px;
      padding: 12px;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(31, 34, 46, 0.96), rgba(13, 16, 25, 0.94));
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
    }
    .title { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
    label { display: block; margin: 8px 0 5px; color: rgba(226, 232, 240, 0.72); font-size: 11px; font-weight: 700; }
    input {
      width: 100%;
      height: 30px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      padding: 0 9px;
      outline: none;
      font-size: 12px;
    }
    input:focus { border-color: rgba(248, 113, 113, 0.45); background: rgba(255, 255, 255, 0.11); }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
    button { height: 30px; border: 1px solid transparent; border-radius: 9px; color: #f8fafc; background: rgba(255, 255, 255, 0.08); cursor: pointer; font-size: 12px; }
    button:hover { background: rgba(255, 255, 255, 0.14); }
    .primary { background: rgba(248, 113, 113, 0.28); border-color: rgba(248, 113, 113, 0.3); }
    .primary:hover { background: rgba(248, 113, 113, 0.36); }
  </style>
</head>
<body>
  <div class="panel">
    <div class="title">提醒我</div>
    <label for="text">内容</label>
    <input id="text" maxlength="60" value="休息一下">
    <label for="minutes">多久以后</label>
    <input id="minutes" type="number" min="1" max="1440" value="30">
    <div class="row">
      <button id="cancel">取消</button>
      <button id="ok" class="primary">设置</button>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require("electron");
    const text = document.getElementById("text");
    const minutes = document.getElementById("minutes");
    document.getElementById("ok").addEventListener("click", () => {
      ipcRenderer.send("set-reminder", { text: text.value, minutes: minutes.value });
    });
    document.getElementById("cancel").addEventListener("click", () => ipcRenderer.send("close-reminder"));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter") ipcRenderer.send("set-reminder", { text: text.value, minutes: minutes.value });
      if (event.key === "Escape") ipcRenderer.send("close-reminder");
    });
    document.addEventListener("contextmenu", (event) => event.preventDefault());
    text.focus();
    text.select();
  </script>
</body>
</html>`;
}

module.exports = { reminderHtml };
