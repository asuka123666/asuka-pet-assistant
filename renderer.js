const { ipcRenderer } = require("electron");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const SPRITE_COLUMNS = 8;
const DEFAULT_SPRITE_ROWS = 9;
const DEFAULT_PET_SCALE = 0.6;

const CLICK_DELAY_MS = 260;
const DRAG_THRESHOLD_PX = 5;
const LONG_PRESS_MS = 600;
const RAPID_CLICK_COUNT = 4;
const RAPID_CLICK_WINDOW_MS = 2000;
const HEAD_HIT_ZONE_TOP = 0.06;
const HEAD_HIT_ZONE_BOTTOM = 0.48;
const HEAD_HIT_ZONE_LEFT = 0.18;
const HEAD_HIT_ZONE_RIGHT = 0.82;
const BODY_HIT_ZONE_TOP = 0.42;
const PROXIMITY_LOOK_DURATION_MS = 650;
const EDGE_REACTION_IDLE_BLOCK_MS = 1800;

const BLINK_MODE_MAP = {
  low:    { min: 6000, max: 9000 },
  normal: { min: 4000, max: 7000 },
  high:   { min: 3000, max: 5000 }
};
let idleBlinkMinMs = 4000;
let idleBlinkMaxMs = 7000;
const RANDOM_IDLE_MIN_MS = 45000;
const RANDOM_IDLE_MAX_MS = 90000;
const RANDOM_IDLE_AFTER_ACTION_MS = 10000;
const RESOURCE_UPDATE_MS = 1200;
const RESOURCE_UPDATE_MS_COLLAPSED = 3000;
const GPU_UPDATE_MS_EXPANDED = 5000;
const GPU_UPDATE_MS_COLLAPSED = 20000;
const GPU_COUNTER_TIMEOUT_MS = 3500;
const RESOURCE_PRESSURE_THRESHOLD = 88;
const RESOURCE_BUBBLE_DRAG_THRESHOLD_PX = 4;
const RESOURCE_BUBBLE_CLICK_SUPPRESS_MS = 220;
const DISK_ROOT = process.platform === "win32" ? `${process.env.SystemDrive || "C:"}\\` : "/";

const ENABLE_RANDOM_WALK_DEFAULT = false;
const RANDOM_WALK_MIN_MS = 30000;
const RANDOM_WALK_MAX_MS = 60000;
const RANDOM_WALK_MIN_DISTANCE = 80;
const RANDOM_WALK_MAX_DISTANCE = 160;
const TRANSITION_RESET_TO_NEUTRAL = true;
const WALK_ANIMATION_DURATION_MS = 1200;

const ACTION_ANTICIPATION_MS = 100;
const ACTION_RECOVERY_MS = 150;

const ACTION_TIMING = {
  waving:       { anticipationMs: 30,  recoveryMs: 60 },
  jumping:      { anticipationMs: 100, recoveryMs: 150 },
  failed:       { anticipationMs: 80,  recoveryMs: 300 },
  review:       { anticipationMs: 80,  recoveryMs: 150 },
  waiting:      { anticipationMs: 0,   recoveryMs: 60 },
  runningRight: { anticipationMs: 40,  recoveryMs: 80 },
  runningLeft:  { anticipationMs: 40,  recoveryMs: 80 },
  grabbedCollar: { anticipationMs: 0, recoveryMs: 60 },
  struggleHang:  { anticipationMs: 0, recoveryMs: 80 },
  grabbedCollarAlt: { anticipationMs: 0, recoveryMs: 60 },
  struggleHangAlt:  { anticipationMs: 0, recoveryMs: 80 },
  dropRecover:   { anticipationMs: 0, recoveryMs: 150 },
  lazySit:       { anticipationMs: 0, recoveryMs: 150 },
  doze:          { anticipationMs: 0, recoveryMs: 150 },
  pokeAnnoyed:   { anticipationMs: 0, recoveryMs: 120 },
  stretch:       { anticipationMs: 0, recoveryMs: 150 },
  headPat:       { anticipationMs: 0, recoveryMs: 140 },
  pokeFuss:      { anticipationMs: 0, recoveryMs: 180 },
  proximityLook: { anticipationMs: 0, recoveryMs: 120 },
  edgePeek:      { anticipationMs: 0, recoveryMs: 160 },
  bottomSit:     { anticipationMs: 0, recoveryMs: 180 },
  sleepWake:     { anticipationMs: 0, recoveryMs: 180 },
  happyNod:      { anticipationMs: 0, recoveryMs: 150 }
};
const JUMP_ANTICIPATION_MS = 120;
const JUMP_RECOVERY_MS = 220;
const FAILED_RECOVERY_MS = 300;
const POST_ACTION_IDLE_DELAY_MS = 1200;
const HOVER_COOLDOWN_MS = 5000;
const ENABLE_SQUASH_EFFECT = true;
const SQUASH_SCALE_X = 1.04;
const SQUASH_SCALE_Y = 0.96;
const SQUASH_DURATION_MS = 120;
const JUMP_SQUASH_SCALE_X = 1.04;
const JUMP_SQUASH_SCALE_Y = 0.96;
const JUMP_SQUASH_DURATION_MS = 120;

const SPEECH_MIN_INTERVAL_MS = 1500;
const ENABLE_HOVER_ATTENTION = false;
const SUPPRESS_CLICK_AFTER_DRAG_MS = 300;
const MENU_ACTION_COOLDOWN_MS = 600;
const DRAG_SPEECH_COOLDOWN_MIN_MS = 8000;
const DRAG_SPEECH_COOLDOWN_MAX_MS = 15000;
const DRAG_ANNOYED_MS = 1200;
const DRAG_ANNOYED_DISTANCE = 220;
const COLLAR_DRAG_A_WEIGHT = 60;
const COLLAR_DRAG_B_WEIGHT = 40;
const COLLAR_GRAB_A_FPS = 6.2;
const COLLAR_STRUGGLE_A_FPS = 5.9;
const COLLAR_GRAB_B_FPS = 6.2;
const COLLAR_STRUGGLE_B_FPS = 6.1;
const COLLAR_GRAB_A_HOLD_LAST_MS = 90;
const COLLAR_GRAB_B_HOLD_LAST_MS = 70;
const COLLAR_GRAB_A_SQUINT_FRAME = 4;
const COLLAR_GRAB_A_SQUINT_HOLD_MS = 260;
const FAILED_HOLD_FRAME = 4;
const FAILED_HOLD_MS = 1000;
const FAILED_SECONDARY_HOLD_FRAME = 5;
const FAILED_SECONDARY_HOLD_MS = 180;
const REVIEW_HOLD_FRAME = 2;
const REVIEW_HOLD_MS = 1000;
const DEBUG_STATE = false;
const DEBUG_SPRITE_SCALE = false;
const SPRITE_ROW_VISIBLE_ALPHA_THRESHOLD = 8;

const PHRASES = {
  greeting: [
    "\u4f60\u603b\u7b97\u6ce8\u610f\u5230\u6211\u4e86\uff1f",
    "\u54fc\uff0c\u8fd9\u624d\u5bf9\u3002",
    "\u627e\u6211\u6709\u4e8b\uff1f",
    "\u522b\u78e8\u8e6d\uff0c\u8bf4\u5427\u3002"
  ],
  headPat: [
    "\u522b\u4e71\u6478\u6211\u5934\u53d1\u3002",
    "\u54fc\u2026\u2026\u53ea\u80fd\u4e00\u4e0b\u3002",
    "\u4f60\u8fd8\u633a\u4f1a\u627e\u5730\u65b9\u7684\u3002",
    "\u522b\u628a\u5934\u53d1\u5f04\u4e71\u4e86\u3002"
  ],
  poke: [
    "\u4f60\u53c8\u6233\u6211\uff1f",
    "\u522b\u4e00\u76f4\u70b9\uff0c\u7b28\u86cb\u3002",
    "\u6211\u542c\u89c1\u4e86\uff0c\u4e0d\u7528\u70b9\u8fd9\u4e48\u591a\u6b21\u3002",
    "\u6709\u4e8b\u5c31\u8bf4\u3002"
  ],
  annoyed: [
    "\u522b\u4e00\u76f4\u6233\u6211\uff0c\u7b28\u86cb\u3002",
    "\u4f60\u5f88\u95f2\u5417\uff1f",
    "\u591f\u4e86\uff0c\u70e6\u6b7b\u4e86\u3002",
    "\u518d\u95f9\u6211\u53ef\u771f\u751f\u6c14\u4e86\u3002"
  ],
  release: [
    "\u4e0b\u6b21\u522b\u6293\u9886\u5b50\u3002",
    "\u5dee\u70b9\u88ab\u4f60\u52d2\u6b7b\u3002",
    "\u4f60\u771f\u662f\u591f\u7c97\u9c81\u7684\u3002",
    "\u54fc\uff0c\u7b97\u4f60\u8bc6\u76f8\u3002"
  ],
  drag: [
    "\u5582\uff01\u522b\u6293\u6211\u540e\u9886\uff01",
    "\u653e\u5f00\u6211\u7684\u9886\u5b50\uff0c\u7b28\u86cb\uff01",
    "\u8c01\u5141\u8bb8\u4f60\u4ece\u540e\u9762\u6293\u6211\u7684\uff1f",
    "\u522b\u62ce\u7740\u6211\u8d70\uff01"
  ],
  lazy: [
    "\u7a0d\u5fae\u4f11\u606f\u4e00\u4e0b\u4e0d\u884c\u5417\uff1f",
    "\u522b\u50ac\uff0c\u6211\u5728\u601d\u8003\u3002",
    "\u6211\u624d\u4e0d\u662f\u5728\u5077\u61d2\u3002"
  ],
  bored: [
    "\u2026\u2026",
    "\u597d\u65e0\u804a\u3002",
    "\u4f60\u5012\u662f\u8bf4\u70b9\u4ec0\u4e48\u554a\u3002"
  ],
  lookAround: ["\u4f60\u8fd9\u684c\u9762\u8fd8\u633a\u4e71\u7684\u3002"],
  impatient: ["\u4f60\u628a\u6211\u53eb\u51fa\u6765\u5c31\u53ea\u662f\u770b\u7740\uff1f"],
  longPress: ["\u6309\u591f\u4e86\u6ca1\u6709\uff1f", "\u4f60\u5230\u5e95\u60f3\u5e72\u561b\uff1f", "\u522b\u4e00\u76f4\u6309\u7740\u6211\u3002"],
  held: ["\u6309\u591f\u4e86\u6ca1\u6709\uff1f", "\u4f60\u5230\u5e95\u60f3\u5e72\u561b\uff1f", "\u522b\u4e00\u76f4\u6309\u7740\u6211\u3002"],
  drop: ["\u5dee\u70b9\u6454\u5230\u4e86\uff01", "\u4f60\u771f\u662f\u591f\u7c97\u9c81\u7684\u3002"],
  lateNight: ["\u90fd\u51e0\u70b9\u4e86\uff0c\u4f60\u8fd8\u4e0d\u7761\uff1f", "\u6211\u8981\u7761\u4e86\uff0c\u522b\u5435\u3002", "\u660e\u5929\u518d\u8bf4\u3002"],
  morning: ["\u65e9\u3002", "\u4f60\u603b\u7b97\u9192\u4e86\uff1f", "\u4eca\u5929\u4e5f\u8981\u52a0\u6cb9\uff0c\u7b28\u86cb\u3002"],
  noon: ["\u4e2d\u5348\u4e86\uff0c\u5148\u5403\u996d\u3002", "\u522b\u7a7a\u7740\u809a\u5b50\u786c\u6491\u3002"],
  afternoon: ["\u4e0b\u5348\u522b\u72af\u56f0\u3002", "\u8fd8\u6709\u4e8b\u6ca1\u505a\u5b8c\u5427\uff1f"],
  evening: ["\u665a\u4e0a\u4e86\uff0c\u5dee\u4e0d\u591a\u6536\u6536\u5fc3\u3002", "\u522b\u628a\u4e8b\u60c5\u90fd\u62d6\u5230\u534a\u591c\u3002"],
  reminder: ["\u5582\uff0c\u65f6\u95f4\u5230\u4e86\u3002", "\u4f60\u8ba9\u6211\u63d0\u9192\u7684\u4e8b\uff0c\u5230\u4e86\u3002"],
  weatherRain: ["\u5916\u9762\u5728\u4e0b\u96e8\u5462\u3002", "\u522b\u5fd8\u4e86\u5e26\u4f1e\u3002"],
  weatherCold: ["\u597d\u51b7\u3002", "\u4f60\u5c31\u4e0d\u80fd\u5f00\u4e2a\u6696\u6c14\uff1f"],
  weatherHot: ["\u70ed\u6b7b\u4e86\u3002", "\u5f00\u7a7a\u8c03\u554a\u3002"],
  weatherSnow: ["\u4e0b\u96ea\u4e86\u3002", "\u5916\u9762\u767d\u832b\u832b\u7684\u3002"],
  weatherClear: ["\u5929\u6c14\u4e0d\u9519\u3002", "\u9002\u5408\u51fa\u95e8\u8d70\u8d70\u3002"],
  resourcePressure: ["电脑有点吃紧，先少开几个东西。", "占用太高了，你又在跑什么？", "我都感觉桌面变重了。"]
};

