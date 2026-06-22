const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const GENERATED_DIR = "C:\\Users\\111\\.codex\\generated_images\\019ed1fd-8388-7442-9120-8cb72c3aa918";
const ACTIONS = [
  "headPat",
  "pokeFuss",
  "proximityLook",
  "edgePeek",
  "bottomSit",
  "sleepWake",
  "happyNod"
];
const USED_FRAMES_BY_ROW = [8, 8, 8, 8, 8, 8, 8];

const COLUMNS = 8;
const ROWS = 7;
const TARGET_FRAME_WIDTH = 192;
const TARGET_FRAME_HEIGHT = 208;
const OUTPUT_PATH = path.join(__dirname, "pet-spritesheet-extension-rows16-22.png");
const PREVIEW_PATH = path.join(__dirname, "pet-spritesheet-extension-rows16-22-preview.png");
const SPACED_GREEN_PATH = path.join(__dirname, "new-action-rows-spaced-green.png");
const SPACED_GREEN_PREVIEW_PATH = path.join(__dirname, "new-action-rows-spaced-green-preview.png");
const SOURCE_DIR = path.join(__dirname, "assets", "generated", "new-action-rows");
const SOURCE_OVERRIDES = {
  bottomSit: "C:\\Users\\111\\Downloads\\已生成图像 3.png"
};

const GREEN_MIN = 145;
const GREEN_DOMINANCE = 45;
const GREEN_DISTANCE_SOFT = 60;
const ALPHA_THRESHOLD = 8;
const CELL_PADDING_X = 4;
const CELL_PADDING_Y = 2;
const BOTTOM_MARGIN_BY_ROW = [4, 4, 4, 4, 5, 4, 4];
const DEFRINGE_RADIUS = 4;
const GREEN_RGBA = [0, 255, 0, 255];
const ROW_LEVEL_SCALE_ACTIONS = new Set(["bottomSit"]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function channelsForColorType(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 3) return 1;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error(`Unsupported PNG color type ${colorType}.`);
}

function toRgba(raw, width, height, colorType, palette, transparency) {
  const rgba = Buffer.alloc(width * height * 4);
  const pixels = width * height;

  for (let i = 0; i < pixels; i += 1) {
    const out = i * 4;
    if (colorType === 6) {
      raw.copy(rgba, out, i * 4, i * 4 + 4);
    } else if (colorType === 2) {
      const src = i * 3;
      rgba[out] = raw[src];
      rgba[out + 1] = raw[src + 1];
      rgba[out + 2] = raw[src + 2];
      rgba[out + 3] = 255;
      if (transparency && transparency.length >= 6) {
        const tr = transparency.readUInt16BE(0);
        const tg = transparency.readUInt16BE(2);
        const tb = transparency.readUInt16BE(4);
        if (rgba[out] === tr && rgba[out + 1] === tg && rgba[out + 2] === tb) rgba[out + 3] = 0;
      }
    } else if (colorType === 4) {
      const src = i * 2;
      rgba[out] = raw[src];
      rgba[out + 1] = raw[src];
      rgba[out + 2] = raw[src];
      rgba[out + 3] = raw[src + 1];
    } else if (colorType === 0) {
      rgba[out] = raw[i];
      rgba[out + 1] = raw[i];
      rgba[out + 2] = raw[i];
      rgba[out + 3] = 255;
    } else if (colorType === 3) {
      const index = raw[i];
      const paletteOffset = index * 3;
      rgba[out] = palette?.[paletteOffset] ?? 0;
      rgba[out + 1] = palette?.[paletteOffset + 1] ?? 0;
      rgba[out + 2] = palette?.[paletteOffset + 2] ?? 0;
      rgba[out + 3] = transparency?.[index] ?? 255;
    }
  }

  return rgba;
}

