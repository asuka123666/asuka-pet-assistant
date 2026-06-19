const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, safeStorage, globalShortcut } = require("electron");
const fs = require("fs");
const path = require("path");

const PET_SCALE = 0.6;
const BASE_WIDTH = 192;
const BASE_HEIGHT = 208;
const JUMP_HEIGHT = 48;
const JUMP_DURATION = 520;
const JUMP_HEIGHT_MAP = { low: 32, normal: 48, high: 64 };
const DRAG_LIFT_Y = 10;
const RELEASE_BOUNCE_HEIGHT = 12;
const RELEASE_BOUNCE_DURATION_MS = 320;
const EDGE_MARGIN = 20;
const WALK_DURATION = 1200;
const STATUS_BUBBLE_DURATION_MS = 1000;
const SPEECH_BUBBLE_DURATION_MS = 1800;
const DEBUG_CHAT_WINDOW = false;
const FALLBACK_TRAY_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABZElEQVR4nOWXsWvCQBTGv3tJSi/SToJDFmkK7g5OgmJ2nfwHHfXPEMHFzUGh4tDZoR0aaAtXUmxo05zeJXc10G+7cO++H+8lefeA/y5WJEgI8SA9kLF7KwDihGkZGFbEfNdqhbK94Xa704FgqsanTFVgZCBkyzwbJysh2TJXhSDVYFMQZwHEkVIWdDse4269hlOvF4LIZoF0zBP5gwGeJhP4vZ4WgAyCdA5gnIM4x/Nshlq/DxMinc1+t4uX+Rxv+z3cIADzPHMAQiH9tSjCzXCIYDqF22jgutMpXQZXOdJx4DWbeByN0mwkZYgXC/xJCXi7jdfNJl3Hq9UnRFmR6kY/ihAvl+laxDHeDwdcheV+FUznHTClrx6R9Aetr8CGqDIA7Ngus/3cZvp/AFxKVCkAZrkM2fT/ArAJkWeeC5AXZMo8T5T38DtlWYhzF1OSBZqAULkVs0rPBZWZjJCRydnw4voA2xKvHGRMmB8AAAAASUVORK5CYII=";

let mainWindow;
let menuWindow;
let statusWindow;
let settingsWindow = null;
let speechBubbleWindow = null;
let speechBubbleTimer = null;
let chatBubbleWindow = null;
let chatBubbleOpen = false;
let cachedEmotion = { mood: 0, energy: 50 };
let widgetWindow = null;
let widgetTimer = null;

const API_PROVIDERS = {
  openai:      { label: "OpenAI",      baseUrl: "https://api.openai.com/v1",       model: "gpt-4.1-mini" },
  deepseek:    { label: "DeepSeek",    baseUrl: "https://api.deepseek.com",         model: "deepseek-chat" },
  kimi:        { label: "Kimi",        baseUrl: "https://api.moonshot.cn/v1",       model: "moonshot-v1-8k" },
  siliconflow: { label: "SiliconFlow", baseUrl: "https://api.siliconflow.cn/v1",    model: "" },
  custom:      { label: "自定义",      baseUrl: "",                                  model: "" }
};

const ASUKA_SYSTEM_PROMPT = `你是一个桌面宠物 AI 助手，性格参考"明日香式"的傲气、自信、嘴硬、轻微不耐烦。但不要辱骂用户，不要过度攻击，不要长篇大论。你使用中文回答。回答要短，通常 1-3 句话。你可以有一点傲娇和吐槽，但仍然要真正帮用户解决问题。不要自称 ChatGPT，不要说自己是 AI 模型。`;

const API_TIMEOUT_MS = 20000;
const API_MAX_TOKENS = 300;
const REPLY_MAX_CHARS = 240;
const WEATHER_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const WEATHER_API_TIMEOUT_MS = 8000;
const LATE_NIGHT_START = 0;
const LATE_NIGHT_END = 6;
let tray = null;
let statusTimer = null;
let dragState = null;
let motionFrame = null;
let settings = null;

