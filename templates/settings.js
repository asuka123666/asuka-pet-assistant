function settingsHtml({ settings, defaultSettings, cachedEmotion, apiProviders }) {
  const API_PROVIDERS = apiProviders;
  const s = settings ?? defaultSettings;
  const scaleOptions = [
    { label: "45%", value: 0.45 },
    { label: "60%", value: 0.6 },
    { label: "75%", value: 0.75 },
    { label: "90%", value: 0.9 }
  ];
  const blinkOptions = [
    { label: "低", value: "low" },
    { label: "正常", value: "normal" },
    { label: "高", value: "high" }
  ];
  const jumpOptions = [
    { label: "低", value: "low" },
    { label: "正常", value: "normal" },
    { label: "高", value: "high" }
  ];
  const resourceBubbleSizeOptions = [
    { label: "小", value: "tiny" },
    { label: "正常", value: "small" },
    { label: "大", value: "normal" }
  ];
  const resourceBubbleOpacityOptions = [
    { label: "低", value: "low" },
    { label: "正常", value: "medium" },
    { label: "高", value: "high" }
  ];
  const resourceBubblePositionOptions = [
    { label: "右下", value: "bottom-right" },
    { label: "左下", value: "bottom-left" },
    { label: "右上", value: "top-right" },
    { label: "左上", value: "top-left" }
  ];

  function optionGroup(name, options, currentValue) {
    return options.map(o => {
      const active = o.value === currentValue ? " active" : "";
      return `<button class="opt${active}" data-key="${name}" data-value="${o.value}">${o.label}</button>`;
    }).join("");
  }

  function toggleRow(label, key, currentValue) {
    const cls = currentValue ? "active" : "";
    return `
      <div class="row">
        <span class="label">${label}</span>
        <button class="toggle ${cls}" data-key="${key}" data-value="${!currentValue}">${currentValue ? "开" : "关"}</button>
      </div>`;
  }

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
      overflow-y: auto;
      overflow-x: hidden;
      background: transparent;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      color: #f8fafc;
      user-select: none;
    }
    .panel {
      margin: 6px;
      padding: 12px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
    }
    .panel-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 12px;
      color: #f8fafc;
    }
    .section {
      margin-bottom: 12px;
    }
    .section:last-child {
      margin-bottom: 0;
    }
    .section-title {
      font-size: 11px;
      letter-spacing: 0.5px;
      color: rgba(255, 255, 255, 0.45);
      margin-bottom: 6px;
    }
    .btn-group {
      display: flex;
      gap: 4px;
    }
    .btn-group .opt {
      flex: 1;
      padding: 5px 0;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.12s;
    }
    .btn-group .opt:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .btn-group .opt.active {
      background: rgba(34, 197, 94, 0.22);
      border-color: rgba(34, 197, 94, 0.4);
      color: #bbf7d0;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .row:last-child {
      margin-bottom: 0;
    }
    .label {
      font-size: 13px;
    }
    .toggle {
      padding: 3px 14px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.12s;
    }
    .toggle:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .toggle.active {
      background: rgba(34, 197, 94, 0.22);
      border-color: rgba(34, 197, 94, 0.4);
      color: #bbf7d0;
    }
    .divider {
      height: 1px;
      margin: 10px 0;
      background: rgba(255, 255, 255, 0.1);
    }
    .action-btn {
      display: block;
      width: 100%;
      padding: 7px 0;
      margin-bottom: 6px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 7px;
      background: transparent;
      color: inherit;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.12s;
    }
    .action-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .action-btn:last-child {
      margin-bottom: 0;
    }
    .emotion-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .emotion-label {
      font-size: 12px;
      color: rgba(255,255,255,0.6);
      width: 32px;
      flex-shrink: 0;
    }
    .emotion-bar-bg {
      flex: 1;
      height: 6px;
      background: rgba(255,255,255,0.08);
      border-radius: 3px;
      overflow: hidden;
    }
    .emotion-bar {
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s ease, background 0.5s ease;
    }
    .emotion-value {
      font-size: 11px;
      color: rgba(255,255,255,0.45);
      width: 32px;
      text-align: right;
      flex-shrink: 0;
    }
    .api-field {
      margin-bottom: 8px;
    }
    .api-field .label {
      display: block;
      font-size: 12px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 4px;
    }
    .api-input {
      width: 100%;
      height: 28px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      padding: 0 8px;
      color: #f8fafc;
      font-size: 12px;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      outline: none;
    }
    .api-input::placeholder { color: rgba(255,255,255,0.2); }
    .api-input:focus { border-color: rgba(255,255,255,0.25); }
    .api-key-row {
      display: flex;
      gap: 4px;
    }
    .api-key-row .api-input { flex: 1; min-width: 0; }
    .small-btn {
      height: 28px;
      padding: 0 8px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font-size: 11px;
      cursor: pointer;
      flex-shrink: 0;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
    }
    .small-btn:hover { background: rgba(255,255,255,0.1); }
    .api-hint {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      margin-top: 3px;
    }
    .api-actions {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .api-actions .action-btn {
      flex: 1;
      margin-bottom: 0;
    }
    .api-result {
      font-size: 11px;
      margin-top: 6px;
      min-height: 16px;
      color: rgba(255,255,255,0.5);
    }
    .api-result.ok { color: #bbf7d0; }
    .api-result.err { color: #fecaca; }
  </style>
</head>
<body>
  <div class="panel">
    <div class="panel-title">设置</div>

    <div class="section">
      <div class="section-title">状态</div>
      <div class="emotion-row">
        <span class="emotion-label">心情</span>
        <div class="emotion-bar-bg">
          <div class="emotion-bar" id="moodBar" style="width: ${Math.round((cachedEmotion.mood + 100) / 2)}%; background: ${cachedEmotion.mood >= 20 ? '#4ade80' : cachedEmotion.mood <= -20 ? '#f87171' : '#94a3b8'}"></div>
        </div>
        <span class="emotion-value" id="moodValue">${cachedEmotion.mood >= 20 ? '开心' : cachedEmotion.mood <= -20 ? '烦躁' : '平静'}</span>
      </div>
      <div class="emotion-row">
        <span class="emotion-label">精力</span>
        <div class="emotion-bar-bg">
          <div class="emotion-bar" id="energyBar" style="width: ${cachedEmotion.energy}%; background: ${cachedEmotion.energy >= 60 ? '#60a5fa' : cachedEmotion.energy <= 30 ? '#fbbf24' : '#94a3b8'}"></div>
        </div>
        <span class="emotion-value" id="energyValue">${cachedEmotion.energy >= 60 ? '充沛' : cachedEmotion.energy <= 30 ? '疲惫' : '正常'}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">显示</div>
      <div class="row">
        <span class="label">桌宠大小</span>
        <div class="btn-group">
          ${optionGroup("petScale", scaleOptions, s.petScale)}
        </div>
      </div>
      ${toggleRow("台词气泡", "speechBubbleEnabled", s.speechBubbleEnabled)}
      ${toggleRow("对话入口", "chatEnabled", s.chatEnabled)}
      ${toggleRow("桌面小组件", "widgetEnabled", s.widgetEnabled)}
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">资源小球</div>
      ${toggleRow("显示小球", "resourceDockEnabled", s.resourceDockEnabled)}
      ${toggleRow("GPU 监控", "resourceGpuEnabled", s.resourceGpuEnabled)}
      ${toggleRow("显示百分比", "resourceBubbleShowPercent", s.resourceBubbleShowPercent)}
      ${toggleRow("高占用提醒", "resourcePressureSpeechEnabled", s.resourcePressureSpeechEnabled)}
      <div class="row">
        <span class="label">小球大小</span>
        <div class="btn-group">
          ${optionGroup("resourceBubbleSize", resourceBubbleSizeOptions, s.resourceBubbleSize)}
        </div>
      </div>
      <div class="row">
        <span class="label">液体透明度</span>
        <div class="btn-group">
          ${optionGroup("resourceBubbleOpacity", resourceBubbleOpacityOptions, s.resourceBubbleOpacity)}
        </div>
      </div>
      <div class="row">
        <span class="label">小球位置</span>
        <div class="btn-group">
          ${optionGroup("resourceBubblePosition", resourceBubblePositionOptions, s.resourceBubblePosition)}
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">动作</div>
      <div class="row">
        <span class="label">眨眼频率</span>
        <div class="btn-group">
          ${optionGroup("blinkMode", blinkOptions, s.blinkMode)}
        </div>
      </div>
      <div class="row">
        <span class="label">跳跃高度</span>
        <div class="btn-group">
          ${optionGroup("jumpHeightMode", jumpOptions, s.jumpHeightMode)}
        </div>
      </div>
      ${toggleRow("随机小动作", "randomIdleEnabled", s.randomIdleEnabled)}
      ${toggleRow("随机走动", "randomWalkEnabled", s.randomWalkEnabled)}
      ${toggleRow("安静模式", "quietMode", s.quietMode)}
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">API 设置</div>
      <div class="api-field">
        <span class="label">服务商</span>
        <div class="btn-group" id="providerGroup">
          ${Object.entries(API_PROVIDERS).map(([k, v]) => {
            const active = s.apiSettings.provider === k ? " active" : "";
            return `<button class="opt${active}" data-provider="${k}">${v.label}</button>`;
          }).join("")}
        </div>
      </div>
      <div class="api-field">
        <span class="label">Base URL</span>
        <input type="text" class="api-input" id="apiBaseUrl" value="${escapeHtml(s.apiSettings.baseUrl)}" placeholder="https://api.openai.com/v1" />
      </div>
      <div class="api-field">
        <span class="label">模型</span>
        <input type="text" class="api-input" id="apiModel" value="${escapeHtml(s.apiSettings.model)}" placeholder="gpt-4.1-mini" />
      </div>
      <div class="api-field">
        <span class="label">API Key</span>
        <div class="api-key-row">
          <input type="password" class="api-input" id="apiKeyInput" placeholder="sk-..." />
          <button class="small-btn" id="toggleKeyVis">显示</button>
          <button class="small-btn" id="clearKeyBtn">清空</button>
        </div>
        <div class="api-hint" id="keyHint">${s.apiSettings.apiKeyLast4 ? "已保存：****" + escapeHtml(s.apiSettings.apiKeyLast4) : "未保存"}</div>
      </div>
      <div class="api-actions">
        <button class="action-btn" id="testApiBtn">测试连接</button>
        <button class="action-btn" id="saveApiBtn">保存 API 设置</button>
      </div>
      <div class="api-result" id="apiResult"></div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <button class="action-btn" id="resetPos">重置位置</button>
      <button class="action-btn" id="closeSettings">关闭设置</button>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require("electron");

    const PROVIDERS = ${JSON.stringify(Object.fromEntries(Object.entries(API_PROVIDERS).map(([k, v]) => [k, { baseUrl: v.baseUrl, model: v.model }])))};

    document.getElementById("providerGroup").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-provider]");
      if (!btn) return;
      const provider = btn.getAttribute("data-provider");
      document.querySelectorAll("#providerGroup .opt").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const p = PROVIDERS[provider];
      if (p) {
        if (p.baseUrl) document.getElementById("apiBaseUrl").value = p.baseUrl;
        if (p.model) document.getElementById("apiModel").value = p.model;
      }
    });

    document.getElementById("toggleKeyVis").addEventListener("click", () => {
      const inp = document.getElementById("apiKeyInput");
      const btn = document.getElementById("toggleKeyVis");
      if (inp.type === "password") { inp.type = "text"; btn.textContent = "隐藏"; }
      else { inp.type = "password"; btn.textContent = "显示"; }
    });

    document.getElementById("clearKeyBtn").addEventListener("click", () => {
      document.getElementById("apiKeyInput").value = "";
      ipcRenderer.send("clear-api-key");
      document.getElementById("keyHint").textContent = "未保存";
      document.getElementById("apiResult").textContent = "";
    });

    document.getElementById("saveApiBtn").addEventListener("click", () => {
      const activeProvider = document.querySelector("#providerGroup .opt.active");
      const provider = activeProvider ? activeProvider.getAttribute("data-provider") : "openai";
      const baseUrl = document.getElementById("apiBaseUrl").value.trim();
      const model = document.getElementById("apiModel").value.trim();
      const apiKey = document.getElementById("apiKeyInput").value.trim();
      ipcRenderer.send("save-api-settings", { provider, baseUrl, model, apiKey });
      if (apiKey) {
        document.getElementById("keyHint").textContent = "已保存：****" + apiKey.slice(-4);
        document.getElementById("apiKeyInput").value = "";
      }
      document.getElementById("apiResult").textContent = "API 设置已保存";
      document.getElementById("apiResult").className = "api-result ok";
    });

    document.getElementById("testApiBtn").addEventListener("click", () => {
      document.getElementById("apiResult").textContent = "测试中...";
      document.getElementById("apiResult").className = "api-result";
      ipcRenderer.send("test-api-settings");
    });

    ipcRenderer.on("api-test-result", (_event, result) => {
      const el = document.getElementById("apiResult");
      el.textContent = result.msg;
      el.className = "api-result " + (result.ok ? "ok" : "err");
    });

    ipcRenderer.on("api-settings-saved", () => {});

    ipcRenderer.on("emotion-update", (_event, data) => {
      const moodBar = document.getElementById("moodBar");
      const energyBar = document.getElementById("energyBar");
      const moodValue = document.getElementById("moodValue");
      const energyValue = document.getElementById("energyValue");
      if (moodBar) {
        moodBar.style.width = Math.round((data.mood + 100) / 2) + "%";
        moodBar.style.background = data.mood >= 20 ? "#4ade80" : data.mood <= -20 ? "#f87171" : "#94a3b8";
      }
      if (energyBar) {
        energyBar.style.width = data.energy + "%";
        energyBar.style.background = data.energy >= 60 ? "#60a5fa" : data.energy <= 30 ? "#fbbf24" : "#94a3b8";
      }
      if (moodValue) moodValue.textContent = data.mood >= 20 ? "开心" : data.mood <= -20 ? "烦躁" : "平静";
      if (energyValue) energyValue.textContent = data.energy >= 60 ? "充沛" : data.energy <= 30 ? "疲惫" : "正常";
    });

    document.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn || btn.closest("#providerGroup") || btn.closest(".api-key-row") || btn.closest(".api-actions")) return;

      if (btn.id === "resetPos") {
        ipcRenderer.send("reset-position");
        return;
      }
      if (btn.id === "closeSettings") {
        ipcRenderer.send("close-settings");
        return;
      }

      const key = btn.getAttribute("data-key");
      const raw = btn.getAttribute("data-value");
      if (!key) return;

      let value;
      if (raw === "true") value = true;
      else if (raw === "false") value = false;
      else if (!isNaN(Number(raw))) value = Number(raw);
      else value = raw;

      ipcRenderer.send("settings-change", { key, value });

      if (btn.classList.contains("toggle")) {
        btn.classList.toggle("active");
        btn.textContent = btn.classList.contains("active") ? "开" : "关";
        btn.setAttribute("data-value", btn.classList.contains("active") ? "true" : "false");
      } else if (btn.classList.contains("opt")) {
        const group = btn.parentElement;
        group.querySelectorAll(".opt").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });

    document.addEventListener("contextmenu", (event) => event.preventDefault());
  </script>
</body>
</html>`;
}


function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


module.exports = { settingsHtml };