function parsePng(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Not a PNG: ${filePath}`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let compression = 0;
  let filterMethod = 0;
  let interlace = 0;
  let palette = null;
  let transparency = null;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      compression = data[10];
      filterMethod = data[11];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = Buffer.from(data);
    } else if (type === "tRNS") {
      transparency = Buffer.from(data);
    } else if (type === "IDAT") {
      idatChunks.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}: ${filePath}`);
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) {
    throw new Error(`Unsupported PNG encoding: ${filePath}`);
  }

  const channels = channelsForColorType(colorType);
  const rowBytes = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const raw = Buffer.alloc(width * height * channels);
  let src = 0;
  let dst = 0;
  let previous = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src];
    src += 1;
    const current = Buffer.from(inflated.subarray(src, src + rowBytes));
    src += rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? current[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      if (filter === 1) current[x] = (current[x] + left) & 0xff;
      else if (filter === 2) current[x] = (current[x] + up) & 0xff;
      else if (filter === 3) current[x] = (current[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) current[x] = (current[x] + paethPredictor(left, up, upLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}: ${filePath}`);
    }

    current.copy(raw, dst);
    dst += rowBytes;
    previous = current;
  }

  return {
    width,
    height,
    colorType,
    rgba: toRgba(raw, width, height, colorType, palette, transparency)
  };
}

function writeChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function encodeRgbaPng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * rowBytes;
    const targetStart = y * (rowBytes + 1);
    raw[targetStart] = 0;
    rgba.copy(raw, targetStart + 1, sourceStart, sourceStart + rowBytes);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    writeChunk("IHDR", ihdr),
    writeChunk("IDAT", zlib.deflateSync(raw)),
    writeChunk("IEND")
  ]);
}

function pixelOffset(width, x, y) {
  return (y * width + x) * 4;
}

function greenAlpha(r, g, b) {
  const dominance = g - Math.max(r, b);
  if (g < GREEN_MIN || dominance < GREEN_DOMINANCE) return 255;

  const score = Math.min(1, dominance / GREEN_DISTANCE_SOFT);
  return Math.round(255 * (1 - score));
}

function chromaKey(image) {
  const keyed = Buffer.from(image.rgba);
  for (let i = 0; i < keyed.length; i += 4) {
    const alpha = greenAlpha(keyed[i], keyed[i + 1], keyed[i + 2]);
    keyed[i + 3] = Math.min(keyed[i + 3], alpha);
    if (keyed[i + 3] <= ALPHA_THRESHOLD) {
      keyed[i] = 0;
      keyed[i + 1] = 0;
      keyed[i + 2] = 0;
      keyed[i + 3] = 0;
    }
  }
  return { ...image, rgba: keyed };
}

function findContentBounds(image, cellX, cellY, cellWidth, cellHeight) {
  let minX = cellWidth;
  let minY = cellHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const alpha = image.rgba[pixelOffset(image.width, cellX + x, cellY + y) + 3];
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function blendPixel(target, targetWidth, x, y, r, g, b, a) {
  if (a <= ALPHA_THRESHOLD) return;
  const out = pixelOffset(targetWidth, x, y);
  target[out] = r;
  target[out + 1] = g;
  target[out + 2] = b;
  target[out + 3] = a;
}

function paintPixel(target, targetWidth, x, y, r, g, b, a) {
  const out = pixelOffset(targetWidth, x, y);
  target[out] = r;
  target[out + 1] = g;
  target[out + 2] = b;
  target[out + 3] = a;
}

function copyCellToTarget(source, target, targetRow, column, sourceCellX, sourceCellWidth, sourceCellHeight) {
  const sourceCellY = 0;
  const bounds = findContentBounds(source, sourceCellX, sourceCellY, sourceCellWidth, sourceCellHeight);
  if (!bounds) return false;

  const maxWidth = TARGET_FRAME_WIDTH - CELL_PADDING_X * 2;
  const maxHeight = TARGET_FRAME_HEIGHT - CELL_PADDING_Y * 2;
  const scale = Math.min(1, maxWidth / bounds.width, maxHeight / bounds.height);
  const drawWidth = Math.max(1, Math.round(bounds.width * scale));
  const drawHeight = Math.max(1, Math.round(bounds.height * scale));
  const targetCellX = column * TARGET_FRAME_WIDTH;
  const targetCellY = targetRow * TARGET_FRAME_HEIGHT;
  const drawX = targetCellX + Math.round((TARGET_FRAME_WIDTH - drawWidth) / 2);
  let drawY = targetCellY + TARGET_FRAME_HEIGHT - BOTTOM_MARGIN_BY_ROW[targetRow] - drawHeight;
  drawY = Math.max(targetCellY + CELL_PADDING_Y, Math.min(drawY, targetCellY + TARGET_FRAME_HEIGHT - drawHeight));

  for (let y = 0; y < drawHeight; y += 1) {
    const srcY = sourceCellY + bounds.minY + Math.min(bounds.height - 1, Math.floor(y / scale));
    const targetY = drawY + y;
    for (let x = 0; x < drawWidth; x += 1) {
      const srcX = sourceCellX + bounds.minX + Math.min(bounds.width - 1, Math.floor(x / scale));
      const targetX = drawX + x;
      const src = pixelOffset(source.width, srcX, srcY);
      blendPixel(
        target,
        COLUMNS * TARGET_FRAME_WIDTH,
        targetX,
        targetY,
        source.rgba[src],
        source.rgba[src + 1],
        source.rgba[src + 2],
        source.rgba[src + 3]
      );
    }
  }

  return true;
}

function findComponents(image) {
  const visited = new Uint8Array(image.width * image.height);
  const components = [];

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const startIndex = y * image.width + x;
      if (visited[startIndex]) continue;
      visited[startIndex] = 1;

      const startAlpha = image.rgba[pixelOffset(image.width, x, y) + 3];
      if (startAlpha <= ALPHA_THRESHOLD) continue;

      const queue = [[x, y]];
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let area = 0;

      for (let i = 0; i < queue.length; i += 1) {
        const [cx, cy] = queue[i];
        area += 1;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
          const index = ny * image.width + nx;
          if (visited[index]) continue;
          visited[index] = 1;
          const alpha = image.rgba[pixelOffset(image.width, nx, ny) + 3];
          if (alpha <= ALPHA_THRESHOLD) continue;
          queue.push([nx, ny]);
        }
      }

      components.push({
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        area
      });
    }
  }

  return components;
}

function selectFrameComponents(image, expectedCount) {
  const minArea = Math.max(900, image.width * image.height * 0.001);
  return findComponents(image)
    .filter((component) => component.area >= minArea && component.width >= 35 && component.height >= 80)
    .sort((a, b) => b.area - a.area)
    .slice(0, expectedCount)
    .sort((a, b) => a.minX - b.minX);
}

function scaleForBounds(bounds, targetRow, rowScale = null) {
  const maxWidth = TARGET_FRAME_WIDTH - CELL_PADDING_X * 2;
  const maxHeight = TARGET_FRAME_HEIGHT - CELL_PADDING_Y * 2;
  return rowScale ?? Math.min(1, maxWidth / bounds.width, maxHeight / bounds.height);
}

function copyBoundsToTarget(source, target, targetRow, column, bounds, rowScale = null) {
  const scale = scaleForBounds(bounds, targetRow, rowScale);
  const drawWidth = Math.max(1, Math.round(bounds.width * scale));
  const drawHeight = Math.max(1, Math.round(bounds.height * scale));
  const targetCellX = column * TARGET_FRAME_WIDTH;
  const targetCellY = targetRow * TARGET_FRAME_HEIGHT;
  const drawX = targetCellX + Math.round((TARGET_FRAME_WIDTH - drawWidth) / 2);
  let drawY = targetCellY + TARGET_FRAME_HEIGHT - BOTTOM_MARGIN_BY_ROW[targetRow] - drawHeight;
  drawY = Math.max(targetCellY + CELL_PADDING_Y, Math.min(drawY, targetCellY + TARGET_FRAME_HEIGHT - drawHeight));

  for (let y = 0; y < drawHeight; y += 1) {
    const srcY = bounds.minY + Math.min(bounds.height - 1, Math.floor(y / scale));
    const targetY = drawY + y;
    for (let x = 0; x < drawWidth; x += 1) {
      const srcX = bounds.minX + Math.min(bounds.width - 1, Math.floor(x / scale));
      const targetX = drawX + x;
      const src = pixelOffset(source.width, srcX, srcY);
      blendPixel(
        target,
        COLUMNS * TARGET_FRAME_WIDTH,
        targetX,
        targetY,
        source.rgba[src],
        source.rgba[src + 1],
        source.rgba[src + 2],
        source.rgba[src + 3]
      );
    }
  }
}

function copyBoundsToGreenCell(source, target, targetWidth, targetRow, column, bounds, rowScale = null) {
  const scale = scaleForBounds(bounds, targetRow, rowScale);
  const drawWidth = Math.max(1, Math.round(bounds.width * scale));
  const drawHeight = Math.max(1, Math.round(bounds.height * scale));
  const targetCellX = column * TARGET_FRAME_WIDTH;
  const targetCellY = targetRow * TARGET_FRAME_HEIGHT;
  const drawX = targetCellX + Math.round((TARGET_FRAME_WIDTH - drawWidth) / 2);
  let drawY = targetCellY + TARGET_FRAME_HEIGHT - BOTTOM_MARGIN_BY_ROW[targetRow] - drawHeight;
  drawY = Math.max(targetCellY + CELL_PADDING_Y, Math.min(drawY, targetCellY + TARGET_FRAME_HEIGHT - drawHeight));

  for (let y = 0; y < drawHeight; y += 1) {
    const srcY = bounds.minY + Math.min(bounds.height - 1, Math.floor(y / scale));
    const targetY = drawY + y;
    for (let x = 0; x < drawWidth; x += 1) {
      const srcX = bounds.minX + Math.min(bounds.width - 1, Math.floor(x / scale));
      const targetX = drawX + x;
      const src = pixelOffset(source.width, srcX, srcY);
      const alpha = source.rgba[src + 3];
      if (alpha <= ALPHA_THRESHOLD) continue;
      paintPixel(target, targetWidth, targetX, targetY, source.rgba[src], source.rgba[src + 1], source.rgba[src + 2], 255);
    }
  }
}

function findNearbyOpaqueColor(source, width, height, x, y) {
  for (let radius = 1; radius <= DEFRINGE_RADIUS; radius += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const i = pixelOffset(width, nx, ny);
        if (source[i + 3] < 220) continue;
        r += source[i];
        g += source[i + 1];
        b += source[i + 2];
        count += 1;
      }
    }
    if (count > 0) return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
  }
  return null;
}

function defringeGreenEdges(rgba, width, height) {
  const source = Buffer.from(rgba);
  let changed = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = pixelOffset(width, x, y);
      const alpha = source[i + 3];
      if (alpha <= ALPHA_THRESHOLD) continue;
      const greenish = source[i + 1] > source[i] + 25 && source[i + 1] > source[i + 2] + 25;
      if (!greenish && alpha >= 245) continue;
      const color = findNearbyOpaqueColor(source, width, height, x, y);
      if (!color) continue;
      rgba[i] = color.r;
      rgba[i + 1] = color.g;
      rgba[i + 2] = color.b;
      changed += 1;
    }
  }
  return changed;
}

function makePreview(rgba, width, height) {
  const preview = Buffer.alloc(rgba.length);
  const tile = 16;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = pixelOffset(width, x, y);
      const checker = ((Math.floor(x / tile) + Math.floor(y / tile)) % 2) === 0 ? 46 : 70;
      const alpha = rgba[i + 3] / 255;
      preview[i] = Math.round(rgba[i] * alpha + checker * (1 - alpha));
      preview[i + 1] = Math.round(rgba[i + 1] * alpha + checker * (1 - alpha));
      preview[i + 2] = Math.round(rgba[i + 2] * alpha + checker * (1 - alpha));
      preview[i + 3] = 255;
    }
  }
  return preview;
}

function latestGeneratedRows() {
  return fs.readdirSync(GENERATED_DIR)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .map((name) => {
      const fullPath = path.join(GENERATED_DIR, name);
      return { fullPath, name, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .slice(-ACTIONS.length);
}

function main() {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });

  const rows = latestGeneratedRows();
  if (rows.length !== ACTIONS.length) {
    throw new Error(`Expected ${ACTIONS.length} generated rows, found ${rows.length}.`);
  }

  const outputWidth = COLUMNS * TARGET_FRAME_WIDTH;
  const outputHeight = ROWS * TARGET_FRAME_HEIGHT;
  const output = Buffer.alloc(outputWidth * outputHeight * 4, 0);
  const spacedGreen = Buffer.alloc(outputWidth * outputHeight * 4);
  for (let i = 0; i < spacedGreen.length; i += 4) {
    spacedGreen[i] = GREEN_RGBA[0];
    spacedGreen[i + 1] = GREEN_RGBA[1];
    spacedGreen[i + 2] = GREEN_RGBA[2];
    spacedGreen[i + 3] = GREEN_RGBA[3];
  }
  const report = [];
  let copiedFrames = 0;

  rows.forEach((row, rowIndex) => {
    const action = ACTIONS[rowIndex];
    const namedPath = path.join(SOURCE_DIR, `${String(rowIndex + 16).padStart(2, "0")}-${action}.png`);
    const sourcePath = fs.existsSync(namedPath)
      ? namedPath
      : SOURCE_OVERRIDES[action] && fs.existsSync(SOURCE_OVERRIDES[action])
      ? SOURCE_OVERRIDES[action]
      : row.fullPath;
    if (path.resolve(sourcePath) !== path.resolve(namedPath)) {
      fs.copyFileSync(sourcePath, namedPath);
    }

    const source = chromaKey(parsePng(namedPath));
    const sourceCellHeight = source.height;

    const frameComponents = selectFrameComponents(source, USED_FRAMES_BY_ROW[rowIndex]);
    const rowScale = ROW_LEVEL_SCALE_ACTIONS.has(action) && frameComponents[0]
      ? scaleForBounds(frameComponents[0], rowIndex)
      : null;
    let rowFrames = 0;
    for (let column = 0; column < frameComponents.length; column += 1) {
      copyBoundsToGreenCell(source, spacedGreen, outputWidth, rowIndex, column, frameComponents[column], rowScale);
      copyBoundsToTarget(source, output, rowIndex, column, frameComponents[column], rowScale);
      rowFrames += 1;
      copiedFrames += 1;
    }

    report.push({
      row: rowIndex + 16,
      action,
      source: namedPath,
      sourceSize: `${source.width}x${source.height}`,
      detectedFrames: rowFrames
    });
  });

  const defringedPixels = defringeGreenEdges(output, outputWidth, outputHeight);
  fs.writeFileSync(SPACED_GREEN_PATH, encodeRgbaPng(outputWidth, outputHeight, spacedGreen));
  fs.writeFileSync(SPACED_GREEN_PREVIEW_PATH, encodeRgbaPng(outputWidth, outputHeight, spacedGreen));
  fs.writeFileSync(OUTPUT_PATH, encodeRgbaPng(outputWidth, outputHeight, output));
  fs.writeFileSync(PREVIEW_PATH, encodeRgbaPng(outputWidth, outputHeight, makePreview(output, outputWidth, outputHeight)));

  console.log(`Spaced green: ${SPACED_GREEN_PATH}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Preview: ${PREVIEW_PATH}`);
  console.log(`Output size: ${outputWidth}x${outputHeight}`);
  console.log(`Frames copied: ${copiedFrames}`);
  console.log(`Defringed pixels: ${defringedPixels}`);
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