function createWindow() {
  settings = loadSettings();
  applyStartupSetting();
  const width = Math.round(BASE_WIDTH * settings.petScale);
  const height = Math.round(BASE_HEIGHT * settings.petScale);
  const position = settings.windowPosition
    ? clampPositionToScreen(settings.windowPosition.x, settings.windowPosition.y, width, height)
    : null;

  const windowOptions = {
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };

  if (position) {
    windowOptions.x = position.x;
    windowOptions.y = position.y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  createTray();
  startTimeAwareness();
  registerGlobalShortcuts();
  mainWindow.on("close", () => {
    saveCurrentWindowPosition();
    saveSettings();
    closeControlMenu();
    closeStatusBubble();
    closeSpeechBubble();
    closeChatBubble();
    closeWidget();
    closeSettingsWindow();
  });
  mainWindow.on("closed", () => {
    closeChatBubble();
    closeWidget();
    mainWindow = null;
  });
  mainWindow.on("hide", () => {
    closeChatBubble();
    closeWidget();
  });
}

app.whenReady().then(createWindow);

app.on("before-quit", () => {
  globalShortcut.unregisterAll();
  stopTimeAwareness();
  saveCurrentWindowPosition();
  saveSettings();
  closeControlMenu();
  closeStatusBubble();
  closeSpeechBubble();
  closeChatBubble();
  closeWidget();
  closeSettingsWindow();
});

app.on("window-all-closed", () => {
  closeChatBubble();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on("drag-start", (_event, point) => {
  if (!mainWindow) return;
  closeControlMenu();
  stopWindowMotion();
  dragState = {
    startMouse: point,
    startBounds: mainWindow.getBounds()
  };
});

ipcMain.on("drag-move", (_event, point) => {
  if (!mainWindow || !dragState) return;

  const nextX = dragState.startBounds.x + point.x - dragState.startMouse.x;
  const nextY = dragState.startBounds.y + point.y - dragState.startMouse.y - DRAG_LIFT_Y;
  const bounds = keepVisible({
    x: Math.round(nextX),
    y: Math.round(nextY),
    width: dragState.startBounds.width,
    height: dragState.startBounds.height
  });

  mainWindow.setBounds(bounds);
  repositionChatBubble();
  repositionWidget();
});

ipcMain.on("drag-end", () => {
  if (!mainWindow || !dragState) return;

  const currentBounds = mainWindow.getBounds();
  const settledBounds = keepVisible({
    x: currentBounds.x,
    y: currentBounds.y + DRAG_LIFT_Y,
    width: currentBounds.width,
    height: currentBounds.height
  });

  dragState = null;
  animateRelease(currentBounds, settledBounds, RELEASE_BOUNCE_HEIGHT, RELEASE_BOUNCE_DURATION_MS);
});

ipcMain.on("window-jump", () => {
  if (!mainWindow) return;
  const height = JUMP_HEIGHT_MAP[settings?.jumpHeightMode] ?? JUMP_HEIGHT;
  animateJump(height, JUMP_DURATION);
});

ipcMain.on("window-bounce", () => {
  if (!mainWindow) return;
  animateBounce(RELEASE_BOUNCE_HEIGHT, RELEASE_BOUNCE_DURATION_MS);
});

ipcMain.on("window-walk", (_event, distance) => {
  if (!mainWindow) return;
  animateWalk(distance);
});

ipcMain.on("open-control-menu", (_event, point) => {
  toggleControlMenu(point);
});

ipcMain.on("close-control-menu", () => {
  closeControlMenu();
});

ipcMain.on("control-menu-action", (_event, action) => {
  closeControlMenu();
  if (action === "exit") {
    cleanExit();
    return;
  }
  if (action === "hide-to-tray") {
    hidePet();
    return;
  }
  if (action === "open-settings") {
    toggleSettingsWindow();
    return;
  }
  if (action === "toggle-chat") {
    toggleChatBubble();
    return;
  }

  if (mainWindow) mainWindow.webContents.send("menu-action", action);
});

ipcMain.on("show-status-bubble", (_event, text) => {
  showStatusBubble(String(text || ""));
});

ipcMain.on("show-speech-bubble", (_event, text) => {
  showSpeechBubble(String(text || ""));
});

ipcMain.on("close-speech-bubble", () => {
  closeSpeechBubble();
});

function buildChatCompletionsUrl(baseUrl) {
  const clean = String(baseUrl || "").replace(/\/+$/, "");
  if (clean.endsWith("/chat/completions")) return clean;
  return `${clean}/chat/completions`;
}

function extractChatReply(data) {
  if (!data || typeof data !== "object") return null;

  // Check for error object first
  if (data.error) {
    const msg = typeof data.error === "string" ? data.error : (data.error.message || JSON.stringify(data.error));
    return { error: "服务商错误：" + String(msg).slice(0, 120) };
  }

  let reply = null;

  // 1. OpenAI / DeepSeek / Kimi standard
  if (data.choices?.[0]?.message?.content) {
    reply = data.choices[0].message.content;
  }
  // 2. Streaming delta残留
  else if (data.choices?.[0]?.delta?.content) {
    reply = data.choices[0].delta.content;
  }
  // 3. Legacy completions
  else if (data.choices?.[0]?.text) {
    reply = data.choices[0].text;
  }
  // 4. Responses API
  else if (data.output_text) {
    reply = Array.isArray(data.output_text) ? data.output_text.join("") : data.output_text;
  }
  // 5. Other common formats
  else if (data.message?.content) {
    reply = data.message.content;
  }
  else if (typeof data.content === "string") {
    reply = data.content;
  }
  else if (typeof data.reply === "string") {
    reply = data.reply;
  }
  else if (typeof data.response === "string") {
    reply = data.response;
  }

  if (reply && typeof reply === "string") {
    return { reply: reply.trim() };
  }
  if (reply && Array.isArray(reply)) {
    return { reply: reply.map(r => r?.text || r?.content || String(r)).join("").trim() };
  }

  // Debug: log safe summary
  try {
    const topKeys = Object.keys(data).slice(0, 8);
    const hasChoices = Array.isArray(data.choices);
    const choiceKeys = hasChoices && data.choices[0] ? Object.keys(data.choices[0]).slice(0, 6) : [];
    console.warn("[chat-send] 未识别的返回格式:", { topKeys, hasChoices, choiceKeys });
  } catch {}

  return null;
}

function extractHttpError(body, statusCode) {
  if (!body) return `请求失败：${statusCode}`;
  try {
    const data = JSON.parse(body);
    const msg = data?.error?.message || data?.message || data?.detail;
    if (msg) return `请求失败：${statusCode} ${String(msg).slice(0, 120)}`;
  } catch {}
  const snippet = String(body).slice(0, 120).replace(/[\r\n]+/g, " ");
  return `请求失败：${statusCode} ${snippet}`;
}

function notifyChatFailed() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("chat-failed");
  }
}

ipcMain.handle("chat-send", async (_event, userText) => {
  if (!chatBubbleWindow || chatBubbleWindow.isDestroyed()) {
    notifyChatFailed();
    return { ok: false, error: "窗口已关闭" };
  }

  const api = settings?.apiSettings;
  if (!api || !api.apiKeyEncrypted) {
    notifyChatFailed();
    return { ok: false, error: "还没有配置 API Key" };
  }
  if (!api.baseUrl || !api.model) {
    notifyChatFailed();
    return { ok: false, error: "API 设置还没填完整" };
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("chat-thinking");
  }

  try {
    const apiKey = decryptApiKey(api.apiKeyEncrypted);
    if (!apiKey) {
      notifyChatFailed();
      return { ok: false, error: "API Key 解密失败，请重新保存" };
    }

    const url = buildChatCompletionsUrl(api.baseUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: api.model,
        messages: [
          { role: "system", content: ASUKA_SYSTEM_PROMPT },
          { role: "user", content: String(userText || "").slice(0, 500) }
        ],
        temperature: 0.8,
        max_tokens: API_MAX_TOKENS,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    const responseText = await res.text().catch(() => "");

    if (!res.ok) {
      notifyChatFailed();
      return { ok: false, error: extractHttpError(responseText, res.status) };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      notifyChatFailed();
      return { ok: false, error: "返回格式不对，无法解析 JSON" };
    }

    const result = extractChatReply(data);

    if (result?.error) {
      notifyChatFailed();
      return { ok: false, error: result.error };
    }

    if (!result?.reply) {
      notifyChatFailed();
      return { ok: false, error: "返回格式不兼容，已收到响应但未找到文本。" };
    }

    let reply = result.reply;
    if (reply.length > REPLY_MAX_CHARS) {
      reply = reply.slice(0, REPLY_MAX_CHARS) + "……";
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("chat-replied");
    }

    return { ok: true, reply };
  } catch (err) {
    if (err?.name === "AbortError") {
      notifyChatFailed();
      return { ok: false, error: "等太久了，检查网络或服务商" };
    }
    notifyChatFailed();
    return { ok: false, error: "连接失败，稍后再试" };
  }
});

ipcMain.on("close-chat-bubble", () => {
  closeChatBubble();
});

ipcMain.on("toggle-widget", () => {
  toggleWidget();
});

ipcMain.on("emotion-update", (_event, data) => {
  cachedEmotion = data;
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("emotion-update", data);
  }
});

ipcMain.handle("get-api-settings", () => {
  return getApiSettingsSafe();
});

ipcMain.on("save-api-settings", (_event, { provider, baseUrl, model, apiKey }) => {
  const current = settings?.apiSettings ?? getDefaultSettings().apiSettings;
  const enc = encryptApiKey(apiKey);
  settings = normalizeSettings({
    ...(settings ?? getDefaultSettings()),
    apiSettings: {
      provider: provider || current.provider,
      baseUrl: baseUrl ?? current.baseUrl,
      model: model ?? current.model,
      apiKeyEncrypted: apiKey ? enc.encrypted : current.apiKeyEncrypted,
      apiKeyLast4: apiKey ? enc.last4 : current.apiKeyLast4
    }
  });
  saveSettings();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("api-settings-saved");
  }
});

