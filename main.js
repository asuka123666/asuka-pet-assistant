const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, safeStorage, globalShortcut } = require("electron");
const fs = require("fs");
const path = require("path");
const { speechBubbleHtml, statusBubbleHtml } = require("./templates/bubbles");
const { controlMenuHtml } = require("./templates/control-menu");
const { reminderHtml } = require("./templates/reminder");
const { settingsHtml } = require("./templates/settings");
const { chatBubbleHtml } = require("./templates/chat-bubble");
const { widgetHtml } = require("./templates/widget");

const PET_SCALE = 0.6;
const BASE_WIDTH = 192;
const BASE_HEIGHT = 208;
const RESOURCE_DOCK_COMPACT_WIDTH = 28;
const RESOURCE_DOCK_EXPANDED_WIDTH = 190;
const RESOURCE_DOCK_EXPANDED_HEIGHT = 110;
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
const MOUSE_PROXIMITY_RADIUS = 90;
const MOUSE_PROXIMITY_DWELL_MS = 2000;
const MOUSE_PROXIMITY_COOLDOWN_MS = 9000;
const MOUSE_PROXIMITY_POLL_MS = 250;
const EDGE_REACTION_THRESHOLD = 42;
const FALLBACK_TRAY_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABZElEQVR4nOWXsWvCQBTGv3tJSi/SToJDFmkK7g5OgmJ2nfwHHfXPEMHFzUGh4tDZoR0aaAtXUmxo05zeJXc10G+7cO++H+8lefeA/y5WJEgI8SA9kLF7KwDihGkZGFbEfNdqhbK94Xa704FgqsanTFVgZCBkyzwbJysh2TJXhSDVYFMQZwHEkVIWdDse4269hlOvF4LIZoF0zBP5gwGeJhP4vZ4WgAyCdA5gnIM4x/Nshlq/DxMinc1+t4uX+Rxv+z3cIADzPHMAQiH9tSjCzXCIYDqF22jgutMpXQZXOdJx4DWbeByN0mwkZYgXC/xJCXi7jdfNJl3Hq9UnRFmR6kY/ihAvl+laxDHeDwdcheV+FUznHTClrx6R9Aetr8CGqDIA7Ngus/3cZvp/AFxKVCkAZrkM2fT/ArAJkWeeC5AXZMo8T5T38DtlWYhzF1OSBZqAULkVs0rPBZWZjJCRydnw4voA2xKvHGRMmB8AAAAASUVORK5CYII=";

let mainWindow;
let menuWindow;
let statusWindow;
let settingsWindow = null;
let reminderWindow = null;
let speechBubbleWindow = null;
let speechBubbleTimer = null;
let chatBubbleWindow = null;
let chatBubbleOpen = false;
let chatHistory = [];
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
const CHAT_HISTORY_MAX_MESSAGES = 10;
const WEATHER_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const WEATHER_API_TIMEOUT_MS = 8000;
const LATE_NIGHT_START = 0;
const LATE_NIGHT_END = 6;
let tray = null;
let statusTimer = null;
let dragState = null;
let motionFrame = null;
let proximityTimer = null;
let proximityCandidate = null;
let lastProximityReactionAt = 0;
let pendingEdgeInteraction = null;
let settings = null;
let resourceDockExpanded = false;
const reminderTimers = new Set();

function createWindow() {
  settings = loadSettings();
  applyStartupSetting();
  const width = getMainWindowWidth(settings);
  const height = getMainWindowHeight(settings);
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
  startMouseProximityWatcher();
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
    closeReminderWindow();
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

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showPet();
  });

  app.whenReady().then(createWindow);
}