let speechBubbleEnabled = true;
let lastSpeechAt = 0;
let chatBubbleOpen = false;
let nightMultiplier = 1;

// Emotion system
let mood = 0;      // -100 (annoyed) to 100 (happy)
let energy = 50;   // 0 (bored/tired) to 100 (energetic)
let lastInteractionAt = Date.now();

const EMOTION_DECAY_RATE = 0.5;         // mood drifts toward 0 per minute
const ENERGY_DECAY_RATE = 0.3;          // energy drifts toward 50 per minute
const BOREDOM_THRESHOLD_MS = 120000;    // 2 min no interaction → bored

function pickPhrase(category) {
  const pool = PHRASES[category];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function showSpeech(category) {
  if (!speechBubbleEnabled) return;
  if (chatBubbleOpen) {
    debugLog("chat calm mode blocked: speech");
    return;
  }
  const now = Date.now();
  if (now - lastSpeechAt < SPEECH_MIN_INTERVAL_MS) return;
  const text = pickPhrase(category);
  if (!text) return;
  lastSpeechAt = now;
  ipcRenderer.send("show-speech-bubble", text);
}

function clampEmotion(value, min = -100, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function updateEmotion(dmood, denergy) {
  mood = clampEmotion(mood + dmood);
  energy = clampEmotion(energy + denergy, 0, 100);
  lastInteractionAt = Date.now();
}

function decayEmotion() {
  const elapsedMin = (Date.now() - lastInteractionAt) / 60000;
  // Mood drifts toward 0
  if (mood > 0) mood = Math.max(0, mood - EMOTION_DECAY_RATE * elapsedMin);
  else if (mood < 0) mood = Math.min(0, mood + EMOTION_DECAY_RATE * elapsedMin);
  // Energy drifts toward 50
  energy = energy + (50 - energy) * Math.min(1, ENERGY_DECAY_RATE * elapsedMin / 50);
  // Boredom: if no interaction for a while, lower energy
  if (elapsedMin > 2) {
    energy = Math.max(0, energy - 0.5 * elapsedMin);
  }
}

function getEmotionCategory() {
  decayEmotion();
  if (mood >= 40) return "happy";
  if (mood <= -40) return "annoyed";
  if (energy <= 25) return "bored";
  return "neutral";
}

function selectEmotionPhrase(category) {
  const emotion = getEmotionCategory();
  const pool = PHRASES[category];
  if (!pool || pool.length === 0) return null;
  // Simple: just pick randomly. Emotion affects which categories are chosen, not individual phrases.
  return pool[Math.floor(Math.random() * pool.length)];
}

function getEmotionRandomIdleMultiplier() {
  // Lower energy → longer idle intervals (less active)
  if (energy <= 20) return 1.8;
  if (energy <= 40) return 1.3;
  if (energy >= 80) return 0.7;
  return 1;
}

function applyEmotionToSettings(emotionData) {
  if (emotionData) {
    mood = clampEmotion(Number(emotionData.mood) || 0);
    energy = clampEmotion(Number(emotionData.energy) || 50, 0, 100);
  }
}

function getEmotionData() {
  return { mood: Math.round(mood), energy: Math.round(energy) };
}

function enterCalmModeForChat() {
  chatBubbleOpen = true;
  ipcRenderer.send("close-speech-bubble");
  resetSpriteTransform();
  clearTimeout(randomIdleTimer);
  randomIdleTimer = null;
  clearTimeout(randomWalkTimer);
  randomWalkTimer = null;
  setNeutralIdle({ ambientDelayMs: 0 });
}

function exitCalmModeForChat() {
  chatBubbleOpen = false;
  setNeutralIdle();
}

document.documentElement.style.setProperty("--pet-scale", DEFAULT_PET_SCALE);

const animations = {
  idle: { row: 0, frames: 6, fps: 3 },
  runningRight: { row: 1, frames: 8, fps: 9 },
  runningLeft: { row: 2, frames: 8, fps: 9 },
  waving: { row: 3, frames: 7, fps: 6.2, holdLastMs: 180, frameSequence: [0, 1, 2, 3, 2, 3, 1] },
  jumping: { row: 4, frames: 5, fps: 7, holdLastMs: 120 },
  failed: {
    row: 5,
    frames: 8,
    fps: 6,
    holdLastMs: 180,
    frameHoldMs: {
      [FAILED_HOLD_FRAME]: FAILED_HOLD_MS,
      [FAILED_SECONDARY_HOLD_FRAME]: FAILED_SECONDARY_HOLD_MS
    }
  },
  waiting: { row: 6, frames: 6, fps: 4, holdLastMs: 180 },
  running: { row: 7, frames: 6, fps: 9 },
  review: {
    row: 8,
    frames: 5,
    fps: 4.5,
    holdLastMs: 180,
    frameHoldMs: { [REVIEW_HOLD_FRAME]: REVIEW_HOLD_MS }
  },
  grabbedCollar: {
    row: 9,
    frames: 6,
    fps: COLLAR_GRAB_A_FPS,
    holdLastMs: COLLAR_GRAB_A_HOLD_LAST_MS,
    frameHoldMs: { [COLLAR_GRAB_A_SQUINT_FRAME]: COLLAR_GRAB_A_SQUINT_HOLD_MS },
    fallback: "waiting"
  },
  struggleHang: { row: 10, frames: 8, fps: COLLAR_STRUGGLE_A_FPS, fallback: "waiting" },
  grabbedCollarAlt: {
    row: 11,
    frames: 6,
    fps: COLLAR_GRAB_B_FPS,
    holdLastMs: COLLAR_GRAB_B_HOLD_LAST_MS,
    fallback: "grabbedCollar"
  },
  struggleHangAlt: { row: 12, frames: 8, fps: COLLAR_STRUGGLE_B_FPS, fallback: "struggleHang" },
  dropRecover: { row: -1, frames: 6, fps: 7, holdLastMs: 80, fallback: "failed" },
  lazySit: { row: -1, frames: 6, fps: 5, holdLastMs: 180, fallback: "lazyIdle" },
  doze: { row: -1, frames: 6, fps: 2.5, holdLastMs: 180, fallback: "dozeIdle" },
  pokeAnnoyed: { row: -1, frames: 4, fps: 6.25, holdLastMs: 140, fallback: "failed" },
  stretch: { row: -1, frames: 6, fps: 5.5, holdLastMs: 160, fallback: "stretchIdle" },
  headPat: { row: 16, frames: 8, fps: 5.5, holdLastMs: 180, fallback: "idle" },
  pokeFuss: { row: 17, frames: 8, fps: 6, holdLastMs: 220, fallback: "pokeAnnoyed" },
  proximityLook: { row: 18, frames: 8, fps: 4.5, holdLastMs: 260, fallback: "idle" },
  edgePeek: { row: 19, frames: 8, fps: 5, holdLastMs: 220, fallback: "waiting" },
  bottomSit: { row: 20, frames: 8, fps: 4, holdLastMs: 500, fallback: "lazySit" },
  sleepWake: { row: 21, frames: 8, fps: 3, holdLastMs: 240, fallback: "doze" },
  happyNod: { row: 22, frames: 8, fps: 5, holdLastMs: 240, fallback: "review" }
};

const ACTION_VISUAL_SCALE = {
  idle: 0.97,
  runningRight: 0.98,
  runningLeft: 0.98,
  waving: 0.97,
  jumping: 1.00,
  failed: 1.00,
  waiting: 1.00,
  running: 1.00,
  review: 1.00,
  grabbedCollar: 1.04,
  struggleHang: 1.04,
  grabbedCollarAlt: 1.04,
  struggleHangAlt: 1.04,
  dropRecover: 1.04,
  lazySit: 1.04,
  doze: 1.04,
  pokeAnnoyed: 1.04,
  stretch: 1.04,
  headPat: 1.04,
  pokeFuss: 1.04,
  proximityLook: 1.04,
  edgePeek: 1.04,
  bottomSit: 1.04,
  sleepWake: 1.04,
  happyNod: 1.04
};

const priority = {
  idle: 0,
  randomIdle: 10,
  hover: 20,
  singleClick: 40,
  failed: 50,
  jump: 60,
  menuAction: 70,
  chatAction: 80,
  drag: 100
};

const pet = document.getElementById("pet");
const resourceDock = document.getElementById("resource-dock");
const resourceToggle = document.getElementById("resource-toggle");
const resourceSummary = document.getElementById("resource-summary");
const resourceEls = {
  cpu: {
    label: document.querySelector("#resource-cpu")?.parentElement?.querySelector("span"),
    value: document.getElementById("resource-cpu"),
    bar: document.getElementById("resource-cpu-bar")
  },
  mem: {
    label: document.querySelector("#resource-mem")?.parentElement?.querySelector("span"),
    value: document.getElementById("resource-mem"),
    bar: document.getElementById("resource-mem-bar")
  },
  disk: {
    label: document.querySelector("#resource-disk")?.parentElement?.querySelector("span"),
    value: document.getElementById("resource-disk"),
    bar: document.getElementById("resource-disk-bar")
  },
  gpu: {
    label: document.querySelector("#resource-gpu")?.parentElement?.querySelector("span"),
    value: document.getElementById("resource-gpu"),
    bar: document.getElementById("resource-gpu-bar")
  }
};

let active = { name: "idle", priority: priority.idle };
let animationTimer = null;
let actionEndTimer = null;
let idleBlinkTimer = null;
let randomIdleTimer = null;
let randomWalkTimer = null;
let clickTimer = null;
let dblClickTimer = null;
let longPressTimer = null;
let squashTimer = null;
let transformTimer = null;
let dragStruggleTimer = null;
let hoverReadyAt = 0;
let nextAmbientAllowedAt = 0;
let lastMenuActionAt = 0;
let nextDragSpeechAllowedAt = 0;
let recentClicks = [];
let recentHeadClicks = [];
let availableSpriteRows = DEFAULT_SPRITE_ROWS;
let spriteRowHasContent = null;
const missingAnimationWarnings = new Set();
let petScale = DEFAULT_PET_SCALE;
let currentVisualScale = ACTION_VISUAL_SCALE.idle;
let currentVisualAction = "idle";
let currentSpriteTransform = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
let randomWalkEnabled = ENABLE_RANDOM_WALK_DEFAULT;
let randomIdleEnabled = false;
let quietMode = false;
let resourceDockEnabled = true;
let resourceDockExpanded = false;
let resourceGpuEnabled = true;
let resourceBubbleShowPercent = true;
let resourcePressureSpeechEnabled = true;
let resourceBubbleSize = "small";
let resourceBubbleOpacity = "medium";
let resourceBubblePosition = "bottom-right";
let resourceBubbleCustomPosition = null;
let resourceTimer = null;
let lastCpuSnapshot = getCpuSnapshot();
let resourcePressureSpeechAt = 0;
let lastGpuPercent = null;
let lastGpuMemoryPercent = null;
let lastGpuLabel = "gpu";
let lastGpuName = "";
let lastGpuSampleAt = 0;
let gpuRequestInFlight = false;
const resourceValues = { cpu: null, mem: null, disk: null, gpu: null };
const RESOURCE_BUBBLE_SIZE_PX = { tiny: 22, small: 26, normal: 32 };
const RESOURCE_BUBBLE_OPACITY = { low: 0.45, medium: 0.72, high: 0.92 };
const RESOURCE_BUBBLE_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"];
let resourceBubblePointerDown = false;
let resourceBubbleDragging = false;
let resourceBubbleDragStart = null;
let resourceBubbleClickSuppressUntil = 0;

let pointerDown = false;
let dragging = false;
let didDrag = false;
let suppressNextClick = false;
let suppressClickUntil = 0;
let blockIdleUntil = 0;
let dragStart = { x: 0, y: 0 };
let dragStartedAt = 0;
let dragMaxDistance = 0;
let activeDragSet = null;

function getCpuSnapshot() {
  const cpus = os.cpus();
  return cpus.reduce((snapshot, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    snapshot.idle += cpu.times.idle;
    snapshot.total += total;
    return snapshot;
  }, { idle: 0, total: 0 });
}

function getCpuPercent() {
  const next = getCpuSnapshot();
  const idleDelta = next.idle - lastCpuSnapshot.idle;
  const totalDelta = next.total - lastCpuSnapshot.total;
  lastCpuSnapshot = next;
  if (totalDelta <= 0) return null;
  return clampPercent(100 - (idleDelta / totalDelta) * 100);
}

function getMemoryPercent() {
  const total = os.totalmem();
  if (!total) return null;
  return clampPercent(((total - os.freemem()) / total) * 100);
}

function getDiskPercent() {
  try {
    const stat = fs.statfsSync(DISK_ROOT);
    const total = Number(stat.blocks) * Number(stat.bsize);
    const free = Number(stat.bfree) * Number(stat.bsize);
    if (!total) return null;
    return clampPercent(((total - free) / total) * 100);
  } catch (_error) {
    return null;
  }
}

function getGpuStats() {
  if (process.platform !== "win32") {
    return Promise.resolve({ percent: null, memoryPercent: null, label: "gpu", name: "" });
  }

  const script = [
    "$util = $null",
    "try { $util = [math]::Round(((Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -ErrorAction Stop).CounterSamples | Measure-Object -Property CookedValue -Sum).Sum, 0) } catch {}",
    "$controllers = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name })",
    "$names = @($controllers | ForEach-Object { $_.Name })",
    "$nameText = ($names -join ' / ')",
    "$type = if ($nameText -match 'NVIDIA|GeForce|RTX|GTX|AMD|Radeon|RX ') { 'dgpu' } elseif ($nameText -match 'Intel|Iris|UHD') { 'igpu' } else { 'gpu' }",
    "$memory = $null",
    "try {",
    "  $usage = ((Get-Counter '\\GPU Adapter Memory(*)\\Dedicated Usage' -ErrorAction Stop).CounterSamples | Measure-Object -Property CookedValue -Sum).Sum",
    "  $total = (($controllers | Where-Object { $_.AdapterRAM -gt 0 } | Measure-Object -Property AdapterRAM -Sum).Sum)",
    "  if ($usage -ge 0 -and $total -gt 0) { $memory = [math]::Round(($usage / $total) * 100, 0) }",
    "} catch {}",
    "[pscustomobject]@{ percent=$util; memoryPercent=$memory; label=$type; name=$nameText } | ConvertTo-Json -Compress"
  ].join("; ");

  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NoLogo", "-Command", script],
      { encoding: "utf8", timeout: GPU_COUNTER_TIMEOUT_MS, windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve({ percent: null, memoryPercent: null, label: "gpu", name: "" });
          return;
        }

        try {
          const data = JSON.parse(String(stdout).trim());
          const percent = Number(data?.percent);
          const memoryPercent = Number(data?.memoryPercent);
          resolve({
            percent: Number.isFinite(percent) ? clampPercent(percent) : null,
            memoryPercent: Number.isFinite(memoryPercent) ? clampPercent(memoryPercent) : null,
            label: typeof data?.label === "string" && data.label ? data.label : "gpu",
            name: typeof data?.name === "string" ? data.name : ""
          });
        } catch {
          resolve({ percent: null, memoryPercent: null, label: "gpu", name: "" });
        }
      }
    );
  });
}