ipcMain.on("clear-api-key", () => {
  const current = settings?.apiSettings ?? getDefaultSettings().apiSettings;
  settings = normalizeSettings({
    ...(settings ?? getDefaultSettings()),
    apiSettings: { ...current, apiKeyEncrypted: "", apiKeyLast4: "" }
  });
  saveSettings();
});

ipcMain.on("test-api-settings", (_event) => {
  const api = settings?.apiSettings;
  if (!api || !api.baseUrl || !api.model) {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send("api-test-result", { ok: false, msg: "请填写 Base URL 和模型名" });
    }
    return;
  }
  if (!api.apiKeyEncrypted) {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send("api-test-result", { ok: false, msg: "请先填写并保存 API Key" });
    }
    return;
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("api-test-result", { ok: true, msg: "字段填写完整，连接配置已保存" });
  }
});

ipcMain.handle("get-settings", () => settings ?? getDefaultSettings());

ipcMain.handle("update-settings", (_event, patch) => {
  settings = normalizeSettings({ ...(settings ?? getDefaultSettings()), ...patch });
  saveSettings();
  applyStartupSetting();
  updateTrayMenu();
  return settings;
});

ipcMain.on("renderer-ready", () => {
  sendSettingsToRenderer();
});

ipcMain.on("settings-change", (_event, { key, value }) => {
  settings = normalizeSettings({ ...(settings ?? getDefaultSettings()), [key]: value });
  if (key === "chatEnabled" && settings.chatEnabled === false) {
    closeChatBubble();
  }
  if (key === "widgetEnabled" && settings.widgetEnabled === false) {
    closeWidget();
  }
  saveSettings();
  sendSettingsToRenderer();
  updateTrayMenu();
  if (key === "petScale") resizeMainWindow();
});

ipcMain.on("reset-position", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const width = Math.round(BASE_WIDTH * (settings?.petScale ?? PET_SCALE));
  const height = Math.round(BASE_HEIGHT * (settings?.petScale ?? PET_SCALE));
  const primary = screen.getPrimaryDisplay().workArea;
  const x = primary.x + primary.width - width - 60;
  const y = primary.y + Math.round((primary.height - height) / 2);
  mainWindow.setBounds({ x, y, width, height });
  saveCurrentWindowPosition();
  saveSettings();
  if (chatBubbleWindow && chatBubbleWindow.isDestroyed()) {
    chatBubbleWindow = null;
    chatBubbleOpen = false;
  }
  repositionChatBubble();
  repositionWidget();
});

ipcMain.on("close-settings", () => {
  closeSettingsWindow();
});

function stopWindowMotion() {
  if (motionFrame) {
    clearInterval(motionFrame);
    motionFrame = null;
  }
}

function runMainProcessAnimation(durationMs, onFrame, onDone) {
  const start = Date.now();
  const fps = 60;
  const intervalMs = 1000 / fps;

  const timer = setInterval(() => {
    const elapsed = Date.now() - start;
    const t = Math.min(1, elapsed / durationMs);

    try {
      onFrame(t);
    } catch (error) {
      clearInterval(timer);
      if (motionFrame === timer) motionFrame = null;
      if (onDone) onDone(error);
      return;
    }

    if (t >= 1) {
      clearInterval(timer);
      if (motionFrame === timer) motionFrame = null;
      if (onDone) onDone(null);
    }
  }, intervalMs);

  return timer;
}

function sendWindowMotionEnded(reason) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("window-motion-ended", reason);
  }
}

