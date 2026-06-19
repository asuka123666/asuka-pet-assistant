const { ipcRenderer } = require("electron");

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
  stretch:       { anticipationMs: 0, recoveryMs: 150 }
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
    "你总算注意到我了？",
    "哼，这才对。",
    "找我有事？",
    "别磨蹭，说吧。",
    "我可不是在等你。"
  ],
  poke: [
    "你又戳我？",
    "别一直点，笨蛋。",
    "我听见了，不用点这么多次。",
    "有事就说。"
  ],
  annoyed: [
    "别一直戳我，笨蛋。",
    "你很闲吗？",
    "够了，烦死了。",
    "再闹我可真生气了。",
    "别得寸进尺。"
  ],
  release: [
    "下次别抓领子。",
    "差点被你勒死。",
    "你真是够粗鲁的。",
    "哼，算你识相。",
    "再这样我真的生气了。"
  ],
  drag: [
    "喂！别抓我后领！",
    "放开我的领子，笨蛋！",
    "谁允许你从后面抓我的？",
    "别拎着我走！",
    "你把我当什么了？"
  ],
  lazy: [
    "稍微休息一下不行吗？",
    "别催，我在思考。",
    "我才不是在偷懒。",
    "现在是战术性休息。",
    "你很闲吗？一直盯着我。"
  ],
  bored: [
    "……",
    "好无聊。",
    "你倒是说点什么啊。",
    "就这样站着也太傻了。"
  ],
  lookAround: [
    "你这桌面还挺乱的。"
  ],
  impatient: [
    "你把我叫出来就只是看着？"
  ],
  longPress: [
    "按够了没有？",
    "你到底想干嘛？",
    "别一直按着我。"
  ],
  held: [
    "按够了没有？",
    "你到底想干嘛？",
    "别一直按着我。"
  ],
  drop: [
    "差点摔到了！",
    "你真是够粗鲁的。",
    "别以为这样很好玩。"
  ],
  lateNight: [
    "都几点了，你还不睡？",
    "我要睡了，别吵。",
    "明天再说。",
    "你不困吗？"
  ],
  morning: [
    "早。",
    "你总算醒了？",
    "今天也要加油，笨蛋。"
  ],
  weatherRain: [
    "外面在下雨呢。",
    "别忘了带伞。",
    "下雨天最适合待着不动。"
  ],
  weatherCold: [
    "好冷。",
    "你就不能开个暖气？",
    "冻死了。"
  ],
  weatherHot: [
    "热死了。",
    "开空调啊。",
    "这种天气谁要动。"
  ],
  weatherSnow: [
    "下雪了。",
    "外面白茫茫的。",
    "别出门了。"
  ],
  weatherClear: [
    "天气不错。",
    "适合出门走走。",
    "倒是挺舒服的。"
  ]
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
  stretch: { row: -1, frames: 6, fps: 5.5, holdLastMs: 160, fallback: "stretchIdle" }
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
  stretch: 1.04
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
  recentClicks = [];
  clearTimeout(clickTimer);
  return playOnce("failed", nextPriority);
}

function playPokeAnnoyed() {
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

function handleRapidClick() {
  const now = Date.now();
  recentClicks = recentClicks.filter((time) => now - time <= RAPID_CLICK_WINDOW_MS);
  recentClicks.push(now);

  if (recentClicks.length >= RAPID_CLICK_COUNT) {
    debugLog("rapid click → failed");
    recentClicks = [];
    clearTimeout(dblClickTimer);
    if (playFailed(priority.failed)) { showSpeech("annoyed"); updateEmotion(-15, -5); }
    return "failed";
  }

  return recentClicks.length >= 2 ? "poke" : "single";
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

pet.addEventListener("click", () => {
  if (suppressNextClick || didDrag || Date.now() < suppressClickUntil) {
    debugLog("click suppressed");
    suppressNextClick = false;
    return;
  }

  const clickKind = handleRapidClick();
  if (clickKind === "failed") return;

  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    if (clickKind === "poke") {
      if (playPokeAnnoyed()) showSpeech("poke");
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
    recentClicks = [];
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

ipcRenderer.on("chat-thinking", () => {
  if (!chatBubbleOpen) return;
  // Stay neutral idle during thinking, no animation
});

ipcRenderer.on("chat-replied", () => {
  if (!chatBubbleOpen) return;
  playOnce("review", priority.chatAction);
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

  const blinkTiming = BLINK_MODE_MAP[nextSettings?.blinkMode ?? "normal"];
  idleBlinkMinMs = blinkTiming.min;
  idleBlinkMaxMs = blinkTiming.max;

  applyEmotionToSettings(nextSettings?.emotion);

  document.documentElement.style.setProperty("--pet-scale", petScale);
  updateSpriteSheetBackgroundSize();
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