function refreshGpuPercent(force = false) {
  if (!resourceGpuEnabled) {
    lastGpuPercent = null;
    lastGpuMemoryPercent = null;
    lastGpuLabel = "gpu";
    lastGpuName = "";
    setResourceMetric("gpu", null);
    updateResourceSummary();
    return;
  }

  const now = Date.now();
  const interval = resourceDockExpanded ? GPU_UPDATE_MS_EXPANDED : GPU_UPDATE_MS_COLLAPSED;
  if (gpuRequestInFlight) return;
  if (!force && now - lastGpuSampleAt < interval) return;

  gpuRequestInFlight = true;
  getGpuStats()
    .then((stats) => {
      lastGpuPercent = stats.percent;
      lastGpuMemoryPercent = stats.memoryPercent;
      lastGpuLabel = stats.label;
      lastGpuName = stats.name;
      lastGpuSampleAt = Date.now();
      setResourceMetric("gpu", lastGpuPercent);
      updateResourceSummary();
    })
    .finally(() => {
      gpuRequestInFlight = false;
    });
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resourceColor(value) {
  if (value == null) return "#64748b";
  if (value >= 90) return "#f87171";
  if (value >= 75) return "#fbbf24";
  return "#58c3a5";
}

function setResourceMetric(metric, value) {
  const target = resourceEls[metric];
  if (!target?.value || !target?.bar) return;
  const percent = value == null ? 0 : value;
  resourceValues[metric] = value;
  if (metric === "gpu") {
    const gpuLabelMap = { dgpu: "独显", igpu: "核显", gpu: "GPU" };
    const labelText = gpuLabelMap[lastGpuLabel] ?? "GPU";
    const memoryText = lastGpuMemoryPercent == null ? "" : `/${lastGpuMemoryPercent}%`;
    if (target.label) target.label.textContent = labelText;
    target.value.textContent = value == null ? "静默" : `${value}%${memoryText}`;
    target.value.title = [
      lastGpuName || "GPU",
      value == null ? "利用率未读取" : `利用率 ${value}%`,
      lastGpuMemoryPercent == null ? null : `显存 ${lastGpuMemoryPercent}%`
    ].filter(Boolean).join(" · ");
  } else {
    target.value.textContent = value == null ? "--%" : `${value}%`;
  }
  target.bar.style.setProperty("--bar-value", `${percent}%`);
  target.bar.style.setProperty("--bar-color", resourceColor(value));
}

function getResourcePressure() {
  return Math.max(
    resourceValues.cpu ?? 0,
    resourceValues.mem ?? 0,
    resourceValues.disk ?? 0,
    resourceValues.gpu ?? 0
  );
}

function updateResourceSummary() {
  if (!resourceSummary || !resourceToggle) return;
  const pressure = getResourcePressure();
  resourceSummary.textContent = resourceBubbleShowPercent
    ? (pressure > 0 ? `${pressure}%` : "--%")
    : "";
  resourceToggle.style.setProperty("--bar-color", resourceColor(pressure > 0 ? pressure : null));
  resourceToggle.style.setProperty("--bubble-fill", `${pressure}%`);
}

function clampResourceBubblePosition(position) {
  if (!resourceDock || !position) return null;
  const parent = resourceDock.offsetParent || resourceDock.parentElement;
  if (!parent) return null;
  const fallbackSize = RESOURCE_BUBBLE_SIZE_PX[resourceBubbleSize] ?? RESOURCE_BUBBLE_SIZE_PX.small;
  const width = resourceDock.offsetWidth || fallbackSize;
  const height = resourceDock.offsetHeight || fallbackSize;
  const maxX = Math.max(0, parent.clientWidth - width);
  const maxY = Math.max(0, parent.clientHeight - height);
  return {
    x: Math.round(Math.max(0, Math.min(maxX, position.x))),
    y: Math.round(Math.max(0, Math.min(maxY, position.y)))
  };
}

function applyResourceBubbleCustomPosition() {
  if (!resourceDock) return;
  const customPosition = resourceBubbleCustomPosition ? clampResourceBubblePosition(resourceBubbleCustomPosition) : null;
  resourceDock.classList.toggle("position-custom", Boolean(customPosition));
  if (customPosition) {
    resourceDock.style.setProperty("--resource-bubble-x", `${customPosition.x}px`);
    resourceDock.style.setProperty("--resource-bubble-y", `${customPosition.y}px`);
  } else {
    resourceDock.style.removeProperty("--resource-bubble-x");
    resourceDock.style.removeProperty("--resource-bubble-y");
  }
}

function getResourceBubbleCurrentPosition() {
  if (!resourceDock) return null;
  const parent = resourceDock.offsetParent || resourceDock.parentElement;
  if (!parent) return null;
  const dockRect = resourceDock.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  return clampResourceBubblePosition({
    x: dockRect.left - parentRect.left,
    y: dockRect.top - parentRect.top
  });
}

function applyResourceBubbleSettings() {
  const size = RESOURCE_BUBBLE_SIZE_PX[resourceBubbleSize] ?? RESOURCE_BUBBLE_SIZE_PX.small;
  const opacity = RESOURCE_BUBBLE_OPACITY[resourceBubbleOpacity] ?? RESOURCE_BUBBLE_OPACITY.medium;
  document.documentElement.style.setProperty("--resource-bubble-size", `${size}px`);
  document.documentElement.style.setProperty("--resource-bubble-opacity", String(opacity));
  resourceDock?.classList.toggle("hide-percent", !resourceBubbleShowPercent);
  for (const position of RESOURCE_BUBBLE_POSITIONS) {
    resourceDock?.classList.toggle(`position-${position}`, position === resourceBubblePosition);
  }
  applyResourceBubbleCustomPosition();
}

function syncResourceDockLayout() {
  if (!resourceDock) return;
  resourceDock.classList.toggle("is-collapsed", !resourceDockExpanded);
  resourceDock.classList.toggle("is-expanded", resourceDockExpanded);
  applyResourceBubbleCustomPosition();
  resourceToggle?.setAttribute("aria-expanded", String(resourceDockExpanded));
  resourceToggle?.setAttribute("title", resourceDockExpanded ? "收起资源占用" : "展开资源占用");
}

function updateResourceDock() {
  if (!resourceDockEnabled) return;

  const cpu = getCpuPercent();
  const mem = getMemoryPercent();
  const disk = getDiskPercent();

  // Always update internal values for pressure calculation
  resourceValues.cpu = cpu;
  resourceValues.mem = mem;
  resourceValues.disk = disk;

  // Only update DOM bars when expanded (skip expensive DOM writes when collapsed)
  if (resourceDockExpanded) {
    setResourceMetric("cpu", cpu);
    setResourceMetric("mem", mem);
    setResourceMetric("disk", disk);
    setResourceMetric("gpu", lastGpuPercent);
    refreshGpuPercent();
  } else {
    // Collapsed: only refresh GPU on its own slower schedule
    refreshGpuPercent();
  }

  updateResourceSummary();

  const pressure = getResourcePressure();
  if (resourcePressureSpeechEnabled && pressure >= RESOURCE_PRESSURE_THRESHOLD) {
    mood = clampEmotion(mood - 1);
    energy = clampEmotion(energy - 1, 0, 100);
    if (Date.now() - resourcePressureSpeechAt > 30000) {
      resourcePressureSpeechAt = Date.now();
      showSpeech("resourcePressure");
    }
  }
}

function scheduleResourceUpdate() {
  if (resourceTimer) {
    clearInterval(resourceTimer);
    resourceTimer = null;
  }
  const interval = resourceDockExpanded ? RESOURCE_UPDATE_MS : RESOURCE_UPDATE_MS_COLLAPSED;
  resourceTimer = setInterval(() => {
    updateResourceDock();
    // Re-schedule with potentially different interval if expanded state changed
    const expectedInterval = resourceDockExpanded ? RESOURCE_UPDATE_MS : RESOURCE_UPDATE_MS_COLLAPSED;
    if (expectedInterval !== interval) {
      scheduleResourceUpdate();
    }
  }, interval);
}

function syncResourceDock() {
  if (!resourceDock) return;
  if (!resourceDockEnabled) resourceDockExpanded = false;
  resourceDock.classList.toggle("is-hidden", !resourceDockEnabled);
  syncResourceDockLayout();
  if (resourceDockEnabled && !resourceTimer) {
    lastCpuSnapshot = getCpuSnapshot();
    updateResourceDock();
    scheduleResourceUpdate();
  } else if (!resourceDockEnabled && resourceTimer) {
    clearInterval(resourceTimer);
    resourceTimer = null;
  }
}

function getResourceBubbleLocalPosition(event) {
  if (!resourceDock) return null;
  const parent = resourceDock.offsetParent || resourceDock.parentElement;
  if (!parent) return null;
  const parentRect = parent.getBoundingClientRect();
  const size = RESOURCE_BUBBLE_SIZE_PX[resourceBubbleSize] ?? RESOURCE_BUBBLE_SIZE_PX.small;
  return clampResourceBubblePosition({
    x: event.clientX - parentRect.left - size / 2,
    y: event.clientY - parentRect.top - size / 2
  });
}

function saveResourceBubbleCustomPosition() {
  if (!resourceBubbleCustomPosition) return;
  ipcRenderer.invoke("update-settings", {
    resourceBubbleCustomPosition
  }).then((nextSettings) => {
    resourceBubbleCustomPosition = nextSettings?.resourceBubbleCustomPosition ?? resourceBubbleCustomPosition;
    applyResourceBubbleCustomPosition();
  }).catch(() => {});
}

resourceDock?.addEventListener("pointerenter", () => {
  resourceDock.classList.add("is-hovered");
});

resourceDock?.addEventListener("pointerleave", () => {
  resourceDock.classList.remove("is-hovered");
});

resourceToggle?.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || resourceDockExpanded || !resourceDockEnabled) return;
  event.stopPropagation();
  resourceBubblePointerDown = true;
  resourceBubbleDragging = false;
  const startPosition = getResourceBubbleCurrentPosition() || getResourceBubbleLocalPosition(event);
  resourceBubbleDragStart = {
    screenX: event.screenX,
    screenY: event.screenY,
    x: startPosition?.x ?? 0,
    y: startPosition?.y ?? 0
  };
  try {
    resourceToggle.setPointerCapture(event.pointerId);
  } catch {}
});