function animateJump(height, duration) {
  stopWindowMotion();

  const bounds = mainWindow.getBounds();
  const peakRatio = 0.45;

  motionFrame = runMainProcessAnimation(duration, (progress) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error("main window destroyed during jump animation");
    }

    let lift;

    if (progress < peakRatio) {
      const t = progress / peakRatio;
      lift = easeOutCubic(t) * height;
    } else {
      const t = (progress - peakRatio) / (1 - peakRatio);
      lift = (1 - easeInCubic(t)) * height;
    }

    const y = Math.round(bounds.y - lift);
    mainWindow.setBounds(keepVisible({ x: bounds.x, y, width: bounds.width, height: bounds.height }));
  }, (error) => {
    if (error) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds(bounds);
      animateBounce(RELEASE_BOUNCE_HEIGHT, RELEASE_BOUNCE_DURATION_MS);
    }
  });
}

function animateBounce(height, duration) {
  stopWindowMotion();

  const bounds = mainWindow.getBounds();

  motionFrame = runMainProcessAnimation(duration, (progress) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error("main window destroyed during bounce animation");
    }

    const bounce = Math.sin(progress * Math.PI * 2) * height * (1 - progress);
    const y = Math.round(bounds.y - bounce);

    mainWindow.setBounds(keepVisible({ x: bounds.x, y, width: bounds.width, height: bounds.height }));
  }, (error) => {
    if (error) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds(keepVisible(bounds));
      sendWindowMotionEnded("bounce");
    }
  });
}

function animateRelease(fromBounds, toBounds, height, duration) {
  stopWindowMotion();

  motionFrame = runMainProcessAnimation(duration, (progress) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error("main window destroyed during release animation");
    }

    const eased = easeOutCubic(progress);
    const bounce = Math.sin(progress * Math.PI * 2) * height * (1 - progress);
    const x = Math.round(fromBounds.x + (toBounds.x - fromBounds.x) * eased);
    const y = Math.round(fromBounds.y + (toBounds.y - fromBounds.y) * eased - bounce);

    mainWindow.setBounds(keepVisible({ x, y, width: toBounds.width, height: toBounds.height }));
  }, (error) => {
    if (error) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds(keepVisible(toBounds));
      saveCurrentWindowPosition();
      saveSettings();
      repositionChatBubble();
      sendWindowMotionEnded("release");
    }
  });
}

function animateWalk(distance) {
  stopWindowMotion();

  const bounds = mainWindow.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const targetX = clamp(
    bounds.x + distance,
    area.x - bounds.width + EDGE_MARGIN,
    area.x + area.width - EDGE_MARGIN
  );

  motionFrame = runMainProcessAnimation(WALK_DURATION, (progress) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error("main window destroyed during walk animation");
    }

    const eased = easeInOutCubic(progress);
    const x = Math.round(bounds.x + (targetX - bounds.x) * eased);

    mainWindow.setBounds(keepVisible({ x, y: bounds.y, width: bounds.width, height: bounds.height }));
  }, (error) => {
    if (error) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds(keepVisible({ x: targetX, y: bounds.y, width: bounds.width, height: bounds.height }));
      saveCurrentWindowPosition();
      saveSettings();
      repositionChatBubble();
      sendWindowMotionEnded("walk");
    }
  });
}

function easeOutCubic(progress) {
  return 1 - Math.pow(1 - progress, 3);
}

function easeInCubic(progress) {
  return progress * progress * progress;
}

