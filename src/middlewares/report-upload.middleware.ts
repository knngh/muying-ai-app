import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { AppError, ErrorCodes } from './error.middleware';
import { reportDocumentBody } from '../schemas/report-document.schema';

// Kept outside the public uploads directory and excluded from source/build contexts.
export const PRIVATE_REPORT_ROOT = path.resolve(process.cwd(), 'private-uploads');
const formats: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const parser = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, callback) => {
      try {
        if (!req.userId || !/^\d+$/.test(req.userId)) throw new AppError('请先登录', ErrorCodes.TOKEN_INVALID, 401);
        const destination = path.join(PRIVATE_REPORT_ROOT, req.userId, 'reports');
        await fs.mkdir(destination, { recursive: true, mode: 0o700 });
        callback(null, destination);
      } catch (error) { callback(error as Error, ''); }
    },
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}.${formats[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 4, fieldSize: 4096, parts: 5 },
  fileFilter: (_req, file, callback) => {
    if (formats[file.mimetype]) callback(null, true);
    else callback(new AppError('报告支持 JPG、PNG、WebP 图片', ErrorCodes.PARAM_ERROR, 400));
  },
}).single('file');

export function resolveReportPath(key: string, userId: string): string {
  if (!/^\d+$/.test(userId) || !new RegExp(`^${userId}/reports/[a-f0-9-]+\\.(jpg|png|webp)$`).test(key)) {
    throw new AppError('报告原图不存在', ErrorCodes.PARAM_ERROR, 404);
  }
  return path.join(PRIVATE_REPORT_ROOT, key);
}

export async function removeReportFile(filePath: string): Promise<void> {
  try { await fs.unlink(filePath); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

export const uploadReportDocument = (req: Request, res: Response, next: NextFunction) => {
  parser(req, res, async (error?: unknown) => {
    try {
      if (error) throw error;
      const parsed = reportDocumentBody.safeParse(req.body);
      if (!parsed.success) throw new AppError('请检查报告名称、日期和备注', ErrorCodes.PARAM_ERROR, 400);
      req.body = parsed.data;
      if (req.file) {
        await fs.chmod(req.file.path, 0o600);
        // Validate by decoding, but never resize/re-encode the archived original.
        const image = sharp(req.file.path, { limitInputPixels: 40_000_000, failOn: 'warning' });
        const metadata = await image.metadata();
        const expected = req.file.mimetype === 'image/jpeg' ? 'jpeg' : formats[req.file.mimetype];
        if (metadata.format !== expected || (metadata.pages || 1) !== 1) throw new Error('invalid image');
        await image.stats();
      }
      next();
    } catch (failure) {
      if (req.file) await removeReportFile(req.file.path).catch(() => undefined);
      if (failure instanceof AppError) next(failure);
      else if (failure instanceof multer.MulterError && failure.code === 'LIMIT_FILE_SIZE') {
        next(new AppError('图片大小不能超过 8MB', ErrorCodes.PARAM_ERROR, 413));
      } else next(new AppError('报告图片无效或上传失败，请重新选择', ErrorCodes.PARAM_ERROR, 400));
    }
  });
};