resourceToggle?.addEventListener("pointermove", (event) => {
  if (!resourceBubblePointerDown || resourceDockExpanded || !resourceBubbleDragStart) return;
  const dx = event.screenX - resourceBubbleDragStart.screenX;
  const dy = event.screenY - resourceBubbleDragStart.screenY;
  const distance = Math.hypot(dx, dy);
  if (!resourceBubbleDragging && distance < RESOURCE_BUBBLE_DRAG_THRESHOLD_PX) return;
  event.preventDefault();
  event.stopPropagation();
  resourceBubbleDragging = true;
  resourceBubbleCustomPosition = clampResourceBubblePosition({
    x: resourceBubbleDragStart.x + dx,
    y: resourceBubbleDragStart.y + dy
  });
  applyResourceBubbleCustomPosition();
});

resourceToggle?.addEventListener("pointerup", (event) => {
  if (!resourceBubblePointerDown) return;
  resourceBubblePointerDown = false;
  try {
    resourceToggle.releasePointerCapture(event.pointerId);
  } catch {}
  if (resourceBubbleDragging) {
    event.preventDefault();
    event.stopPropagation();
    resourceBubbleClickSuppressUntil = Date.now() + RESOURCE_BUBBLE_CLICK_SUPPRESS_MS;
    resourceBubbleDragging = false;
    saveResourceBubbleCustomPosition();
  }
  resourceBubbleDragStart = null;
});

resourceToggle?.addEventListener("pointercancel", () => {
  resourceBubblePointerDown = false;
  resourceBubbleDragging = false;
  resourceBubbleDragStart = null;
});

resourceToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (Date.now() < resourceBubbleClickSuppressUntil) {
    event.preventDefault();
    return;
  }
  resourceDockExpanded = !resourceDockExpanded;
  syncResourceDockLayout();
  scheduleResourceUpdate();
  ipcRenderer.send("resource-dock-expanded-change", resourceDockExpanded);
  if (resourceDockExpanded) {
    refreshGpuPercent(true);
    updateResourceDock();
  }
});

function debugLog(...args) {
  if (DEBUG_STATE) console.log("[pet]", ...args);
}

function updateSpriteSheetBackgroundSize() {
  pet.style.backgroundSize = `${CELL_WIDTH * SPRITE_COLUMNS * petScale}px ${CELL_HEIGHT * availableSpriteRows * petScale}px`;
}

function animationNameForRow(row) {
  const match = Object.entries(animations).find(([, animation]) => (
    animation.row === row || (Array.isArray(animation.rows) && animation.rows.includes(row))
  ));
  return match ? match[0] : "idle";
}

function getVisualScale(actionName) {
  return ACTION_VISUAL_SCALE[actionName] ?? ACTION_VISUAL_SCALE[animationNameForRow(animations[actionName]?.row)] ?? 1;
}

function setTransformTransitionEnabled(enabled) {
  pet.classList.toggle("no-transform-transition", !enabled);
}