function easeInOutCubic(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function keepVisible(bounds) {
  return clampPositionToScreen(bounds.x, bounds.y, bounds.width, bounds.height);
}

function toggleControlMenu(point) {
  if (menuWindow && !menuWindow.isDestroyed()) {
    closeControlMenu();
    return;
  }

  const width = 224;
  const height = 438;
  const display = screen.getDisplayNearestPoint(point);
  const area = display.workArea;
  const x = clamp(point.x + 8, area.x, area.x + area.width - width);
  const y = clamp(point.y + 8, area.y, area.y + area.height - height);

  menuWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  menuWindow.setAlwaysOnTop(true, "screen-saver");
  menuWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(controlMenuHtml())}`);
  menuWindow.on("blur", closeControlMenu);
  menuWindow.on("closed", () => {
    menuWindow = null;
  });
}

function closeControlMenu() {
  if (menuWindow && !menuWindow.isDestroyed()) {
    const win = menuWindow;
    menuWindow = null;
    win.close();
  }
}

function toggleSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    closeSettingsWindow();
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) return;

  const width = 280;
  const height = 680;
  const petBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const x = clamp(petBounds.x + petBounds.width + 8, area.x, area.x + area.width - width);
  const y = clamp(petBounds.y, area.y, area.y + area.height - height);

  settingsWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.setAlwaysOnTop(true, "screen-saver");
  settingsWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(settingsHtml())}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("request-emotion");
  }
  settingsWindow.on("blur", closeSettingsWindow);
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function closeSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    const win = settingsWindow;
    settingsWindow = null;
    win.close();
  }
}

function resizeMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const scale = settings?.petScale ?? PET_SCALE;
  const width = Math.round(BASE_WIDTH * scale);
  const height = Math.round(BASE_HEIGHT * scale);
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const x = clamp(bounds.x, area.x - width + EDGE_MARGIN, area.x + area.width - EDGE_MARGIN);
  const y = clamp(bounds.y, area.y - height + EDGE_MARGIN, area.y + area.height - EDGE_MARGIN);
  mainWindow.setBounds({ x, y, width, height });
  saveCurrentWindowPosition();
  repositionChatBubble();
  repositionWidget();
}

function controlMenuHtml() {
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
    .menu {
      margin: 6px;
      padding: 10px;
      border-radius: 14px;
      background:
        linear-gradient(180deg, rgba(31, 34, 46, 0.96), rgba(13, 16, 25, 0.94));
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow:
        0 16px 34px rgba(0, 0, 0, 0.34),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
    }
    .menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 2px 9px;
    }
    .title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .subtitle {
      margin-top: 2px;
      color: rgba(226, 232, 240, 0.58);
      font-size: 10px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #f87171;
      box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.12);
    }
    .section-title {
      margin: 7px 2px 5px;
      color: rgba(226, 232, 240, 0.58);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .divider {
      height: 1px;
      margin: 8px 2px 7px;
      background: rgba(255, 255, 255, 0.12);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 29px;
      margin: 0;
      padding: 0 9px;
      border: 1px solid transparent;
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.055);
      color: inherit;
      text-align: left;
      font-size: 12px;
      line-height: 1.2;
      cursor: pointer;
      outline: none;
      transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    }
    .stack {
      display: grid;
      gap: 6px;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.12);
    }
    button.clicked {
      background: rgba(255, 255, 255, 0.22);
      transform: translateY(1px);
    }
    button.enabled {
      background: rgba(34, 197, 94, 0.18);
      border-color: rgba(74, 222, 128, 0.3);
      color: #bbf7d0;
    }
    button.enabled:hover {
      background: rgba(34, 197, 94, 0.27);
    }
    .label {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .hint,
    .switch-pill {
      flex: 0 0 auto;
      margin-left: 8px;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.09);
      color: rgba(226, 232, 240, 0.72);
      font-size: 10px;
      line-height: 1.2;
    }
    button.enabled .switch-pill {
      background: rgba(74, 222, 128, 0.18);
      color: #dcfce7;
    }
    button.danger {
      color: #fecaca;
      background: rgba(248, 113, 113, 0.08);
    }
    button.danger:hover {
      background: rgba(248, 113, 113, 0.18);
      border-color: rgba(248, 113, 113, 0.22);
    }
  </style>
</head>
<body>
  <div class="menu">
    <div class="menu-header">
      <div>
        <div class="title">桌宠菜单</div>
        <div class="subtitle">Asuka Pet Assistant</div>
      </div>
      <span class="status-dot"></span>
    </div>

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
      <button class="${randomWalkClass}" data-action="toggle-random-walk">
        <span class="label">随机走动</span>
        <span class="switch-pill">${randomWalkState}</span>
      </button>
      <button class="${quietModeClass}" data-action="quiet-mode">
        <span class="label">安静模式</span>
        <span class="switch-pill">${quietModeState}</span>
      </button>
    </div>

    <div class="section-title">工具</div>
    <div class="stack">
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
      setTimeout(() => {
        ipcRenderer.send("control-menu-action", action);
      }, 100);
    });
    document.addEventListener("contextmenu", (event) => event.preventDefault());
  </script>
</body>
</html>`;
}

function settingsHtml() {
  const s = settings ?? getDefaultSettings();
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

function cleanExit() {
  saveCurrentWindowPosition();
  saveSettings();
  closeControlMenu();
  closeStatusBubble();
  closeSpeechBubble();
  closeChatBubble();
  closeWidget();
  closeSettingsWindow();
  if (tray) {
    tray.destroy();
    tray = null;
  }
  app.quit();
}

function registerGlobalShortcuts() {
  const registered = globalShortcut.register("CommandOrControl+Shift+P", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible()) {
      hidePet();
    } else {
      showPet();
    }
  });
  if (!registered) {
    console.warn("[pet] 全局快捷键 Ctrl+Shift+P 注册失败，可能已被其他应用占用");
  }
}

function createTray() {
  if (tray) return;

  tray = new Tray(getTrayIcon());
  tray.setToolTip("Asuka Pet Assistant");
  tray.on("click", showPet);
  updateTrayMenu();
}

function getTrayIcon() {
  const iconCandidates = [
    path.join(__dirname, "app.ico"),
    path.join(__dirname, "icon.ico")
  ];

  for (const iconPath of iconCandidates) {
    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) return icon;
    }
  }

  return nativeImage.createFromDataURL(FALLBACK_TRAY_ICON);
}

function updateTrayMenu() {
  if (!tray) return;

  const randomWalkLabel = settings?.randomWalkEnabled ? "随机走动：开" : "随机走动：关";
  const quietModeLabel = settings?.quietMode ? "安静模式：开" : "安静模式：关";
  const startupLabel = settings?.startupEnabled ? "开机启动：开" : "开机启动：关";

  const menu = Menu.buildFromTemplate([
    { label: "显示桌宠", click: showPet },
    { label: "隐藏桌宠", click: hidePet },
    { type: "separator" },
    { label: randomWalkLabel, click: () => updateRuntimeSetting({ randomWalkEnabled: !settings.randomWalkEnabled, quietMode: false }, "Random Walk") },
    { label: quietModeLabel, click: () => updateRuntimeSetting({ quietMode: !settings.quietMode, randomWalkEnabled: settings.quietMode ? settings.randomWalkEnabled : false }, "Quiet Mode") },
    { label: startupLabel, click: toggleStartup },
    { type: "separator" },
    { label: "退出", click: cleanExit }
  ]);

  tray.setContextMenu(menu);
}

function showPet() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.focus();
}

function hidePet() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  saveCurrentWindowPosition();
  saveSettings();
  closeControlMenu();
  closeStatusBubble();
  closeSpeechBubble();
  closeChatBubble();
  closeWidget();
  mainWindow.hide();
}

function updateRuntimeSetting(patch, label) {
  settings = normalizeSettings({ ...(settings ?? getDefaultSettings()), ...patch });
  saveSettings();
  applyStartupSetting();
  updateTrayMenu();
  sendSettingsToRenderer();

  if (label === "Random Walk") showStatusBubble(`随机走动：${settings.randomWalkEnabled ? "开" : "关"}`);
  if (label === "Quiet Mode") showStatusBubble(`安静模式：${settings.quietMode ? "开" : "关"}`);
}

