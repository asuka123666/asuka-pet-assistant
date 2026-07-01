const fs = require("fs");
const { spawnSync } = require("child_process");

const JS_FILES = [
  "main.js",
  "renderer.js",
  "templates/bubbles.js",
  "templates/chat-bubble.js",
  "templates/control-menu.js",
  "templates/reminder.js",
  "templates/settings.js",
  "templates/widget.js",
  "merge-spritesheet.js",
  "convert-equal-cells-extension.js",
  "process-new-action-rows.js"
];

const REQUIRED_FILES = [
  "index.html",
  "style.css",
  "package.json",
  "pet-spritesheet.png",
  "pet-spritesheet-extension.png",
  "pet-spritesheet-extension-rows16-22.png",
  "pet-spritesheet-original-9rows-backup.png"
];

const PNG_EXPECTATIONS = [
  { file: "pet-spritesheet.png", width: 1536, height: 4784, label: "active 23-row sheet" },
  { file: "pet-spritesheet-16rows.png", width: 1536, height: 3328, label: "generated 16-row sheet" },
  { file: "pet-spritesheet-extension.png", width: 1536, height: 1456, label: "7-row extension" },
  { file: "pet-spritesheet-extension-rows16-22.png", width: 1536, height: 1456, label: "interaction 7-row extension" },
  { file: "pet-spritesheet-original-9rows-backup.png", width: 1536, height: 1872, label: "original 9-row backup" }
];

const REQUIRED_BUILD_FILES = [
  "main.js",
  "renderer.js",
  "index.html",
  "style.css",
  "pet-spritesheet.png",
  "icon.ico",
  "templates/**",
  "package.json"
];

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`OK   ${message}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function checkRequiredFiles() {
  for (const file of REQUIRED_FILES) {
    if (fs.existsSync(file)) pass(`${file} exists`);
    else fail(`${file} is missing`);
  }
}

function checkJavaScriptSyntax() {
  for (const file of JS_FILES) {
    if (!fs.existsSync(file)) {
      fail(`${file} is missing`);
      continue;
    }

    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status === 0) {
      pass(`${file} syntax`);
    } else {
      fail(`${file} syntax\n${result.stderr || result.stdout}`);
    }
  }
}

function checkPackageConfig() {
  if (!fs.existsSync("package.json")) {
    fail("package.json is missing");
    return;
  }

  try {
    const pkg = readJson("package.json");

    if (pkg.main === "main.js") pass("package.json main points to main.js");
    else fail(`package.json main expected main.js, got ${pkg.main || "(missing)"}`);

    const scripts = pkg.scripts || {};
    for (const script of ["start", "check", "build"]) {
      if (typeof scripts[script] === "string" && scripts[script].trim()) {
        pass(`package.json script ${script}`);
      } else {
        fail(`package.json script ${script} is missing`);
      }
    }

    const devDependencies = pkg.devDependencies || {};
    if (devDependencies.electron) pass("package.json devDependency electron");
    else fail("package.json devDependency electron is missing");

    if (devDependencies["electron-builder"]) pass("package.json devDependency electron-builder");
    else fail("package.json devDependency electron-builder is missing");

    const buildFiles = pkg.build && Array.isArray(pkg.build.files) ? pkg.build.files : [];
    for (const file of REQUIRED_BUILD_FILES) {
      if (buildFiles.includes(file)) pass(`build.files includes ${file}`);
      else fail(`build.files missing ${file}`);
    }
  } catch (error) {
    fail(`package.json ${error.message}`);
  }
}

function assertIncludes(label, html, expected) {
  if (html.includes(expected)) pass(`${label} includes ${expected}`);
  else fail(`${label} missing ${expected}`);
}

function checkTemplatesRender() {
  try {
    const { statusBubbleHtml, speechBubbleHtml } = require("./templates/bubbles");
    const { chatBubbleHtml } = require("./templates/chat-bubble");
    const { controlMenuHtml } = require("./templates/control-menu");
    const { reminderHtml } = require("./templates/reminder");
    const { settingsHtml } = require("./templates/settings");
    const { widgetHtml } = require("./templates/widget");

    assertIncludes("status bubble template", statusBubbleHtml("<status>"), "&lt;status&gt;");
    assertIncludes("speech bubble template", speechBubbleHtml("hello", 1800), "1800ms");
    assertIncludes("control menu template", controlMenuHtml({ randomWalkEnabled: true, quietMode: false }), "随机走动");
    assertIncludes("reminder template", reminderHtml(), "set-reminder");
    assertIncludes("chat bubble template", chatBubbleHtml(), "chat-send");
    assertIncludes("widget template", widgetHtml("<12:00>", "晴天"), "&lt;12:00&gt;");

    const apiProviders = {
      openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
      deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" }
    };
    const defaultSettings = {
      petScale: 0.6,
      blinkMode: "normal",
      randomWalkEnabled: false,
      quietMode: false,
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
      resourcePressureSpeechEnabled: true,
      apiSettings: {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        apiKeyLast4: ""
      }
    };
    const settingsMarkup = settingsHtml({
      settings: null,
      defaultSettings,
      cachedEmotion: { mood: 0, energy: 50 },
      apiProviders
    });
    assertIncludes("settings template", settingsMarkup, "API 设置");
    assertIncludes("settings template", settingsMarkup, "save-api-settings");
  } catch (error) {
    fail(`template render ${error.message}`);
  }
}

function readPngInfo(file) {
  const buffer = fs.readFileSync(file);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("not a PNG file");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25]
  };
}

function checkPngAssets() {
  for (const expected of PNG_EXPECTATIONS) {
    if (!fs.existsSync(expected.file)) {
      fail(`${expected.file} is missing`);
      continue;
    }

    try {
      const info = readPngInfo(expected.file);
      const sizeOk = info.width === expected.width && info.height === expected.height;
      const alphaOk = info.colorType === 6;

      if (sizeOk && alphaOk) {
        pass(`${expected.file} ${info.width}x${info.height} RGBA (${expected.label})`);
      } else {
        fail(`${expected.file} expected ${expected.width}x${expected.height} RGBA, got ${info.width}x${info.height} colorType=${info.colorType}`);
      }
    } catch (error) {
      fail(`${expected.file} ${error.message}`);
    }
  }
}

checkRequiredFiles();
checkJavaScriptSyntax();
checkPackageConfig();
checkTemplatesRender();
checkPngAssets();

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Project check passed.");
}
