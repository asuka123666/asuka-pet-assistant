const fs = require("fs");
const { spawnSync } = require("child_process");

const JS_FILES = [
  "main.js",
  "renderer.js",
  "merge-spritesheet.js",
  "convert-equal-cells-extension.js"
];

const REQUIRED_FILES = [
  "index.html",
  "style.css",
  "package.json",
  "pet-spritesheet.png",
  "pet-spritesheet-extension.png",
  "pet-spritesheet-original-9rows-backup.png"
];

const PNG_EXPECTATIONS = [
  { file: "pet-spritesheet.png", width: 1536, height: 3328, label: "active 16-row sheet" },
  { file: "pet-spritesheet-16rows.png", width: 1536, height: 3328, label: "generated 16-row sheet" },
  { file: "pet-spritesheet-extension.png", width: 1536, height: 1456, label: "7-row extension" },
  { file: "pet-spritesheet-original-9rows-backup.png", width: 1536, height: 1872, label: "original 9-row backup" }
];

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`OK   ${message}`);
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
checkPngAssets();

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Project check passed.");
}