app.on("before-quit", () => {
  globalShortcut.unregisterAll();
  stopMouseProximityWatcher();
  stopTimeAwareness();
  saveCurrentWindowPosition();
  saveSettings();
  closeControlMenu();
  closeStatusBubble();
  closeSpeechBubble();
  closeChatBubble();
  closeWidget();
  closeSettingsWindow();
  closeReminderWindow();
  clearReminderTimers();
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

  pendingEdgeInteraction = getEdgeInteraction(settledBounds);
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
  if (action === "open-reminder") {
    toggleReminderWindow();
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

ipcMain.on("close-reminder", () => {
  closeReminderWindow();
});

ipcMain.on("set-reminder", (_event, payload) => {
  const minutes = Math.max(1, Math.min(24 * 60, Math.round(Number(payload?.minutes) || 0)));
  const text = String(payload?.text || "").trim().slice(0, 60) || "休息一下";

  scheduleReminder(text, minutes);
  closeReminderWindow();
  showStatusBubble(`提醒已设置：${minutes} 分钟`);
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
    const trimmedText = String(userText || "").slice(0, 500);

    // Build messages: system prompt + history + current user message
    const messages = [
      { role: "system", content: ASUKA_SYSTEM_PROMPT },
      ...chatHistory,
      { role: "user", content: trimmedText }
    ];

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
        messages,
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

    // Update conversation history
    chatHistory.push({ role: "user", content: trimmedText });
    chatHistory.push({ role: "assistant", content: reply });
    // Trim to max messages
    if (chatHistory.length > CHAT_HISTORY_MAX_MESSAGES) {
      chatHistory = chatHistory.slice(chatHistory.length - CHAT_HISTORY_MAX_MESSAGES);
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
  const patch = { [key]: value };
  if (key === "resourceBubblePosition") {
    patch.resourceBubbleCustomPosition = null;
  }
  settings = normalizeSettings({ ...(settings ?? getDefaultSettings()), ...patch });
  if (key === "resourceDockEnabled" && settings.resourceDockEnabled === false) {
    resourceDockExpanded = false;
  }
  if (key === "chatEnabled" && settings.chatEnabled === false) {
    closeChatBubble();
  }
  if (key === "widgetEnabled" && settings.widgetEnabled === false) {
    closeWidget();
  }
  saveSettings();
  sendSettingsToRenderer();
  updateTrayMenu();
  if (key === "petScale" || key === "resourceDockEnabled") resizeMainWindow();
});

ipcMain.on("resource-dock-expanded-change", (_event, expanded) => {
  resourceDockExpanded = Boolean(expanded);
  resizeMainWindow();
});

ipcMain.on("reset-position", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const width = getMainWindowWidth(settings ?? getDefaultSettings());
  const height = getMainWindowHeight(settings ?? getDefaultSettings());
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
      if (pendingEdgeInteraction) {
        mainWindow.webContents.send("drag-edge-interaction", pendingEdgeInteraction);
        pendingEdgeInteraction = null;
      }
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

function startMouseProximityWatcher() {
  stopMouseProximityWatcher();
  proximityTimer = setInterval(checkMouseProximity, MOUSE_PROXIMITY_POLL_MS);
}

function stopMouseProximityWatcher() {
  if (proximityTimer) {
    clearInterval(proximityTimer);
    proximityTimer = null;
  }
  proximityCandidate = null;
}

function checkMouseProximity() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || dragState) {
    proximityCandidate = null;
    return;
  }

  const now = Date.now();
  if (now - lastProximityReactionAt < MOUSE_PROXIMITY_COOLDOWN_MS) return;

  const bounds = mainWindow.getBounds();
  const point = screen.getCursorScreenPoint();
  const expanded = {
    left: bounds.x - MOUSE_PROXIMITY_RADIUS,
    right: bounds.x + bounds.width + MOUSE_PROXIMITY_RADIUS,
    top: bounds.y - MOUSE_PROXIMITY_RADIUS,
    bottom: bounds.y + bounds.height + MOUSE_PROXIMITY_RADIUS
  };
  const insideExpanded = point.x >= expanded.left && point.x <= expanded.right && point.y >= expanded.top && point.y <= expanded.bottom;
  const insidePet = point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;

  if (!insideExpanded || insidePet) {
    proximityCandidate = null;
    return;
  }

  const direction = point.x < bounds.x ? "left" : point.x > bounds.x + bounds.width ? "right" : point.y < bounds.y ? "top" : "bottom";
  if (!proximityCandidate || proximityCandidate.direction !== direction) {
    proximityCandidate = { direction, startedAt: now };
    return;
  }

  if (now - proximityCandidate.startedAt >= MOUSE_PROXIMITY_DWELL_MS) {
    lastProximityReactionAt = now;
    proximityCandidate = null;
    mainWindow.webContents.send("mouse-proximity-attention", { direction });
  }
}

function getEdgeInteraction(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const nearLeft = bounds.x <= area.x - bounds.width + EDGE_MARGIN + EDGE_REACTION_THRESHOLD;
  const nearRight = bounds.x >= area.x + area.width - EDGE_MARGIN - EDGE_REACTION_THRESHOLD;
  const nearTop = bounds.y <= area.y - bounds.height + EDGE_MARGIN + EDGE_REACTION_THRESHOLD;
  const nearBottom = bounds.y >= area.y + area.height - EDGE_MARGIN - EDGE_REACTION_THRESHOLD;

  if (nearTop) return { edge: "top" };
  if (nearBottom) return { edge: "bottom" };
  if (nearLeft) return { edge: "left" };
  if (nearRight) return { edge: "right" };
  return null;
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
  menuWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(controlMenuHtml(settings))}`);
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
  const petBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const maxHeight = Math.min(680, area.height - 40);
  const height = Math.max(400, maxHeight);
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
  settingsWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(settingsHtml({ settings, defaultSettings: getDefaultSettings(), cachedEmotion, apiProviders: API_PROVIDERS }))}`);
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

function toggleReminderWindow() {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    closeReminderWindow();
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) return;

  const width = 250;
  const height = 220;
  const petBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const x = clamp(petBounds.x + petBounds.width + 8, area.x, area.x + area.width - width);
  const y = clamp(petBounds.y, area.y, area.y + area.height - height);

  reminderWindow = new BrowserWindow({
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

  reminderWindow.setAlwaysOnTop(true, "screen-saver");
  reminderWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(reminderHtml())}`);
  reminderWindow.on("blur", closeReminderWindow);
  reminderWindow.on("closed", () => {
    reminderWindow = null;
  });
}

function closeReminderWindow() {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    const win = reminderWindow;
    reminderWindow = null;
    win.close();
  }
}

function scheduleReminder(text, minutes) {
  const timer = setTimeout(() => {
    reminderTimers.delete(timer);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) showPet();
      showSpeechBubble(`提醒：${text}`);
      showStatusBubble("提醒时间到了");
      mainWindow.webContents.send("menu-action", "review");
    }
  }, minutes * 60 * 1000);

  reminderTimers.add(timer);
}

function clearReminderTimers() {
  for (const timer of reminderTimers) clearTimeout(timer);
  reminderTimers.clear();
}

function getMainWindowWidth(nextSettings = settings ?? getDefaultSettings()) {
  const petWidth = Math.round(BASE_WIDTH * (nextSettings?.petScale ?? PET_SCALE));
  return nextSettings?.resourceDockEnabled === false
    ? petWidth
    : Math.max(petWidth, resourceDockExpanded ? RESOURCE_DOCK_EXPANDED_WIDTH : RESOURCE_DOCK_COMPACT_WIDTH);
}

function getMainWindowHeight(nextSettings = settings ?? getDefaultSettings()) {
  const petHeight = Math.round(BASE_HEIGHT * (nextSettings?.petScale ?? PET_SCALE));
  return nextSettings?.resourceDockEnabled === false
    ? petHeight
    : petHeight + (resourceDockExpanded ? RESOURCE_DOCK_EXPANDED_HEIGHT : 0);
}

function resizeMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const width = getMainWindowWidth(settings ?? getDefaultSettings());
  const height = getMainWindowHeight(settings ?? getDefaultSettings());
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

function cleanExit() {
  saveCurrentWindowPosition();
  saveSettings();
  closeControlMenu();
  closeStatusBubble();
  closeSpeechBubble();
  closeChatBubble();
  closeWidget();
  closeSettingsWindow();
  closeReminderWindow();
  clearReminderTimers();
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
  const resourceDockLabel = settings?.resourceDockEnabled !== false ? "资源状态卡：开" : "资源状态卡：关";
  const startupLabel = settings?.startupEnabled ? "开机启动：开" : "开机启动：关";

  const menu = Menu.buildFromTemplate([
    { label: "显示桌宠", click: showPet },
    { label: "隐藏桌宠", click: hidePet },
    { type: "separator" },
    { label: randomWalkLabel, click: () => updateRuntimeSetting({ randomWalkEnabled: !settings.randomWalkEnabled, quietMode: false }, "Random Walk") },
    { label: quietModeLabel, click: () => updateRuntimeSetting({ quietMode: !settings.quietMode, randomWalkEnabled: settings.quietMode ? settings.randomWalkEnabled : false }, "Quiet Mode") },
    { label: resourceDockLabel, click: () => updateRuntimeSetting({ resourceDockEnabled: settings.resourceDockEnabled === false }, "Resource Dock") },
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
  if (Object.hasOwn(patch, "resourceDockEnabled") && settings.resourceDockEnabled === false) {
    resourceDockExpanded = false;
  }
  saveSettings();
  applyStartupSetting();
  updateTrayMenu();
  sendSettingsToRenderer();

  if (label === "Random Walk") showStatusBubble(`随机走动：${settings.randomWalkEnabled ? "开" : "关"}`);
  if (label === "Quiet Mode") showStatusBubble(`安静模式：${settings.quietMode ? "开" : "关"}`);
  if (label === "Resource Dock") {
    resizeMainWindow();
    showStatusBubble(`资源状态卡：${settings.resourceDockEnabled !== false ? "开" : "关"}`);
  }
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
  const y = clamp(petBounds.y - height - 2, area.y, area.y + area.height - height);

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
  if (!mainWindow || mainWindow.isDestroyed() || !text.trim()) return;

  // Force close any existing speech bubble first
  forceCloseSpeechBubble();

  const width = 180;
  const height = 32;
  const petBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const x = clamp(petBounds.x + Math.round(petBounds.width / 2) - Math.round(width / 2), area.x, area.x + area.width - width);
  let y = petBounds.y - height - 4;
  if (y < area.y) y = petBounds.y + petBounds.height + 4;
  y = clamp(y, area.y, area.y + area.height - height);

  const win = new BrowserWindow({
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

  win.setIgnoreMouseEvents(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(speechBubbleHtml(text, SPEECH_BUBBLE_DURATION_MS))}`);

  speechBubbleWindow = win;

  win.on("closed", () => {
    // Only null if this is still the current window
    if (speechBubbleWindow === win) {
      speechBubbleWindow = null;
    }
    if (speechBubbleTimer) {
      clearTimeout(speechBubbleTimer);
      speechBubbleTimer = null;
    }
  });

  // Auto-close timer
  speechBubbleTimer = setTimeout(() => {
    speechBubbleTimer = null;
    closeSpeechBubble();
  }, SPEECH_BUBBLE_DURATION_MS);
}

function closeSpeechBubble() {
  if (speechBubbleTimer) {
    clearTimeout(speechBubbleTimer);
    speechBubbleTimer = null;
  }

  const win = speechBubbleWindow;
  if (!win) return;

  speechBubbleWindow = null;

  try {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  } catch {}
}

function forceCloseSpeechBubble() {
  // Close any existing window, even if reference was lost
  if (speechBubbleTimer) {
    clearTimeout(speechBubbleTimer);
    speechBubbleTimer = null;
  }

  const win = speechBubbleWindow;
  speechBubbleWindow = null;

  if (win) {
    try {
      if (!win.isDestroyed()) win.destroy();
    } catch {}
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
  chatHistory = [];

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
  const y = clamp(petBounds.y - height - 18, area.y, area.y + area.height - height);

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
  const y = clamp(petBounds.y - height - 18, area.y, area.y + area.height - height);
  widgetWindow.setBounds({ x, y, width, height });
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
    resourceDockEnabled: true,
    resourceGpuEnabled: true,
    resourceBubbleShowPercent: true,
    resourceBubbleSize: "small",
    resourceBubbleOpacity: "medium",
    resourceBubblePosition: "bottom-right",
    resourceBubbleCustomPosition: null,
    resourcePressureSpeechEnabled: true,
    emotion: { mood: 0, energy: 50 },
    lastWeatherPhrase: null,
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
  const validResourceBubbleSizes = ["tiny", "small", "normal"];
  const validResourceBubbleOpacities = ["low", "medium", "high"];
  const validResourceBubblePositions = ["bottom-right", "bottom-left", "top-right", "top-left"];
  const customBubblePosition = value.resourceBubbleCustomPosition;

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
    resourceDockEnabled: value.resourceDockEnabled !== false,
    resourceGpuEnabled: value.resourceGpuEnabled !== false,
    resourceBubbleShowPercent: value.resourceBubbleShowPercent !== false,
    resourceBubbleSize: validResourceBubbleSizes.includes(value.resourceBubbleSize) ? value.resourceBubbleSize : defaults.resourceBubbleSize,
    resourceBubbleOpacity: validResourceBubbleOpacities.includes(value.resourceBubbleOpacity) ? value.resourceBubbleOpacity : defaults.resourceBubbleOpacity,
    resourceBubblePosition: validResourceBubblePositions.includes(value.resourceBubblePosition) ? value.resourceBubblePosition : defaults.resourceBubblePosition,
    resourceBubbleCustomPosition:
      customBubblePosition && Number.isFinite(customBubblePosition.x) && Number.isFinite(customBubblePosition.y)
        ? { x: Math.round(customBubblePosition.x), y: Math.round(customBubblePosition.y) }
        : defaults.resourceBubbleCustomPosition,
    resourcePressureSpeechEnabled: value.resourcePressureSpeechEnabled !== false,
    emotion: normalizeEmotion(value.emotion, defaults.emotion),
    lastWeatherPhrase: typeof value.lastWeatherPhrase === "string" ? value.lastWeatherPhrase : null,
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
  } else if (hour >= 11 && hour < 14) {
    timePhrase = "noon";
  } else if (hour >= 14 && hour < 18) {
    timePhrase = "afternoon";
  } else if (hour >= 18 && hour < 23) {
    timePhrase = "evening";
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

let lastWeatherPhrase = settings?.lastWeatherPhrase ?? null;

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
    // Persist weather cache
    settings = normalizeSettings({ ...(settings ?? getDefaultSettings()), lastWeatherPhrase });
    saveSettings();
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
