import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {
  compressUploadedImage,
  getExtensionForMimeType,
  hasValidImageSignature,
  normalizeUploadError,
} from '../src/middlewares/upload.middleware';
import { AppError, ErrorCodes } from '../src/middlewares/error.middleware';
import multer from 'multer';

describe('upload image validation', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-validation-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeFixture(name: string, bytes: number[] | string): Promise<string> {
    const filePath = path.join(tmpDir, name);
    await fs.writeFile(filePath, typeof bytes === 'string' ? bytes : Buffer.from(bytes));
    return filePath;
  }

  async function buildMulterFile(name: string, mimetype: string): Promise<Express.Multer.File> {
    const filePath = path.join(tmpDir, name);
    const stats = await fs.stat(filePath);

    return {
      fieldname: 'image',
      originalname: name,
      encoding: '7bit',
      mimetype,
      destination: tmpDir,
      filename: name,
      path: filePath,
      size: stats.size,
    } as Express.Multer.File;
  }

  it('uses server-controlled extensions from MIME type', () => {
    expect(getExtensionForMimeType('image/jpeg')).toBe('.jpg');
    expect(getExtensionForMimeType('image/png')).toBe('.png');
    expect(getExtensionForMimeType('image/gif')).toBe('.gif');
    expect(getExtensionForMimeType('image/webp')).toBe('.webp');
    expect(getExtensionForMimeType('text/html')).toBe('.bin');
  });

  it('accepts valid image signatures', async () => {
    const jpeg = await writeFixture('avatar.jpg', [0xff, 0xd8, 0xff, 0xe0]);
    const png = await writeFixture('avatar.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const gif = await writeFixture('avatar.gif', 'GIF89a');
    const webp = await writeFixture('avatar.webp', 'RIFFxxxxWEBP');

    await expect(hasValidImageSignature(jpeg, 'image/jpeg')).resolves.toBe(true);
    await expect(hasValidImageSignature(png, 'image/png')).resolves.toBe(true);
    await expect(hasValidImageSignature(gif, 'image/gif')).resolves.toBe(true);
    await expect(hasValidImageSignature(webp, 'image/webp')).resolves.toBe(true);
  });

  it('rejects spoofed MIME types', async () => {
    const spoofed = await writeFixture('avatar.jpg', '<html>not an image</html>');

    await expect(hasValidImageSignature(spoofed, 'image/jpeg')).resolves.toBe(false);
    await expect(hasValidImageSignature(spoofed, 'image/png')).resolves.toBe(false);
  });

  it('maps oversized uploads to a stable API error', () => {
    const error = normalizeUploadError(new multer.MulterError('LIMIT_FILE_SIZE'));

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ErrorCodes.PARAM_ERROR);
    expect((error as AppError).statusCode).toBe(413);
    expect((error as AppError).message).toBe('图片大小不能超过 8MB');
  });

  it('resizes uploaded images and normalizes non-alpha images to jpeg', async () => {
    const sourcePath = path.join(tmpDir, 'diary.webp');
    await sharp({
      create: {
        width: 2200,
        height: 1200,
        channels: 3,
        background: '#8ac8ff',
      },
    }).webp({ quality: 95 }).toFile(sourcePath);
    const file = await buildMulterFile('diary.webp', 'image/webp');

    await compressUploadedImage(file);

    expect(file.filename).toBe('diary.jpg');
    expect(file.mimetype).toBe('image/jpeg');
    await expect(fs.access(sourcePath)).rejects.toThrow();
    await expect(fs.access(file.path)).resolves.toBeUndefined();

    const metadata = await sharp(file.path).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(Math.max(metadata.width || 0, metadata.height || 0)).toBeLessThanOrEqual(1600);
    expect(file.size).toBeGreaterThan(0);
  });

  it('keeps transparent png uploads as png', async () => {
    const sourcePath = path.join(tmpDir, 'transparent.png');
    await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.35 },
      },
    }).png().toFile(sourcePath);
    const file = await buildMulterFile('transparent.png', 'image/png');

    await compressUploadedImage(file);

    expect(file.filename).toBe('transparent.png');
    expect(file.mimetype).toBe('image/png');
    const metadata = await sharp(file.path).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.hasAlpha).toBe(true);
  });
});
