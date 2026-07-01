function controlMenuHtml(settings) {
  const randomWalkState = settings?.randomWalkEnabled ? "开" : "关";
  const quietModeState = settings?.quietMode ? "开" : "关";
  const randomWalkClass = settings?.randomWalkEnabled ? "enabled" : "";
  const quietModeClass = settings?.quietMode ? "enabled" : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; font-family: "Microsoft YaHei", "Segoe UI", sans-serif; color: #f8fafc; user-select: none; }
    .menu { margin: 6px; padding: 10px; border-radius: 14px; background: linear-gradient(180deg, rgba(31, 34, 46, 0.96), rgba(13, 16, 25, 0.94)); border: 1px solid rgba(255, 255, 255, 0.16); box-shadow: 0 16px 34px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08); backdrop-filter: blur(12px); }
    .menu-header { display: flex; align-items: center; justify-content: space-between; padding: 2px 2px 9px; }
    .title { font-size: 13px; font-weight: 700; letter-spacing: 0; }
    .subtitle { margin-top: 2px; color: rgba(226, 232, 240, 0.58); font-size: 10px; }
    .status-dot { width: 8px; height: 8px; border-radius: 999px; background: #f87171; box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.12); }
    .section-title { margin: 7px 2px 5px; color: rgba(226, 232, 240, 0.58); font-size: 10px; font-weight: 700; letter-spacing: 0; }
    .divider { height: 1px; margin: 8px 2px 7px; background: rgba(255, 255, 255, 0.12); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .stack { display: grid; gap: 6px; }
    button { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 29px; margin: 0; padding: 0 9px; border: 1px solid transparent; border-radius: 9px; background: rgba(255, 255, 255, 0.055); color: inherit; text-align: left; font-size: 12px; line-height: 1.2; cursor: pointer; outline: none; transition: background 120ms ease, border-color 120ms ease, transform 120ms ease; }
    button:hover { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.12); }
    button.clicked { background: rgba(255, 255, 255, 0.22); transform: translateY(1px); }
    button.enabled { background: rgba(34, 197, 94, 0.18); border-color: rgba(74, 222, 128, 0.3); color: #bbf7d0; }
    button.enabled:hover { background: rgba(34, 197, 94, 0.27); }
    .label { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .switch-pill { flex: 0 0 auto; margin-left: 8px; padding: 2px 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.09); color: rgba(226, 232, 240, 0.72); font-size: 10px; line-height: 1.2; }
    button.enabled .switch-pill { background: rgba(74, 222, 128, 0.18); color: #dcfce7; }
    button.danger { color: #fecaca; background: rgba(248, 113, 113, 0.08); }
    button.danger:hover { background: rgba(248, 113, 113, 0.18); border-color: rgba(248, 113, 113, 0.22); }
  </style>
</head>
<body>
  <div class="menu">
    <div class="menu-header"><div><div class="title">桌宠菜单</div><div class="subtitle">Asuka Pet Assistant</div></div><span class="status-dot"></span></div>
    <div class="section-title">动作</div>
    <div class="grid">
      <button data-action="wave"><span class="label">挥手</span></button>
      <button data-action="jump"><span class="label">跳一下</span></button>
      <button data-action="review"><span class="label">查看</span></button>
      <button data-action="failed"><span class="label">生气</span></button>
      <button data-action="walk-left"><span class="label">向左走</span></button>
      <button data-action="walk-right"><span class="label">向右走</span></button>
    </div>
    <div class="section-title">状态</div>
    <div class="stack">
      <button class="${randomWalkClass}" data-action="toggle-random-walk"><span class="label">随机走动</span><span class="switch-pill">${randomWalkState}</span></button>
      <button class="${quietModeClass}" data-action="quiet-mode"><span class="label">安静模式</span><span class="switch-pill">${quietModeState}</span></button>
    </div>
    <div class="section-title">工具</div>
    <div class="stack">
      <button data-action="open-reminder"><span class="label">提醒我</span></button>
      <button data-action="open-settings"><span class="label">设置</span></button>
      <button data-action="toggle-chat"><span class="label">对话</span></button>
      <button data-action="toggle-widget"><span class="label">小组件</span></button>
      <button data-action="hide-to-tray"><span class="label">隐藏到托盘</span></button>
    </div>
    <div class="divider"></div>
    <button class="danger" data-action="exit"><span class="label">退出</span></button>
  </div>
  <script>
    const { ipcRenderer } = require("electron");
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.getAttribute("data-action");
      if (!action) return;
      button.classList.add("clicked");
      setTimeout(() => { ipcRenderer.send("control-menu-action", action); }, 100);
    });
    document.addEventListener("contextmenu", (event) => event.preventDefault());
  </script>
</body>
</html>`;
}

module.exports = { controlMenuHtml };