function toggleStartup() {
  settings = normalizeSettings({
    ...(settings ?? getDefaultSettings()),
    startupEnabled: !(settings ?? getDefaultSettings()).startupEnabled
  });
  saveSettings();
  applyStartupSetting();
  updateTrayMenu();
  showStatusBubble(`开机启动：${settings.startupEnabled ? "开" : "关"}`);
}

function applyStartupSetting() {
  if (process.platform !== "win32" || !settings) return;

  app.setLoginItemSettings({
    openAtLogin: Boolean(settings.startupEnabled),
    path: process.execPath
  });
}

function sendSettingsToRenderer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("settings-changed", settings ?? getDefaultSettings());
}

function showStatusBubble(text) {
  if (!mainWindow || !text.trim()) return;

  closeStatusBubble();

  const width = 150;
  const height = 42;
  const petBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const x = clamp(petBounds.x + Math.round(petBounds.width / 2) - Math.round(width / 2), area.x, area.x + area.width - width);
  const y = clamp(petBounds.y - height - 8, area.y, area.y + area.height - height);

  statusWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  statusWindow.setIgnoreMouseEvents(true);
  statusWindow.setAlwaysOnTop(true, "screen-saver");
  statusWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(statusBubbleHtml(text))}`);
  statusWindow.on("closed", () => {
    statusWindow = null;
  });

  statusTimer = setTimeout(closeStatusBubble, STATUS_BUBBLE_DURATION_MS);
}

function closeStatusBubble() {
  clearTimeout(statusTimer);
  statusTimer = null;

  if (statusWindow && !statusWindow.isDestroyed()) {
    const win = statusWindow;
    statusWindow = null;
    win.close();
  }
}

function showSpeechBubble(text) {
  if (!mainWindow || !text.trim()) return;

  closeSpeechBubble();

  const width = 180;
  const height = 32;
  const petBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const x = clamp(petBounds.x + Math.round(petBounds.width / 2) - Math.round(width / 2), area.x, area.x + area.width - width);
  let y = petBounds.y - height - 10;
  if (y < area.y) y = petBounds.y + petBounds.height + 6;
  y = clamp(y, area.y, area.y + area.height - height);

  speechBubbleWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  speechBubbleWindow.setIgnoreMouseEvents(true);
  speechBubbleWindow.setAlwaysOnTop(true, "screen-saver");
  speechBubbleWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(speechBubbleHtml(text))}`);
  speechBubbleWindow.on("closed", () => {
    speechBubbleWindow = null;
  });

  speechBubbleTimer = setTimeout(closeSpeechBubble, SPEECH_BUBBLE_DURATION_MS);
}

function closeSpeechBubble() {
  clearTimeout(speechBubbleTimer);
  speechBubbleTimer = null;

  if (speechBubbleWindow && !speechBubbleWindow.isDestroyed()) {
    const win = speechBubbleWindow;
    speechBubbleWindow = null;
    win.close();
  }
}

function toggleChatBubble() {
  if (chatBubbleWindow && !chatBubbleWindow.isDestroyed()) {
    closeChatBubble();
    return;
  }
  showChatBubble();
}

function debugChatWindow(...args) {
  if (DEBUG_CHAT_WINDOW) console.log("[chat-window]", ...args);
}

function getChatBubbleBounds() {
  const petBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const chatWidth = clamp(Math.round(petBounds.width * 2.0), 200, 300);
  const chatHeight = clamp(Math.round(petBounds.height * 0.72), 130, 190);

  let x = petBounds.x + petBounds.width + 8;
  if (x + chatWidth > area.x + area.width - EDGE_MARGIN) {
    x = petBounds.x - chatWidth - 8;
  }
  let y = petBounds.y + Math.round(petBounds.height * 0.05);
  x = clamp(x, area.x + EDGE_MARGIN, area.x + area.width - chatWidth - EDGE_MARGIN);
  y = clamp(y, area.y + EDGE_MARGIN, area.y + area.height - chatHeight - EDGE_MARGIN);

  return { x, y, width: chatWidth, height: chatHeight };
}

function showChatBubble() {
  debugChatWindow("showChatBubble");
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (chatBubbleWindow && !chatBubbleWindow.isDestroyed()) {
    closeChatBubble();
  } else if (chatBubbleWindow && chatBubbleWindow.isDestroyed()) {
    chatBubbleWindow = null;
    chatBubbleOpen = false;
  }
  if (!(settings?.chatEnabled !== false)) {
    showStatusBubble("对话入口已关闭");
    return;
  }

  closeSpeechBubble();

  const bounds = getChatBubbleBounds();

  chatBubbleWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  chatBubbleOpen = true;
  chatBubbleWindow.setAlwaysOnTop(true, "screen-saver");
  chatBubbleWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(chatBubbleHtml())}`);
  chatBubbleWindow.setBounds(bounds);
  chatBubbleWindow.show();
  chatBubbleWindow.on("closed", () => {
    debugChatWindow("chatBubble closed event");
    chatBubbleWindow = null;
    chatBubbleOpen = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("chat-closed");
    }
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("chat-opened");
  }
}

function repositionChatBubble() {
  if (!chatBubbleWindow || chatBubbleWindow.isDestroyed()) {
    debugChatWindow("reposition skipped destroyed window");
    chatBubbleWindow = null;
    chatBubbleOpen = false;
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    closeChatBubble();
    return;
  }

  const bounds = getChatBubbleBounds();
  chatBubbleWindow.setBounds(bounds);
}

function closeChatBubble() {
  debugChatWindow("closeChatBubble");
  chatBubbleOpen = false;

  if (chatBubbleWindow && !chatBubbleWindow.isDestroyed()) {
    const win = chatBubbleWindow;
    try {
      win.removeAllListeners("closed");
      win.close();
      if (!win.isDestroyed()) {
        win.destroy();
      }
    } catch {
      try {
        if (!win.isDestroyed()) win.destroy();
      } catch {}
    }
  }

  chatBubbleWindow = null;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("chat-closed");
  }
}

function toggleWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    closeWidget();
    return;
  }
  showWidget();
}

function showWidget() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!(settings?.widgetEnabled !== false)) {
    showStatusBubble("小组件已关闭");
    return;
  }

  closeWidget();

  const width = 120;
  const height = 48;
  const petBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const x = clamp(petBounds.x + Math.round(petBounds.width / 2) - Math.round(width / 2), area.x, area.x + area.width - width);
  const y = clamp(petBounds.y - height - 42, area.y, area.y + area.height - height);

  widgetWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  widgetWindow.setIgnoreMouseEvents(true);
  widgetWindow.setAlwaysOnTop(true, "screen-saver");
  updateWidgetContent();

  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });

  // Update every 30 seconds
  widgetTimer = setInterval(() => updateWidgetContent(), 30000);
}

function updateWidgetContent() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const weatherStr = lastWeatherPhrase ? getWeatherLabel(lastWeatherPhrase) : "";
  widgetWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(widgetHtml(timeStr, weatherStr))}`);
}