function applySpriteTransform() {
  const x = currentSpriteTransform.x;
  const y = currentSpriteTransform.y;
  const rotate = currentSpriteTransform.rotate;
  const scaleX = currentSpriteTransform.scaleX * currentVisualScale;
  const scaleY = currentSpriteTransform.scaleY * currentVisualScale;

  pet.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`;

  if (DEBUG_SPRITE_SCALE) {
    console.log("[pet-scale]", {
      currentAction: active.name,
      visualAction: currentVisualAction,
      transform: pet.style.transform,
      visualScale: currentVisualScale,
      spriteSheetRows: availableSpriteRows,
      backgroundSize: pet.style.backgroundSize
    });
  }
}

function setVisualAction(actionName) {
  currentVisualAction = actionName || "idle";
  currentVisualScale = getVisualScale(currentVisualAction);
  applySpriteTransform();
}

function loadSpriteSheetMetrics() {
  const image = new Image();
  image.onload = () => {
    const rows = Math.floor(image.naturalHeight / CELL_HEIGHT);
    availableSpriteRows = Math.max(DEFAULT_SPRITE_ROWS, rows || DEFAULT_SPRITE_ROWS);
    spriteRowHasContent = detectSpriteRowContent(image, availableSpriteRows);
    updateSpriteSheetBackgroundSize();
  };
  image.onerror = () => {
    availableSpriteRows = DEFAULT_SPRITE_ROWS;
    spriteRowHasContent = null;
    updateSpriteSheetBackgroundSize();
  };
  image.src = "pet-spritesheet.png";
}

function detectSpriteRowContent(image, rowCount) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0);
    const rowHasContent = [];

    for (let row = 0; row < rowCount; row += 1) {
      const y = row * CELL_HEIGHT;
      const height = Math.min(CELL_HEIGHT, image.naturalHeight - y);
      const data = context.getImageData(0, y, image.naturalWidth, height).data;
      let hasContent = false;

      for (let index = 3; index < data.length; index += 4) {
        if (data[index] > SPRITE_ROW_VISIBLE_ALPHA_THRESHOLD) {
          hasContent = true;
          break;
        }
      }

      rowHasContent[row] = hasContent;
    }

    return rowHasContent;
  } catch (error) {
    console.warn("[pet] Could not inspect sprite row alpha; falling back to height-based row detection.", error);
    return null;
  }
}

function hasAnimationRow(rowIndex) {
  if (!Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= availableSpriteRows) {
    return false;
  }

  if (spriteRowHasContent && spriteRowHasContent[rowIndex] === false) {
    return false;
  }

  return true;
}

function canUseAnimation(name) {
  const animation = animations[name];
  if (!animation) return false;
  if (Array.isArray(animation.rows)) {
    const missingRow = animation.rows.find((row) => !hasAnimationRow(row));
    if (missingRow === undefined) return true;

    if (!missingAnimationWarnings.has(name)) {
      missingAnimationWarnings.add(name);
      console.warn(`[pet] Missing sprite row ${missingRow} for ${name}; using fallback.`);
    }
    return false;
  }
  if (animation.row < 0) return false;
  if (hasAnimationRow(animation.row)) return true;

  if (!missingAnimationWarnings.has(name)) {
    missingAnimationWarnings.add(name);
    console.warn(`[pet] Missing sprite row ${animation.row} for ${name}; using fallback.`);
  }
  return false;
}

function getAnimationFrameStep(animation, frame) {
  const frameColumn = animation.frameSequence?.[frame] ?? frame;

  if (Array.isArray(animation.rows)) {
    const rowIndex = Math.floor(frameColumn / SPRITE_COLUMNS);
    return {
      row: animation.rows[Math.min(rowIndex, animation.rows.length - 1)],
      frame: frameColumn % SPRITE_COLUMNS
    };
  }

  return { row: animation.row, frame: frameColumn };
}

function getActionOrFallback(actionName) {
  if (canUseAnimation(actionName)) return actionName;
  return animations[actionName]?.fallback ?? null;
}

function setFrame(row, column, actionName = null) {
  const x = column * CELL_WIDTH * petScale;
  const y = row * CELL_HEIGHT * petScale;
  setVisualAction(actionName ?? animationNameForRow(row));
  pet.style.backgroundPosition = `-${x.toFixed(3)}px -${y.toFixed(3)}px`;

  if (DEBUG_SPRITE_SCALE) {
    console.log("[pet-frame]", {
      currentAction: active.name,
      row,
      frame: column,
      visualAction: currentVisualAction,
      visualScale: currentVisualScale,
      spriteSheetRows: availableSpriteRows,
      backgroundSize: pet.style.backgroundSize
    });
  }
}

function frameDelay(animation) {
  return Math.round(1000 / animation.fps);
}

function frameDelayFor(animation, frameIndex) {
  return animation.frameHoldMs?.[frameIndex] ?? frameDelay(animation);
}

function canStart(nextPriority) {
  // hover never interrupts anything
  if (nextPriority === priority.hover) return false;
  // randomIdle never interrupts manual actions
  if (nextPriority === priority.randomIdle && active.priority > priority.idle) return false;
  // Any direct user action should feel immediate, even if another animation is playing.
  if (nextPriority >= priority.singleClick) return true;

  return active.priority === priority.idle || nextPriority > active.priority;
}

function startAction(name, nextPriority) {
  if (!canStart(nextPriority)) {
    debugLog("blocked:", name, "priority:", nextPriority, "active:", active.name, active.priority);
    return false;
  }

  debugLog("start:", name, "priority:", nextPriority);
  setTransformTransitionEnabled(nextPriority !== priority.drag);
  if (nextPriority !== priority.drag) resetSpriteTransform();
  active = { name, priority: nextPriority };
  clearTimeout(animationTimer);
  clearTimeout(actionEndTimer);
  clearAmbientTimers();
  return true;
}

function clearAmbientTimers() {
  clearTimeout(idleBlinkTimer);
  clearTimeout(randomIdleTimer);
  clearTimeout(randomWalkTimer);
}

function clearPointerTimers() {
  clearTimeout(clickTimer);
  clearTimeout(dblClickTimer);
  clearTimeout(longPressTimer);
}

function clearInteractionTimers() {
  clearTimeout(longPressTimer);
  clearTimeout(dragStruggleTimer);
  dragStruggleTimer = null;
  clearTimeout(randomIdleTimer);
  randomIdleTimer = null;
  clearTimeout(randomWalkTimer);
  randomWalkTimer = null;
}

function neutralFrame() {
  if (TRANSITION_RESET_TO_NEUTRAL) setFrame(animations.idle.row, 0, "idle");
}

function setSpriteTransform({ x = 0, y = 0, rotate = 0, scaleX = 1, scaleY = 1 } = {}) {
  currentSpriteTransform = { x, y, rotate, scaleX, scaleY };
  applySpriteTransform();
}

function resetSpriteTransform() {
  clearTimeout(transformTimer);
  clearTimeout(squashTimer);
  transformTimer = null;
  squashTimer = null;
  pet.classList.remove("is-squashing");
  pet.style.transformOrigin = "50% 50%";
  pet.style.setProperty("--sprite-transform-duration", "100ms");
  setSpriteTransform();
}

function animateSpriteTransform(steps, loop = false) {
  clearTimeout(transformTimer);
  let index = 0;

  function next() {
    if (index >= steps.length) {
      if (!loop) return;
      index = 0;
    }

    const step = steps[index];
    setSpriteTransform(step);
    index += 1;
    transformTimer = setTimeout(next, step.duration ?? 140);
  }

  next();
}

function getAnticipationMs(name) {
  if (name === "idle") return 0;
  const timing = ACTION_TIMING[name];
  if (timing) return timing.anticipationMs;
  return ACTION_ANTICIPATION_MS;
}

function getRecoveryMs(name) {
  if (name === "idle") return ACTION_RECOVERY_MS;
  const timing = ACTION_TIMING[name];
  if (timing) return timing.recoveryMs;
  return ACTION_RECOVERY_MS;
}

function applySquash(options = {}) {
  if (!ENABLE_SQUASH_EFFECT) return;

  const scaleX = options.scaleX ?? SQUASH_SCALE_X;
  const scaleY = options.scaleY ?? SQUASH_SCALE_Y;
  const duration = options.durationMs ?? SQUASH_DURATION_MS;

  clearTimeout(squashTimer);
  pet.style.setProperty("--squash-scale-x", scaleX);
  pet.style.setProperty("--squash-scale-y", scaleY);
  pet.style.setProperty("--squash-duration", `${duration}ms`);
  pet.style.setProperty("--sprite-transform-duration", `${duration}ms`);
  setSpriteTransform({ scaleX, scaleY });
  squashTimer = setTimeout(() => {
    pet.style.setProperty("--sprite-transform-duration", "100ms");
    setSpriteTransform();
  }, duration);
}

function setNeutralIdle(options = {}) {
  debugLog("setNeutralIdle");
  setTransformTransitionEnabled(true);
  active = { name: "idle", priority: priority.idle };
  clearTimeout(animationTimer);
  clearTimeout(actionEndTimer);
  clearAmbientTimers();
  resetSpriteTransform();
  neutralFrame();
  const delay = Math.max(options.ambientDelayMs ?? 0, Math.max(0, nextAmbientAllowedAt - Date.now()), Math.max(0, blockIdleUntil - Date.now()));
  scheduleIdleBlink(delay);
  if (!chatBubbleOpen && randomIdleEnabled && !quietMode && !dragging && Date.now() >= blockIdleUntil) {
    scheduleRandomIdle(delay);
  }
  if (!chatBubbleOpen && randomWalkEnabled && !quietMode && !dragging) {
    scheduleRandomWalk(delay);
  }
}

function finishAction(recoveryMs = ACTION_RECOVERY_MS, options = {}) {
  debugLog("finish:", active.name);
  clearTimeout(animationTimer);
  clearTimeout(actionEndTimer);
  resetSpriteTransform();
  neutralFrame();

  if (options.squash) applySquash(options.squashOptions);

  const now = Date.now();
  hoverReadyAt = Math.max(hoverReadyAt, now + HOVER_COOLDOWN_MS);
  nextAmbientAllowedAt = Math.max(nextAmbientAllowedAt, now + POST_ACTION_IDLE_DELAY_MS);
  blockIdleUntil = Math.max(blockIdleUntil, now + RANDOM_IDLE_AFTER_ACTION_MS);

  active = { name: "recovery", priority: active.priority };
  actionEndTimer = setTimeout(() => {
    actionEndTimer = null;
    debugLog("recovery done → setNeutralIdle");
    setNeutralIdle({ ambientDelayMs: POST_ACTION_IDLE_DELAY_MS });
  }, recoveryMs);
}

function scheduleIdleBlink(extraDelayMs = 0) {
  if (quietMode) return;

  idleBlinkTimer = setTimeout(() => {
    if (active.name !== "idle" || active.priority !== priority.idle || pointerDown || Date.now() < nextAmbientAllowedAt) return;
    playBlink(priority.randomIdle);
  }, extraDelayMs + randomBetween(idleBlinkMinMs, idleBlinkMaxMs));
}

function scheduleRandomIdle(extraDelayMs = 0) {
  if (chatBubbleOpen) {
    debugLog("chat calm mode blocked: random idle");
    return;
  }
  if (!randomIdleEnabled || quietMode || dragging) return;

  randomIdleTimer = setTimeout(() => {
    if (active.name !== "idle" || active.priority !== priority.idle || pointerDown || Date.now() < nextAmbientAllowedAt || Date.now() < blockIdleUntil) {
      debugLog("random idle blocked");
      return;
    }

    debugLog("random idle triggered");
    const actions = [playLazyIdle, playBoredIdle, playStretchIdle, playLookAroundIdle, playImpatientIdle, playDozeIdle];
    const action = actions[Math.floor(Math.random() * actions.length)];
    action();
  }, extraDelayMs + randomBetween(RANDOM_IDLE_MIN_MS * nightMultiplier * getEmotionRandomIdleMultiplier(), RANDOM_IDLE_MAX_MS * nightMultiplier * getEmotionRandomIdleMultiplier()));
}

function scheduleRandomWalk(extraDelayMs = 0) {
  if (chatBubbleOpen) {
    debugLog("chat calm mode blocked: random walk");
    return;
  }
  if (!randomWalkEnabled || quietMode) return;

  randomWalkTimer = setTimeout(() => {
    if (active.name !== "idle" || active.priority !== priority.idle || pointerDown || Date.now() < nextAmbientAllowedAt) {
      debugLog("random walk blocked");
      return;
    }
    playRandomWalk();
  }, extraDelayMs + randomBetween(RANDOM_WALK_MIN_MS, RANDOM_WALK_MAX_MS));
}

function playOnce(name, nextPriority, onDone = null, options = {}) {
  if (!canUseAnimation(name)) return false;
  if (!startAction(name, nextPriority)) return false;

  const animation = animations[name];
  const delay = frameDelay(animation);
  const anticipationMs = options.anticipationMs ?? getAnticipationMs(name);
  const recoveryMs = options.recoveryMs ?? getRecoveryMs(name);
  let frame = 0;

  function next() {
    if (active.name !== name) return;

    const currentFrame = frame;
    const step = getAnimationFrameStep(animation, currentFrame);
    setFrame(step.row, step.frame, name);
    frame += 1;

    if (frame >= animation.frames) {
      animationTimer = setTimeout(() => {
        if (onDone) {
          onDone();
          return;
        }
        finishAction(recoveryMs, { squash: Boolean(options.squashOnRecovery), squashOptions: options.squashOptions });
      }, animation.holdLastMs ?? delay);
      return;
    }

    animationTimer = setTimeout(next, frameDelayFor(animation, currentFrame));
  }

  neutralFrame();
  actionEndTimer = setTimeout(() => {
    if (active.name !== name) return;
    if (options.anticipationFrame) {
      setFrame(options.anticipationFrame.row, options.anticipationFrame.frame, name);
    }
    if (options.onStart) options.onStart();
    next();
  }, anticipationMs);

  return true;
}

function playLoop(name, nextPriority, options = {}) {
  if (!canUseAnimation(name)) return false;
  if (!startAction(name, nextPriority)) return false;

  const animation = animations[name];
  const delay = frameDelay(animation);
  const anticipationMs = options.anticipationMs ?? getAnticipationMs(name);
  const recoveryMs = options.recoveryMs ?? getRecoveryMs(name);
  let frame = 0;

  function next() {
    if (active.name !== name) return;

    const step = getAnimationFrameStep(animation, frame);
    setFrame(step.row, step.frame, name);
    frame = (frame + 1) % animation.frames;
    animationTimer = setTimeout(next, delay);
  }

  neutralFrame();
  actionEndTimer = setTimeout(() => {
    if (active.name !== name) return;
    if (options.onStart) options.onStart();
    next();

    if (options.durationMs) {
      actionEndTimer = setTimeout(() => {
        finishAction(recoveryMs, { squash: Boolean(options.squashOnRecovery), squashOptions: options.squashOptions });
      }, options.durationMs);
    }
  }, anticipationMs);

  return true;
}

function playFrames(name, frames, nextPriority, onDone = null, options = {}) {
  if (!canUseAnimation(name)) return false;
  if (!startAction(name, nextPriority)) return false;

  const row = animations[name].row;
  const anticipationMs = options.anticipationMs ?? getAnticipationMs(name);
  const recoveryMs = options.recoveryMs ?? getRecoveryMs(name);
  let index = 0;

  function next() {
    if (active.name !== name) return;

    const step = frames[index];
    setFrame(row, step.frame, name);
    index += 1;

    if (index >= frames.length) {
      animationTimer = setTimeout(() => {
        if (onDone) {
          onDone();
          return;
        }
        finishAction(recoveryMs, { squash: Boolean(options.squashOnRecovery), squashOptions: options.squashOptions });
      }, step.duration);
      return;
    }

    animationTimer = setTimeout(next, step.duration);
  }

  neutralFrame();
  actionEndTimer = setTimeout(() => {
    if (active.name !== name) return;
    if (options.onStart) options.onStart();
    next();
  }, anticipationMs);

  return true;
}

function playBlink(nextPriority = priority.randomIdle) {
  return playFrames(
    "idle",
    [
      { frame: 2, duration: 80 },
      { frame: 3, duration: 90 },
      { frame: 4, duration: 80 },
      { frame: 0, duration: 0 }
    ],
    nextPriority
  );
}

function playSmallWave(nextPriority = priority.randomIdle) {
  return playOnce("waving", nextPriority);
}

function playReview(nextPriority = priority.randomIdle) {
  return playOnce("review", nextPriority);
}

function playTinyBounce(nextPriority = priority.randomIdle) {
  const played = playFrames(
    "idle",
    [
      { frame: 1, duration: 180 },
      { frame: 5, duration: 200 },
      { frame: 0, duration: 0 }
    ],
    nextPriority,
    null,
    { anticipationMs: 0, squashOnRecovery: true }
  );

  if (played) ipcRenderer.send("window-bounce");
  return played;
}

function playAnimationFramesForActive(animationName, activeName, onDone = null) {
  const animation = animations[animationName];
  const delay = frameDelay(animation);
  let frame = 0;

  function next() {
    if (active.name !== activeName) return;

    const currentFrame = frame;
    const step = getAnimationFrameStep(animation, currentFrame);
    setFrame(step.row, step.frame, animationName);
    frame += 1;

    if (frame >= animation.frames) {
      if (onDone) {
        animationTimer = setTimeout(onDone, animation.holdLastMs ?? delay);
      }
      return;
    }

    animationTimer = setTimeout(next, frameDelayFor(animation, currentFrame));
  }

  next();
}

function playAnimationLoopForActive(animationName, activeName) {
  const animation = animations[animationName];
  const delay = frameDelay(animation);
  let frame = 0;

  function next() {
    if (active.name !== activeName) return;

    const step = getAnimationFrameStep(animation, frame);
    setFrame(step.row, step.frame, animationName);
    frame = (frame + 1) % animation.frames;
    animationTimer = setTimeout(next, delay);
  }

  next();
}

function playSubtleIdleState(name, steps, durationMs, speechCategory = null, speechChance = 0.25) {
  if (!randomIdleEnabled || quietMode || chatBubbleOpen || pointerDown) return false;
  if (!startAction(name, priority.randomIdle)) return false;

  if (speechCategory && Math.random() < speechChance) showSpeech(speechCategory);

  let index = 0;
  function tick() {
    if (active.name !== name) return;

    const step = steps[index % steps.length];
    setFrame(step.row, step.frame, step.action ?? name);
    setSpriteTransform(step.transform ?? {});
    index += 1;
    animationTimer = setTimeout(tick, step.duration ?? 300);
  }

  tick();
  actionEndTimer = setTimeout(() => {
    if (active.name !== name) return;
    finishAction(ACTION_RECOVERY_MS);
  }, durationMs);
  return true;
}

function playLazyIdle() {
  if (canUseAnimation("lazySit")) {
    if (Math.random() < 0.25) showSpeech("lazy");
    return playLoop("lazySit", priority.randomIdle, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS,
      durationMs: randomBetween(2000, 4000)
    });
  }

  return playSubtleIdleState(
    "lazyIdle",
    [
      { row: animations.waiting.row, frame: 0, duration: 520, transform: { y: -1, rotate: -1 } },
      { row: animations.waiting.row, frame: 1, duration: 620, transform: { y: 1, rotate: 1 } },
      { row: animations.waiting.row, frame: 0, duration: 560, transform: { y: 0, rotate: 0 } }
    ],
    randomBetween(2000, 4000),
    "lazy",
    0.25
  );
}

function playBoredIdle() {
  return playSubtleIdleState(
    "boredIdle",
    [
      { row: animations.idle.row, frame: 0, duration: 800, transform: { x: -1, y: 0, rotate: -0.8 } },
      { row: animations.idle.row, frame: 2, duration: 180, transform: { x: 0, y: 1, rotate: 0 } },
      { row: animations.idle.row, frame: 0, duration: 850, transform: { x: 1, y: 0, rotate: 0.8 } },
      { row: animations.idle.row, frame: 0, duration: 850, transform: { x: 0, y: -1, rotate: 0 } }
    ],
    randomBetween(3000, 5000),
    "bored",
    0.2
  );
}

function playStretchIdle() {
  if (canUseAnimation("stretch")) {
    return playOnce("stretch", priority.randomIdle, null, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS
    });
  }

  return playSubtleIdleState(
    "stretchIdle",
    [
      { row: animations.review.row, frame: 0, duration: 360, transform: { y: 1, scaleX: 1.02, scaleY: 0.98 } },
      { row: animations.review.row, frame: 1, duration: 420, transform: { y: -2, scaleX: 0.98, scaleY: 1.03 } },
      { row: animations.waiting.row, frame: 0, duration: 360, transform: { y: 0, scaleX: 1, scaleY: 1 } }
    ],
    randomBetween(1200, 2000)
  );
}

function playLookAroundIdle() {
  return playSubtleIdleState(
    "lookAroundIdle",
    [
      { row: animations.review.row, frame: 0, duration: 500, transform: { rotate: -1.2 } },
      { row: animations.review.row, frame: 1, duration: 500, transform: { rotate: 1.2 } },
      { row: animations.review.row, frame: 2, duration: 400, transform: { rotate: 0 } }
    ],
    randomBetween(1200, 2000),
    "lookAround",
    0.12
  );
}

function playImpatientIdle() {
  return playSubtleIdleState(
    "impatientIdle",
    [
      { row: animations.failed.row, frame: 0, duration: 800, transform: { y: 1, rotate: -1 } },
      { row: animations.failed.row, frame: 1, duration: 500, transform: { y: 0, rotate: 1 } }
    ],
    randomBetween(1200, 1800),
    "impatient",
    0.15
  );
}

function playDozeIdle() {
  if (canUseAnimation("sleepWake")) {
    return playOnce("sleepWake", priority.randomIdle, null, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS
    });
  }

  if (canUseAnimation("doze")) {
    return playLoop("doze", priority.randomIdle, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS,
      durationMs: randomBetween(2000, 4000)
    });
  }

  return playSubtleIdleState(
    "dozeIdle",
    [
      { row: animations.idle.row, frame: 0, duration: 900, transform: { y: 1 } },
      { row: animations.idle.row, frame: 2, duration: 260, transform: { y: 2 } },
      { row: animations.idle.row, frame: 3, duration: 420, transform: { y: 2 } },
      { row: animations.idle.row, frame: 0, duration: 800, transform: { y: 0 } }
    ],
    randomBetween(2000, 4000)
  );
}

function playMouseProximityLook(direction) {
  if (chatBubbleOpen || quietMode || pointerDown || dragging) return false;
  if (active.name !== "idle" || active.priority !== priority.idle) return false;
  if (Date.now() < blockIdleUntil || Date.now() < nextAmbientAllowedAt) return false;

  if (canUseAnimation("proximityLook")) {
    const playedAction = playOnce("proximityLook", priority.randomIdle, null, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS
    });
    if (playedAction) blockIdleUntil = Date.now() + POST_ACTION_IDLE_DELAY_MS;
    return playedAction;
  }

  const side = direction === "left" ? -1 : direction === "right" ? 1 : 0;
  const played = playFrames(
    "idle",
    [
      { frame: 1, duration: 220 },
      { frame: 0, duration: PROXIMITY_LOOK_DURATION_MS }
    ],
    priority.randomIdle,
    null,
    {
      anticipationMs: 0,
      recoveryMs: 100,
      onStart: () => {
        animateSpriteTransform([
          { x: side * 2, y: 0, rotate: side * 1.5, duration: 180 },
          { x: side * 2, y: 0, rotate: side * 1.5, duration: PROXIMITY_LOOK_DURATION_MS },
          { x: 0, y: 0, rotate: 0, duration: 120 }
        ]);
      }
    }
  );

  if (played) {
    blockIdleUntil = Date.now() + POST_ACTION_IDLE_DELAY_MS;
  }
  return played;
}

function playBottomEdgeSit() {
  if (canUseAnimation("bottomSit")) {
    return playOnce("bottomSit", priority.singleClick, null, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS,
      squashOnRecovery: true,
      squashOptions: { scaleX: 1.04, scaleY: 0.96, durationMs: 100 }
    });
  }

  if (canUseAnimation("lazySit")) {
    return playLoop("lazySit", priority.singleClick, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS,
      durationMs: 1800
    });
  }

  return playFrames(
    "idle",
    [
      { frame: 1, duration: 260 },
      { frame: 5, duration: 900 },
      { frame: 0, duration: 0 }
    ],
    priority.singleClick,
    null,
    {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS,
      squashOnRecovery: true,
      squashOptions: { scaleX: 1.04, scaleY: 0.96, durationMs: 100 }
    }
  );
}

function playEdgeReaction(edge) {
  if (chatBubbleOpen || pointerDown || dragging) return false;

  blockIdleUntil = Date.now() + EDGE_REACTION_IDLE_BLOCK_MS;
  nextAmbientAllowedAt = Math.max(nextAmbientAllowedAt, Date.now() + EDGE_REACTION_IDLE_BLOCK_MS);

  if (edge === "bottom") return playBottomEdgeSit();

  if (edge === "top") {
    if (canUseAnimation("edgePeek")) {
      return playOnce("edgePeek", priority.singleClick, null, {
        anticipationMs: 0,
        recoveryMs: ACTION_RECOVERY_MS
      });
    }

    return playFrames(
      "waiting",
      [
        { frame: 0, duration: 160 },
        { frame: 1, duration: 160 },
        { frame: 2, duration: 200 },
        { frame: 0, duration: 0 }
      ],
      priority.singleClick,
      null,
      {
        anticipationMs: 0,
        recoveryMs: ACTION_RECOVERY_MS,
        onStart: () => animateSpriteTransform([
          { x: -2, y: -2, rotate: -2, duration: 120 },
          { x: 2, y: -2, rotate: 2, duration: 120 },
          { x: 0, y: 0, rotate: 0, duration: 120 }
        ])
      }
    );
  }

  if (edge === "left") {
    if (canUseAnimation("edgePeek")) {
      return playOnce("edgePeek", priority.singleClick, null, {
        anticipationMs: 0,
        recoveryMs: ACTION_RECOVERY_MS
      });
    }

    return playFrames(
      "idle",
      [
        { frame: 1, duration: 180 },
        { frame: 2, duration: 180 },
        { frame: 0, duration: 0 }
      ],
      priority.singleClick,
      null,
      {
        anticipationMs: 0,
        recoveryMs: ACTION_RECOVERY_MS,
        onStart: () => animateSpriteTransform([
          { x: 3, y: 0, rotate: 2, duration: 160 },
          { x: 3, y: 0, rotate: 2, duration: 260 },
          { x: 0, y: 0, rotate: 0, duration: 120 }
        ])
      }
    );
  }

  if (edge === "right") {
    if (canUseAnimation("edgePeek")) {
      return playOnce("edgePeek", priority.singleClick, null, {
        anticipationMs: 0,
        recoveryMs: ACTION_RECOVERY_MS
      });
    }

    return playFrames(
      "idle",
      [
        { frame: 1, duration: 180 },
        { frame: 0, duration: 260 }
      ],
      priority.singleClick,
      null,
      {
        anticipationMs: 0,
        recoveryMs: ACTION_RECOVERY_MS,
        onStart: () => animateSpriteTransform([
          { x: -3, y: 0, rotate: -2, duration: 160 },
          { x: -3, y: 0, rotate: -2, duration: 260 },
          { x: 0, y: 0, rotate: 0, duration: 120 }
        ])
      }
    );
  }

  return false;
}

function playJump(nextPriority = priority.jump) {
  return playOnce("jumping", nextPriority, null, {
    anticipationMs: JUMP_ANTICIPATION_MS,
    recoveryMs: JUMP_RECOVERY_MS,
    anticipationFrame: { row: animations.jumping.row, frame: 0 },
    squashOnRecovery: true,
    squashOptions: { scaleX: JUMP_SQUASH_SCALE_X, scaleY: JUMP_SQUASH_SCALE_Y, durationMs: JUMP_SQUASH_DURATION_MS },
    onStart: () => ipcRenderer.send("window-jump")
  });
}

function playFailed(nextPriority = priority.failed) {
  clearClickCounters();
  clearTimeout(clickTimer);
  return playOnce("failed", nextPriority);
}

function playPokeAnnoyed() {
  if (canUseAnimation("pokeFuss")) {
    return playOnce("pokeFuss", priority.singleClick, null, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS
    });
  }

  if (canUseAnimation("pokeAnnoyed")) {
    return playOnce("pokeAnnoyed", priority.singleClick, null, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS
    });
  }

  showSpeech("poke");
  return false;
}

function playRandomWalk() {
  const distance = randomSignedDistance(RANDOM_WALK_MIN_DISTANCE, RANDOM_WALK_MAX_DISTANCE);
  return playWalk(distance, priority.randomIdle);
}

function playWalk(distance, nextPriority) {
  const animation = distance >= 0 ? "runningRight" : "runningLeft";

  return playLoop(animation, nextPriority, {
    anticipationMs: ACTION_ANTICIPATION_MS,
    recoveryMs: ACTION_RECOVERY_MS,
    durationMs: WALK_ANIMATION_DURATION_MS,
    onStart: () => ipcRenderer.send("window-walk", distance)
  });
}

function maybeShowDragSpeech() {
  const now = Date.now();
  if (chatBubbleOpen || now < nextDragSpeechAllowedAt) return;
  nextDragSpeechAllowedAt = now + randomBetween(DRAG_SPEECH_COOLDOWN_MIN_MS, DRAG_SPEECH_COOLDOWN_MAX_MS);
  if (Math.random() < 0.45) { showSpeech("drag"); updateEmotion(-10, -5); }
}

function chooseCollarDragSet() {
  const sets = [
    { grab: "grabbedCollar", struggle: "struggleHang", weight: COLLAR_DRAG_A_WEIGHT },
    { grab: "grabbedCollarAlt", struggle: "struggleHangAlt", weight: COLLAR_DRAG_B_WEIGHT }
  ].filter((set) => canUseAnimation(set.grab) && canUseAnimation(set.struggle));

  if (sets.length === 0) return null;
  const totalWeight = sets.reduce((total, set) => total + Math.max(0, set.weight), 0);
  if (totalWeight <= 0) return sets[0];

  let pick = Math.random() * totalWeight;
  for (const set of sets) {
    pick -= Math.max(0, set.weight);
    if (pick <= 0) return set;
  }
  return sets[sets.length - 1];
}

function startHeldDrag() {
  if (!startAction("dragging", priority.drag)) return false;

  dragStartedAt = Date.now();
  dragMaxDistance = 0;
  maybeShowDragSpeech();
  const dragSet = chooseCollarDragSet();
  activeDragSet = dragSet;
  if (dragSet) {
    resetSpriteTransform();
    playAnimationFramesForActive(dragSet.grab, "dragging", () => {
      if (active.name === "dragging") {
        playAnimationLoopForActive(dragSet.struggle, "dragging");
        startHangSway();
      }
    });
    return true;
  }

  resetSpriteTransform();
  startDragFallbackLoop();
  return true;
}

function startHangSway() {
  animateSpriteTransform(
    [
      { x: -1, y: -4, rotate: -1.5, scaleX: 0.995, scaleY: 1.005, duration: 180 },
      { x: 1, y: -5, rotate: 1.4, scaleX: 1.005, scaleY: 0.995, duration: 180 },
      { x: 0, y: -4, rotate: 0, scaleX: 1, scaleY: 1, duration: 160 }
    ],
    true
  );
}

function startDragFallbackLoop() {
  clearTimeout(dragStruggleTimer);

  function tick() {
    if (active.name !== "dragging") {
      dragStruggleTimer = null;
      return;
    }

    updateDragStruggle(0);
    dragStruggleTimer = setTimeout(tick, 140);
  }

  tick();
}

function updateDragStruggle(distance = 0) {
  if (active.name !== "dragging") return;

  dragMaxDistance = Math.max(dragMaxDistance, distance);
  if (activeDragSet && canUseAnimation(activeDragSet.struggle)) {
    resetSpriteTransform();
    return;
  }

  const phase = Math.floor(Date.now() / 140) % 4;
  const steps = [
    { row: animations.waiting.row, frame: 0, transform: { x: -2, y: -6, rotate: -5, scaleX: 0.98, scaleY: 1.02 } },
    { row: animations.waiting.row, frame: 1, transform: { x: 2, y: -3, rotate: 4, scaleX: 0.99, scaleY: 1.01 } },
    { row: animations.failed.row, frame: 0, transform: { x: -1, y: -5, rotate: -3, scaleX: 0.98, scaleY: 1.02 } },
    { row: animations.waiting.row, frame: 2, transform: { x: 1, y: -4, rotate: 3, scaleX: 0.99, scaleY: 1.01 } }
  ];
  const step = steps[phase];
  setFrame(step.row, step.frame);
  setSpriteTransform(step.transform);
}

function playAnnoyedHold(nextPriority = priority.drag) {
  return playOnce("failed", nextPriority, null, {
    anticipationMs: 0,
    recoveryMs: FAILED_RECOVERY_MS,
    squashOnRecovery: true,
    squashOptions: { scaleX: 1.05, scaleY: 0.94, durationMs: 100 }
  });
}

function finishDragWithDrop() {
  const dragDuration = Date.now() - dragStartedAt;
  const shouldAnnoy = dragDuration > DRAG_ANNOYED_MS || dragMaxDistance > DRAG_ANNOYED_DISTANCE;

  clearTimeout(dragStruggleTimer);
  dragStruggleTimer = null;
  activeDragSet = null;
  resetSpriteTransform();
  ipcRenderer.send("drag-end");
  blockIdleUntil = Date.now() + 1500;
  active = { name: "idle", priority: priority.idle };

  if (canUseAnimation("dropRecover")) {
    showSpeech(shouldAnnoy ? (Math.random() < 0.55 ? "drop" : "release") : "release");
    playOnce("dropRecover", priority.drag, () => {
      resetSpriteTransform();
      active = { name: "idle", priority: priority.idle };
      if (shouldAnnoy) {
        playAnnoyedHold(priority.drag);
        return;
      }
      setNeutralIdle({ ambientDelayMs: POST_ACTION_IDLE_DELAY_MS });
    }, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS
    });
    return;
  }

  if (shouldAnnoy) {
    showSpeech(Math.random() < 0.55 ? "drop" : "release");
    playAnnoyedHold(priority.drag);
    return;
  }

  showSpeech("release");
  playFrames(
    "idle",
    [
      { frame: 1, duration: 120 },
      { frame: 5, duration: 150 },
      { frame: 0, duration: 0 }
    ],
    priority.drag,
    null,
    {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS,
      squashOnRecovery: true,
      squashOptions: { scaleX: 1.05, scaleY: 0.94, durationMs: 100 }
    }
  );
}

function getPointerZone(event) {
  const rect = pet.getBoundingClientRect();
  const x = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
  const y = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;

  if (
    y >= HEAD_HIT_ZONE_TOP &&
    y <= HEAD_HIT_ZONE_BOTTOM &&
    x >= HEAD_HIT_ZONE_LEFT &&
    x <= HEAD_HIT_ZONE_RIGHT
  ) {
    return "head";
  }

  return "body";
}

function pruneRecentClicks(now) {
  recentClicks = recentClicks.filter((entry) => now - entry.time <= RAPID_CLICK_WINDOW_MS);
  recentHeadClicks = recentHeadClicks.filter((time) => now - time <= RAPID_CLICK_WINDOW_MS);
}

function clearClickCounters() {
  recentClicks = [];
  recentHeadClicks = [];
}

function playHeadPatFeedback() {
  if (canUseAnimation("headPat")) {
    const playedAction = playOnce("headPat", priority.singleClick, null, {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS
    });
    if (playedAction) {
      showSpeech("headPat");
      updateEmotion(4, 2);
    }
    return playedAction;
  }

  const played = playFrames(
    "idle",
    [
      { frame: 1, duration: 120 },
      { frame: 2, duration: 120 },
      { frame: 3, duration: 120 },
      { frame: 0, duration: 0 }
    ],
    priority.singleClick,
    null,
    {
      anticipationMs: 0,
      recoveryMs: ACTION_RECOVERY_MS
    }
  );

  if (played) {
    showSpeech("headPat");
    updateEmotion(4, 2);
  }
  return played;
}

function handleRapidClick(zone) {
  const now = Date.now();
  pruneRecentClicks(now);
  recentClicks.push({ time: now, zone });
  if (zone === "head") recentHeadClicks.push(now);

  if (recentClicks.length >= RAPID_CLICK_COUNT) {
    debugLog("rapid click → failed");
    clearClickCounters();
    clearTimeout(dblClickTimer);
    if (playFailed(priority.failed)) { showSpeech("annoyed"); updateEmotion(-15, -5); }
    return "failed";
  }

  if (recentClicks.length >= 2) {
    return recentHeadClicks.length >= 2 ? "headPoke" : "poke";
  }

  return zone === "head" ? "headSingle" : "single";
}

function startDragging(event) {
  debugLog("startDragging");
  dragging = true;
  didDrag = true;
  suppressNextClick = true;
  blockIdleUntil = Date.now() + POST_ACTION_IDLE_DELAY_MS;
  clearPointerTimers();
  clearInteractionTimers();
  ipcRenderer.send("close-control-menu");
  ipcRenderer.send("close-speech-bubble");
  ipcRenderer.send("drag-start", {
    x: Math.round(dragStart.x),
    y: Math.round(dragStart.y)
  });
  startHeldDrag();
}

function finishDragging() {
  debugLog("finishDragging");
  dragging = false;
  blockIdleUntil = Date.now() + POST_ACTION_IDLE_DELAY_MS;
  finishDragWithDrop();
}

function screenPoint(event) {
  return { x: Math.round(event.screenX), y: Math.round(event.screenY) };
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function randomSignedDistance(min, max) {
  const distance = randomBetween(min, max);
  return Math.random() < 0.5 ? -distance : distance;
}

pet.addEventListener("pointerenter", () => {
  // hover attention disabled to prevent constant movement
});

pet.addEventListener("pointerleave", () => {
  // no-op: hover no longer plays animation
});

pet.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;

  pointerDown = true;
  dragging = false;
  didDrag = false;
  dragStart = { x: event.screenX, y: event.screenY };
  pet.setPointerCapture(event.pointerId);

  longPressTimer = setTimeout(() => {
    if (!pointerDown || dragging) return;
    debugLog("long press treated as drag");
    startDragging(event);
  }, LONG_PRESS_MS);
});

pet.addEventListener("pointermove", (event) => {
  if (!pointerDown) return;

  const distance = Math.hypot(event.screenX - dragStart.x, event.screenY - dragStart.y);
  if (!dragging && distance > DRAG_THRESHOLD_PX) startDragging(event);
  if (dragging) {
    updateDragStruggle(distance);
    ipcRenderer.send("drag-move", screenPoint(event));
  }
});

pet.addEventListener("pointerup", (event) => {
  pointerDown = false;
  clearTimeout(longPressTimer);

  if (dragging) {
    debugLog("pointerup: was dragging");
    finishDragging();
    suppressNextClick = true;
    suppressClickUntil = Date.now() + SUPPRESS_CLICK_AFTER_DRAG_MS;
    didDrag = true;
  }

  if (didDrag) {
    suppressNextClick = true;
    suppressClickUntil = Date.now() + SUPPRESS_CLICK_AFTER_DRAG_MS;
  }

  try {
    pet.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be gone if the pointer left the transparent window.
  }
});

pet.addEventListener("click", (event) => {
  if (suppressNextClick || didDrag || Date.now() < suppressClickUntil) {
    debugLog("click suppressed");
    suppressNextClick = false;
    return;
  }

  const clickZone = getPointerZone(event);
  const clickKind = handleRapidClick(clickZone);
  if (clickKind === "failed") return;

  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    blockIdleUntil = Date.now() + RANDOM_IDLE_AFTER_ACTION_MS;

    if (clickKind === "headPoke") {
      if (playPokeAnnoyed()) showSpeech("poke");
      return;
    }

    if (clickKind === "poke") {
      showSpeech("poke");
      updateEmotion(-2, 0);
      return;
    }

    if (clickKind === "headSingle") {
      playHeadPatFeedback();
      return;
    }

    if (playOnce("waving", priority.singleClick)) { showSpeech("greeting"); updateEmotion(5, 3); }
  }, CLICK_DELAY_MS);
});

pet.addEventListener("dblclick", () => {
  if (suppressNextClick || didDrag || Date.now() < suppressClickUntil) {
    suppressNextClick = false;
    return;
  }

  clearTimeout(clickTimer);
  clearTimeout(dblClickTimer);
  dblClickTimer = setTimeout(() => {
    if (Date.now() < suppressClickUntil || dragging || didDrag) return;
    clearClickCounters();
    playJump(priority.jump);
  }, CLICK_DELAY_MS);
});

pet.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  clearPointerTimers();
  ipcRenderer.send("open-control-menu", screenPoint(event));
});

ipcRenderer.on("menu-action", (_event, action) => {
  runMenuAction(action);
});

ipcRenderer.on("settings-changed", (_event, nextSettings) => {
  applySettings(nextSettings);
  if (chatBubbleOpen) return;
  if (active.name === "idle" || active.name === "recovery") {
    setNeutralIdle({ ambientDelayMs: POST_ACTION_IDLE_DELAY_MS });
  }
});

ipcRenderer.on("chat-opened", () => {
  enterCalmModeForChat();
});

ipcRenderer.on("chat-closed", () => {
  exitCalmModeForChat();
});

ipcRenderer.on("window-motion-ended", () => {
  if (active.name === "idle" || active.name === "recovery") {
    resetSpriteTransform();
    neutralFrame();
  }
});

ipcRenderer.on("mouse-proximity-attention", (_event, data) => {
  playMouseProximityLook(data?.direction);
});

ipcRenderer.on("drag-edge-interaction", (_event, data) => {
  playEdgeReaction(data?.edge);
});

ipcRenderer.on("chat-thinking", () => {
  if (!chatBubbleOpen) return;
  // Stay neutral idle during thinking, no animation
});

ipcRenderer.on("chat-replied", () => {
  if (!chatBubbleOpen) return;
  if (!playOnce("happyNod", priority.chatAction)) {
    playOnce("review", priority.chatAction);
  }
  updateEmotion(2, 1);
});

ipcRenderer.on("chat-failed", () => {
  if (!chatBubbleOpen) return;
  playFailed(priority.chatAction);
});

ipcRenderer.on("request-emotion", (_event) => {
  ipcRenderer.send("emotion-update", getEmotionData());
});

ipcRenderer.on("time-context", (_event, ctx) => {
  if (ctx.isLateNight) {
    nightMultiplier = 2.5;
  } else {
    nightMultiplier = 1;
  }
  if (ctx.weatherPhrase) {
    showSpeech(ctx.weatherPhrase);
  } else if (ctx.timePhrase) {
    showSpeech(ctx.timePhrase);
  }
});

async function runMenuAction(action) {
  const walkDistance = 120;
  const manualActions = new Set(["wave", "jump", "review", "failed", "walk-left", "walk-right"]);

  if (manualActions.has(action)) {
    const now = Date.now();
    if (now - lastMenuActionAt < MENU_ACTION_COOLDOWN_MS) {
      debugLog("menu action cooldown:", action);
      return;
    }
    lastMenuActionAt = now;
  }

  switch (action) {
    case "wave":
      playOnce("waving", priority.menuAction);
      return;
    case "jump":
      playJump(priority.menuAction);
      return;
    case "review":
      playOnce("review", priority.menuAction);
      return;
    case "failed":
      playFailed(priority.menuAction);
      return;
    case "walk-left":
      playWalk(-walkDistance, priority.menuAction);
      return;
    case "walk-right":
      playWalk(walkDistance, priority.menuAction);
      return;
    case "toggle-random-walk":
      quietMode = false;
      randomWalkEnabled = !randomWalkEnabled;
      await saveRuntimeSettings();
      showStatus(`随机走动：${randomWalkEnabled ? "开" : "关"}`);
      if (active.name === "idle" || active.name === "recovery") {
        setNeutralIdle({ ambientDelayMs: POST_ACTION_IDLE_DELAY_MS });
      }
      return;
    case "quiet-mode":
      quietMode = !quietMode;
      if (quietMode) { randomWalkEnabled = false; randomIdleEnabled = false; }
      await saveRuntimeSettings();
      showStatus(`安静模式：${quietMode ? "开" : "关"}`);
      if (active.name === "idle" || active.name === "recovery") {
        setNeutralIdle({ ambientDelayMs: POST_ACTION_IDLE_DELAY_MS });
      }
      return;
  }
}

function applySettings(nextSettings) {
  petScale = nextSettings?.petScale ?? DEFAULT_PET_SCALE;
  quietMode = Boolean(nextSettings?.quietMode);
  randomWalkEnabled = quietMode ? false : Boolean(nextSettings?.randomWalkEnabled);
  randomIdleEnabled = quietMode ? false : (nextSettings?.randomIdleEnabled !== false);
  speechBubbleEnabled = nextSettings?.speechBubbleEnabled !== false;
  resourceDockEnabled = nextSettings?.resourceDockEnabled !== false;
  resourceGpuEnabled = nextSettings?.resourceGpuEnabled !== false;
  resourceBubbleShowPercent = nextSettings?.resourceBubbleShowPercent !== false;
  resourcePressureSpeechEnabled = nextSettings?.resourcePressureSpeechEnabled !== false;
  resourceBubbleSize = nextSettings?.resourceBubbleSize ?? "small";
  resourceBubbleOpacity = nextSettings?.resourceBubbleOpacity ?? "medium";
  resourceBubblePosition = nextSettings?.resourceBubblePosition ?? "bottom-right";
  resourceBubbleCustomPosition = nextSettings?.resourceBubbleCustomPosition ?? null;

  const blinkTiming = BLINK_MODE_MAP[nextSettings?.blinkMode ?? "normal"];
  idleBlinkMinMs = blinkTiming.min;
  idleBlinkMaxMs = blinkTiming.max;

  applyEmotionToSettings(nextSettings?.emotion);

  document.documentElement.style.setProperty("--pet-scale", petScale);
  applyResourceBubbleSettings();
  if (!resourceGpuEnabled) {
    lastGpuPercent = null;
    lastGpuMemoryPercent = null;
    lastGpuLabel = "gpu";
    lastGpuName = "";
    setResourceMetric("gpu", null);
  }
  updateResourceSummary();
  updateSpriteSheetBackgroundSize();
  syncResourceDock();
}

async function saveRuntimeSettings() {
  const nextSettings = await ipcRenderer.invoke("update-settings", {
    randomWalkEnabled,
    quietMode,
    petScale,
    randomIdleEnabled,
    emotion: getEmotionData()
  });
  applySettings(nextSettings);
}

function showStatus(text) {
  ipcRenderer.send("show-status-bubble", text);
}

window.petActions = {
  playWaving: () => playOnce("waving", priority.menuAction),
  playJumping: () => playJump(priority.menuAction),
  playReview: () => playOnce("review", priority.menuAction),
  playFailed: () => playFailed(priority.menuAction),
  playWalkLeft: () => playWalk(-120, priority.menuAction),
  playWalkRight: () => playWalk(120, priority.menuAction),
  returnToIdle: setNeutralIdle
};

async function init() {
  loadSpriteSheetMetrics();
  const settings = await ipcRenderer.invoke("get-settings");
  applySettings(settings);
  ipcRenderer.send("renderer-ready");
  setNeutralIdle();
}

init();
