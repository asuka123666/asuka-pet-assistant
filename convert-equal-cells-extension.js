const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SOURCE_PATH = "C:\\Users\\111\\Downloads\\asuka_transparent_equal_cells_left_160x210.png";
const OUTPUT_PATH = path.join(__dirname, "pet-spritesheet-extension-from-equal-cells.png");
const PREVIEW_PATH = path.join(__dirname, "pet-spritesheet-extension-from-equal-cells-preview.png");

const COLUMNS = 8;
const ROWS = 7;
const TARGET_FRAME_WIDTH = 192;
const TARGET_FRAME_HEIGHT = 208;
const USED_FRAMES_BY_ROW = [6, 8, 6, 6, 6, 4, 6];
const ALPHA_THRESHOLD = 8;
const CELL_PADDING_X = 4;
const CELL_PADDING_Y = 2;
const BOTTOM_MARGIN_BY_ROW = [4, 4, 3, 5, 5, 5, 4];
const ENABLE_DEFRINGE = true;
const DEFRINGE_RADIUS = 7;
const DEFRINGE_EDGE_RADIUS = 4;
const DEFRINGE_OPAQUE_ALPHA = 235;
const DEFRINGE_EDGE_ALPHA_MAX = 248;

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
      const tr = transparency && transparency.length >= 6 ? transparency.readUInt16BE(0) : null;
      const tg = transparency && transparency.length >= 6 ? transparency.readUInt16BE(2) : null;
      const tb = transparency && transparency.length >= 6 ? transparency.readUInt16BE(4) : null;
      rgba[out] = raw[src];
      rgba[out + 1] = raw[src + 1];
      rgba[out + 2] = raw[src + 2];
      rgba[out + 3] = raw[src] === tr && raw[src + 1] === tg && raw[src + 2] === tb ? 0 : 255;
    } else if (colorType === 3) {
      if (!palette) throw new Error("Indexed PNG is missing PLTE palette.");
      const index = raw[i];
      const src = index * 3;
      rgba[out] = palette[src] ?? 0;
      rgba[out + 1] = palette[src + 1] ?? 0;
      rgba[out + 2] = palette[src + 2] ?? 0;
      rgba[out + 3] = transparency && index < transparency.length ? transparency[index] : 255;
    } else if (colorType === 0) {
      const gray = raw[i];
      const transparentGray = transparency && transparency.length >= 2 ? transparency.readUInt16BE(0) : null;
      rgba[out] = gray;
      rgba[out + 1] = gray;
      rgba[out + 2] = gray;
      rgba[out + 3] = gray === transparentGray ? 0 : 255;
    } else if (colorType === 4) {
      const src = i * 2;
      rgba[out] = raw[src];
      rgba[out + 1] = raw[src];
      rgba[out + 2] = raw[src];
      rgba[out + 3] = raw[src + 1];
    }
  }

  return rgba;
}

