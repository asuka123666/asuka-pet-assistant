const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const COLUMNS = 8;
const ORIGINAL_ROWS = 9;
const EXTENSION_ROWS = 7;

const originalPath = path.join(__dirname, "pet-spritesheet.png");
const extensionPath = path.join(__dirname, "pet-spritesheet-extension.png");
const outputPath = path.join(__dirname, "pet-spritesheet-16rows.png");

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

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
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
    throw new Error(`Unsupported PNG bit depth ${bitDepth} in ${filePath}. Expected 8-bit PNG.`);
  }
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) {
    throw new Error(`Unsupported PNG format in ${filePath}. Expected non-interlaced standard PNG.`);
  }

  const channels = channelsForColorType(colorType);
  const bytesPerPixel = Math.max(1, channels);
  const rowBytes = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const expectedBytes = (rowBytes + 1) * height;
  if (inflated.length < expectedBytes) {
    throw new Error(`PNG data is shorter than expected in ${filePath}.`);
  }

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
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;

      if (filter === 1) current[x] = (current[x] + left) & 0xff;
      else if (filter === 2) current[x] = (current[x] + up) & 0xff;
      else if (filter === 3) current[x] = (current[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) current[x] = (current[x] + paethPredictor(left, up, upLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter} in ${filePath}.`);
    }

    current.copy(raw, dst);
    dst += rowBytes;
    previous = current;
  }

  return {
    width,
    height,
    rgba: toRgba(raw, width, height, colorType, palette, transparency)
  };
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

function copyRows(source, target, targetWidth, targetY) {
  const rowBytes = source.width * 4;
  for (let y = 0; y < source.height; y += 1) {
    const sourceStart = y * rowBytes;
    const targetStart = ((targetY + y) * targetWidth) * 4;
    source.rgba.copy(target, targetStart, sourceStart, sourceStart + rowBytes);
  }
}

function main() {
  assertFileExists(originalPath, "Original sprite sheet");
  assertFileExists(extensionPath, "Extension sprite sheet");

  const original = parsePng(originalPath);
  const extension = parsePng(extensionPath);

  if (original.width % COLUMNS !== 0) {
    throw new Error(`Original width ${original.width} is not divisible by ${COLUMNS}.`);
  }
  if (original.height % ORIGINAL_ROWS !== 0) {
    throw new Error(`Original height ${original.height} is not divisible by ${ORIGINAL_ROWS}.`);
  }

  const frameWidth = original.width / COLUMNS;
  const frameHeight = original.height / ORIGINAL_ROWS;
  const expectedExtensionHeight = frameHeight * EXTENSION_ROWS;

  if (extension.width !== original.width) {
    throw new Error(`Extension width ${extension.width} does not match original width ${original.width}. Refusing to resize.`);
  }
  if (extension.height !== expectedExtensionHeight) {
    throw new Error(`Extension height ${extension.height} is not ${EXTENSION_ROWS} rows (${expectedExtensionHeight}px). Refusing to resize.`);
  }

  const finalWidth = original.width;
  const finalHeight = original.height + extension.height;
  const merged = Buffer.alloc(finalWidth * finalHeight * 4, 0);
  copyRows(original, merged, finalWidth, 0);
  copyRows(extension, merged, finalWidth, original.height);

  fs.writeFileSync(outputPath, encodeRgbaPng(finalWidth, finalHeight, merged));

  console.log("Spritesheet merge complete.");
  console.log(`Original image:  ${original.width}x${original.height}`);
  console.log(`Extension image: ${extension.width}x${extension.height}`);
  console.log(`Final image:     ${finalWidth}x${finalHeight}`);
  console.log(`Frame size:      ${frameWidth}x${frameHeight}`);
  console.log(`Total rows:      ${finalHeight / frameHeight}`);
  console.log("Alpha channel:   preserved as RGBA PNG");
  console.log(`Output:          ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(`Merge failed: ${error.message}`);
  process.exitCode = 1;
}
