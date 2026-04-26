import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer, { FileFilterCallback } from 'multer';
import { AppError, ErrorCodes } from './error.middleware';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const uploadImage = (req: Request, res: Response, next: NextFunction) => {
  uploadSingleImage(req, res, async (error?: unknown) => {
    if (error) {
      next(normalizeUploadError(error));
      return;
    }

    const file = req.file;
    if (!file) {
      next();
      return;
    }

    try {
      const valid = await hasValidImageSignature(file.path, file.mimetype);
      if (!valid) {
        await removeUploadedFile(file.path);
        next(new AppError('图片文件内容与格式不匹配', ErrorCodes.PARAM_ERROR, 400));
        return;
      }

      next();
    } catch (err) {
      await removeUploadedFile(file.path);
      next(err);
    }
  });
};

export function normalizeUploadError(error: unknown): unknown {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new AppError('图片大小不能超过 2MB', ErrorCodes.PARAM_ERROR, 413);
    }

    return new AppError('图片上传失败', ErrorCodes.PARAM_ERROR, 400);
  }

  return error;
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = getExtensionForMimeType(file.mimetype);
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const imageMimeExtensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const allowedImageMimeTypes = new Set(Object.keys(imageMimeExtensions));

export function getExtensionForMimeType(mimeType: string): string {
  return imageMimeExtensions[mimeType] || '.bin';
}

async function removeUploadedFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Best-effort cleanup. The upload request should fail with the original validation error.
  }
}

export async function hasValidImageSignature(filePath: string, mimeType: string): Promise<boolean> {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead);

    if (mimeType === 'image/jpeg') {
      return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    }

    if (mimeType === 'image/png') {
      return header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }

    if (mimeType === 'image/gif') {
      const signature = header.subarray(0, 6).toString('ascii');
      return signature === 'GIF87a' || signature === 'GIF89a';
    }

    if (mimeType === 'image/webp') {
      return header.length >= 12
        && header.subarray(0, 4).toString('ascii') === 'RIFF'
        && header.subarray(8, 12).toString('ascii') === 'WEBP';
    }

    return false;
  } finally {
    await handle.close();
  }
}

const uploadSingleImage = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (allowedImageMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new AppError('仅支持 JPG、PNG、GIF、WebP 格式的图片', ErrorCodes.PARAM_ERROR, 400));
  },
}).single('file');