function parsePng(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Not a PNG file: ${filePath}`);
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
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth}. Expected 8-bit PNG.`);
  }
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) {
    throw new Error("Unsupported PNG format. Expected non-interlaced standard PNG.");
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
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}.`);
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
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

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
  if (a <= 0) return;
  const out = pixelOffset(targetWidth, x, y);
  target[out] = r;
  target[out + 1] = g;
  target[out + 2] = b;
  target[out + 3] = a;
}

function copyCellToTarget(source, target, row, column, sourceCellWidth, sourceCellHeight) {
  const sourceCellX = column * sourceCellWidth;
  const sourceCellY = row * sourceCellHeight;
  const bounds = findContentBounds(source, sourceCellX, sourceCellY, sourceCellWidth, sourceCellHeight);
  if (!bounds) return false;

  const maxWidth = TARGET_FRAME_WIDTH - CELL_PADDING_X * 2;
  const maxHeight = TARGET_FRAME_HEIGHT - CELL_PADDING_Y * 2;
  const scale = Math.min(1, maxWidth / bounds.width, maxHeight / bounds.height);
  const drawWidth = Math.max(1, Math.round(bounds.width * scale));
  const drawHeight = Math.max(1, Math.round(bounds.height * scale));
  const targetCellX = column * TARGET_FRAME_WIDTH;
  const targetCellY = row * TARGET_FRAME_HEIGHT;
  const drawX = targetCellX + Math.round((TARGET_FRAME_WIDTH - drawWidth) / 2);
  let drawY = targetCellY + TARGET_FRAME_HEIGHT - BOTTOM_MARGIN_BY_ROW[row] - drawHeight;
  drawY = Math.max(targetCellY + CELL_PADDING_Y, Math.min(drawY, targetCellY + TARGET_FRAME_HEIGHT - drawHeight));

  for (let y = 0; y < drawHeight; y += 1) {
    const srcY = sourceCellY + bounds.minY + Math.min(bounds.height - 1, Math.floor(y / scale));
    const targetY = drawY + y;
    if (targetY < targetCellY || targetY >= targetCellY + TARGET_FRAME_HEIGHT) continue;

    for (let x = 0; x < drawWidth; x += 1) {
      const srcX = sourceCellX + bounds.minX + Math.min(bounds.width - 1, Math.floor(x / scale));
      const targetX = drawX + x;
      if (targetX < targetCellX || targetX >= targetCellX + TARGET_FRAME_WIDTH) continue;

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

function hasAlpha(image) {
  for (let i = 3; i < image.rgba.length; i += 4) {
    if (image.rgba[i] !== 255) return true;
  }
  return false;
}

function isLightNeutral(r, g, b) {
  return Math.min(r, g, b) >= 115 && Math.max(r, g, b) - Math.min(r, g, b) <= 80;
}

function makeExteriorMask(rgba, width, cellX, cellY, cellWidth, cellHeight) {
  const mask = new Uint8Array(cellWidth * cellHeight);
  const queue = [];

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= cellWidth || y >= cellHeight) return;
    const localIndex = y * cellWidth + x;
    if (mask[localIndex]) return;
    const alpha = rgba[pixelOffset(width, cellX + x, cellY + y) + 3];
    if (alpha > ALPHA_THRESHOLD) return;
    mask[localIndex] = 1;
    queue.push([x, y]);
  }

  for (let x = 0; x < cellWidth; x += 1) {
    enqueue(x, 0);
    enqueue(x, cellHeight - 1);
  }
  for (let y = 0; y < cellHeight; y += 1) {
    enqueue(0, y);
    enqueue(cellWidth - 1, y);
  }

  for (let i = 0; i < queue.length; i += 1) {
    const [x, y] = queue[i];
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return mask;
}

function isNearExterior(mask, cellWidth, cellHeight, x, y) {
  for (let dy = -DEFRINGE_EDGE_RADIUS; dy <= DEFRINGE_EDGE_RADIUS; dy += 1) {
    for (let dx = -DEFRINGE_EDGE_RADIUS; dx <= DEFRINGE_EDGE_RADIUS; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cellWidth || ny >= cellHeight) continue;
      if (mask[ny * cellWidth + nx]) return true;
    }
  }
  return false;
}

function findNearbySolidColor(source, width, cellX, cellY, cellWidth, cellHeight, x, y) {
  let totalWeight = 0;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (let radius = 1; radius <= DEFRINGE_RADIUS; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;

        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cellWidth || ny >= cellHeight) continue;

        const i = pixelOffset(width, cellX + nx, cellY + ny);
        const alpha = source[i + 3];
        if (alpha < DEFRINGE_OPAQUE_ALPHA) continue;
        if (isLightNeutral(source[i], source[i + 1], source[i + 2])) {
          continue;
        }

        const distance = Math.max(1, Math.hypot(dx, dy));
        const weight = alpha / distance;
        totalR += source[i] * weight;
        totalG += source[i + 1] * weight;
        totalB += source[i + 2] * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight > 0) {
      return {
        r: Math.round(totalR / totalWeight),
        g: Math.round(totalG / totalWeight),
        b: Math.round(totalB / totalWeight)
      };
    }
  }

  return null;
}

function defringeCellWhiteEdges(rgba, width, height, cellX, cellY, cellWidth, cellHeight) {
  const source = Buffer.from(rgba);
  const exteriorMask = makeExteriorMask(source, width, cellX, cellY, cellWidth, cellHeight);
  let changed = 0;

  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const i = pixelOffset(width, cellX + x, cellY + y);
      const alpha = source[i + 3];
      if (alpha <= ALPHA_THRESHOLD) {
        rgba[i] = 0;
        rgba[i + 1] = 0;
        rgba[i + 2] = 0;
        continue;
      }

      if (!isNearExterior(exteriorMask, cellWidth, cellHeight, x, y)) continue;
      const semiTransparentEdge = alpha < DEFRINGE_EDGE_ALPHA_MAX;
      const whiteEdge = isLightNeutral(source[i], source[i + 1], source[i + 2]);
      if (!semiTransparentEdge && !whiteEdge) continue;

      const color = findNearbySolidColor(source, width, cellX, cellY, cellWidth, cellHeight, x, y);
      if (!color) continue;

      rgba[i] = color.r;
      rgba[i + 1] = color.g;
      rgba[i + 2] = color.b;
      changed += 1;
    }
  }

  return changed;
}

function defringeWhiteEdges(rgba, width, height) {
  let changed = 0;
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      changed += defringeCellWhiteEdges(
        rgba,
        width,
        height,
        column * TARGET_FRAME_WIDTH,
        row * TARGET_FRAME_HEIGHT,
        TARGET_FRAME_WIDTH,
        TARGET_FRAME_HEIGHT
      );
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

function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Source image not found: ${SOURCE_PATH}`);
  }

  const source = parsePng(SOURCE_PATH);
  if (source.width % COLUMNS !== 0 || source.height % ROWS !== 0) {
    throw new Error(`Source image must be divisible into ${COLUMNS}x${ROWS} equal cells. Got ${source.width}x${source.height}.`);
  }

  const sourceCellWidth = source.width / COLUMNS;
  const sourceCellHeight = source.height / ROWS;
  const outputWidth = COLUMNS * TARGET_FRAME_WIDTH;
  const outputHeight = ROWS * TARGET_FRAME_HEIGHT;
  const output = Buffer.alloc(outputWidth * outputHeight * 4, 0);
  let copiedFrames = 0;

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < USED_FRAMES_BY_ROW[row]; column += 1) {
      if (copyCellToTarget(source, output, row, column, sourceCellWidth, sourceCellHeight)) {
        copiedFrames += 1;
      }
    }
  }

  const defringedPixels = ENABLE_DEFRINGE ? defringeWhiteEdges(output, outputWidth, outputHeight) : 0;

  fs.writeFileSync(OUTPUT_PATH, encodeRgbaPng(outputWidth, outputHeight, output));
  fs.writeFileSync(PREVIEW_PATH, encodeRgbaPng(outputWidth, outputHeight, makePreview(output, outputWidth, outputHeight)));

  console.log("Equal-cell extension conversion complete.");
  console.log(`Source image:    ${source.width}x${source.height}`);
  console.log(`Source cell:     ${sourceCellWidth}x${sourceCellHeight}`);
  console.log(`Source alpha:    ${hasAlpha(source) ? "yes" : "no"}`);
  console.log(`Output image:    ${outputWidth}x${outputHeight}`);
  console.log(`Output cell:     ${TARGET_FRAME_WIDTH}x${TARGET_FRAME_HEIGHT}`);
  console.log(`Copied frames:   ${copiedFrames}`);
  console.log(`Defringed pixels:${defringedPixels}`);
  console.log("Output alpha:    yes, RGBA PNG");
  console.log(`Output:          ${OUTPUT_PATH}`);
  console.log(`Preview:         ${PREVIEW_PATH}`);
}

try {
  main();
} catch (error) {
  console.error(`Conversion failed: ${error.message}`);
  process.exitCode = 1;
}