function getWeatherLabel(phrase) {
  const map = {
    weatherRain: "🌧 雨",
    weatherSnow: "❄ 雪",
    weatherCold: "🥶 冷",
    weatherHot: "🥵 热",
    weatherClear: "☀ 晴"
  };
  return map[phrase] || "";
}

function closeWidget() {
  if (widgetTimer) {
    clearInterval(widgetTimer);
    widgetTimer = null;
  }
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    const win = widgetWindow;
    widgetWindow = null;
    win.close();
  }
}

function repositionWidget() {
  if (!widgetWindow || widgetWindow.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) return;
  const width = 120;
  const height = 48;
  const petBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const x = clamp(petBounds.x + Math.round(petBounds.width / 2) - Math.round(width / 2), area.x, area.x + area.width - width);
  const y = clamp(petBounds.y - height - 42, area.y, area.y + area.height - height);
  widgetWindow.setBounds({ x, y, width, height });
}

function widgetHtml(timeStr, weatherStr) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      color: #f8fafc;
      user-select: none;
      pointer-events: none;
    }
    .widget {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 4px 10px;
      background: rgba(20, 20, 20, 0.72);
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .time {
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 1px;
      line-height: 1.2;
    }
    .weather {
      font-size: 11px;
      color: rgba(255,255,255,0.55);
      line-height: 1.2;
    }
  </style>
</head>
<body>
  <div class="widget">
    <div class="time">${escapeHtml(timeStr)}</div>
    ${weatherStr ? `<div class="weather">${escapeHtml(weatherStr)}</div>` : ""}
  </div>
</body>
</html>`;
}

function statusBubbleHtml(text) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
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
    .bubble {
      display: grid;
      place-items: center;
      height: 34px;
      margin: 4px;
      padding: 0 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
      font-size: 13px;
      line-height: 1;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="bubble">${escapeHtml(text)}</div>
</body>
</html>`;
}

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

function speechBubbleHtml(text) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      color: #f8fafc;
      user-select: none;
      pointer-events: none;
    }
    .speech {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 170px;
      height: 24px;
      margin: 4px;
      padding: 2px 10px;
      border-radius: 12px;
      background: rgba(20, 20, 20, 0.78);
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
      letter-spacing: 0.2px;
    }
  </style>
</head>
<body>
  <div class="speech">${escapeHtml(text)}</div>
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

function getDefaultSettings() {
  return {
    windowPosition: null,
    randomWalkEnabled: false,
    quietMode: false,
    startupEnabled: false,
    petScale: PET_SCALE,
    blinkMode: "normal",
    randomIdleEnabled: false,
    jumpHeightMode: "normal",
    speechBubbleEnabled: true,
    chatEnabled: true,
    widgetEnabled: true,
    emotion: { mood: 0, energy: 50 },
    apiSettings: {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      apiKeyEncrypted: "",
      apiKeyLast4: ""
    }
  };
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "pet-settings.json");
}

function loadSettings() {
  try {
    const file = getSettingsPath();
    if (!fs.existsSync(file)) return getDefaultSettings();

    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return normalizeSettings({ ...getDefaultSettings(), ...parsed });
  } catch {
    return getDefaultSettings();
  }
}

function saveSettings() {
  try {
    const file = getSettingsPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(normalizeSettings(settings ?? getDefaultSettings()), null, 2));
  } catch {
    // Settings are non-critical; keep the pet running if persistence fails.
  }
}

function normalizeSettings(value) {
  const defaults = getDefaultSettings();
  const scale = Number(value.petScale);
  const position = value.windowPosition;
  const quietMode = Boolean(value.quietMode);
  const validBlinkModes = ["low", "normal", "high"];
  const validJumpModes = ["low", "normal", "high"];

  return {
    windowPosition:
      position && Number.isFinite(position.x) && Number.isFinite(position.y)
        ? { x: Math.round(position.x), y: Math.round(position.y) }
        : defaults.windowPosition,
    randomWalkEnabled: quietMode ? false : Boolean(value.randomWalkEnabled),
    quietMode,
    startupEnabled: Boolean(value.startupEnabled),
    petScale: Number.isFinite(scale) && scale > 0.2 && scale < 2 ? scale : defaults.petScale,
    blinkMode: validBlinkModes.includes(value.blinkMode) ? value.blinkMode : defaults.blinkMode,
    randomIdleEnabled: quietMode ? false : Boolean(value.randomIdleEnabled),
    jumpHeightMode: validJumpModes.includes(value.jumpHeightMode) ? value.jumpHeightMode : defaults.jumpHeightMode,
    speechBubbleEnabled: value.speechBubbleEnabled !== false,
    chatEnabled: value.chatEnabled !== false,
    widgetEnabled: value.widgetEnabled !== false,
    emotion: normalizeEmotion(value.emotion, defaults.emotion),
    apiSettings: normalizeApiSettings(value.apiSettings, defaults.apiSettings)
  };
}

function normalizeEmotion(value, defaults) {
  if (!value || typeof value !== "object") return defaults;
  const mood = Number(value.mood);
  const energy = Number(value.energy);
  return {
    mood: Number.isFinite(mood) ? Math.max(-100, Math.min(100, Math.round(mood))) : defaults.mood,
    energy: Number.isFinite(energy) ? Math.max(0, Math.min(100, Math.round(energy))) : defaults.energy
  };
}

function normalizeApiSettings(value, defaults) {
  if (!value || typeof value !== "object") return defaults;
  const provider = API_PROVIDERS[value.provider] ? value.provider : defaults.provider;
  return {
    provider,
    baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : defaults.baseUrl,
    model: typeof value.model === "string" ? value.model : defaults.model,
    apiKeyEncrypted: typeof value.apiKeyEncrypted === "string" ? value.apiKeyEncrypted : "",
    apiKeyLast4: typeof value.apiKeyLast4 === "string" ? value.apiKeyLast4 : ""
  };
}

function encryptApiKey(key) {
  if (!key) return { encrypted: "", last4: "" };
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = safeStorage.encryptString(key);
      return { encrypted: buf.toString("base64"), last4: key.slice(-4) };
    }
  } catch {}
  return { encrypted: "", last4: "" };
}

function decryptApiKey(encrypted) {
  if (!encrypted) return "";
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(encrypted, "base64");
      return safeStorage.decryptString(buf);
    }
  } catch {}
  return "";
}

function getApiSettingsSafe() {
  const s = settings ?? getDefaultSettings();
  const api = s.apiSettings;
  return {
    provider: api.provider,
    baseUrl: api.baseUrl,
    model: api.model,
    apiKeyLast4: api.apiKeyLast4,
    hasKey: Boolean(api.apiKeyEncrypted)
  };
}

function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const isLateNight = hour >= LATE_NIGHT_START && hour < LATE_NIGHT_END;
  let timePhrase = null;

  if (isLateNight) {
    timePhrase = "lateNight";
  } else if (hour >= 6 && hour < 9) {
    timePhrase = "morning";
  }

  return { hour, isLateNight, timePhrase };
}

function mapWeatherToPhrase(weatherCode) {
  // wttr.in weather codes: https://github.com/chubin/wttr.in/blob/master/docs/weather_codes.md
  const code = Number(weatherCode);
  if (code >= 200 && code < 300) return "weatherRain";  // thunderstorm
  if (code >= 300 && code < 400) return "weatherRain";  // drizzle
  if (code >= 500 && code < 600) return "weatherRain";  // rain
  if (code >= 600 && code < 700) return "weatherSnow";  // snow
  if (code >= 700 && code < 800) return "weatherCold";  // fog/mist/haze
  if (code === 800) return "weatherClear";               // clear sky
  if (code > 800) return "weatherClear";                 // clouds
  return null;
}

async function fetchWeather() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEATHER_API_TIMEOUT_MS);
    const res = await fetch("https://wttr.in/?format=j1", {
      signal: controller.signal,
      headers: { "User-Agent": "AsukaPet/1.0" }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const code = data?.current_condition?.[0]?.weatherCode;
    const tempC = Number(data?.current_condition?.[0]?.temp_C);
    const phrase = mapWeatherToPhrase(code);
    // Override to weatherHot if very hot
    if (tempC >= 35) return "weatherHot";
    // Override to weatherCold if very cold
    if (tempC <= 5 && phrase !== "weatherSnow") return "weatherCold";
    return phrase;
  } catch {
    return null;
  }
}

let lastWeatherPhrase = null;

async function updateTimeContext() {
  const timeCtx = getTimeContext();
  let weatherPhrase = null;

  // Only fetch weather if not in quiet hours and pet is visible
  if (!timeCtx.isLateNight && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    weatherPhrase = await fetchWeather();
  }

  // Don't repeat the same weather phrase
  const phraseToSend = weatherPhrase || timeCtx.timePhrase;
  if (phraseToSend && phraseToSend !== lastWeatherPhrase) {
    lastWeatherPhrase = phraseToSend;
  } else if (phraseToSend === lastWeatherPhrase) {
    // Same phrase, only send time context without phrase
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("time-context", {
        hour: timeCtx.hour,
        isLateNight: timeCtx.isLateNight,
        weatherPhrase: null,
        timePhrase: null
      });
    }
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("time-context", {
      hour: timeCtx.hour,
      isLateNight: timeCtx.isLateNight,
      weatherPhrase,
      timePhrase: timeCtx.timePhrase
    });
  }
}

let weatherInterval = null;

function startTimeAwareness() {
  // Initial check after 30 seconds (let the app fully load)
  setTimeout(() => updateTimeContext(), 30000);
  // Periodic check
  weatherInterval = setInterval(() => updateTimeContext(), WEATHER_CHECK_INTERVAL_MS);
}

function stopTimeAwareness() {
  if (weatherInterval) {
    clearInterval(weatherInterval);
    weatherInterval = null;
  }
}

function saveCurrentWindowPosition() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const bounds = mainWindow.getBounds();
  settings = normalizeSettings({
    ...(settings ?? getDefaultSettings()),
    windowPosition: { x: bounds.x, y: bounds.y }
  });
}

function clampPositionToScreen(x, y, width, height) {
  const bounds = {
    x: Math.round(Number.isFinite(x) ? x : 0),
    y: Math.round(Number.isFinite(y) ? y : 0),
    width,
    height
  };
  const area = screen.getDisplayMatching(bounds).workArea;

  return {
    x: clamp(bounds.x, area.x - width + EDGE_MARGIN, area.x + area.width - EDGE_MARGIN),
    y: clamp(bounds.y, area.y - height + EDGE_MARGIN, area.y + area.height - EDGE_MARGIN),
    width,
    height
  };
}
