import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import {
  deleteCosObject,
  resolveCosObjectKeyFromPublicUrl,
} from './cos-storage.service';
import {
  isDiaryImageUrl,
  LOCAL_DIARY_IMAGE_URL_PATTERN,
} from '../utils/diary-image-url';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

export function getRemovedDiaryImageUrls(previousUrls: string[], nextUrls: string[]): string[] {
  const nextSet = new Set(nextUrls);
  return [...new Set(previousUrls.filter((url) => !nextSet.has(url) && isDiaryImageUrl(url)))];
}

export function resolveDiaryUploadFilePath(url: string): string | null {
  if (!LOCAL_DIARY_IMAGE_URL_PATTERN.test(url)) {
    return null;
  }

  const filePath = path.resolve(UPLOAD_DIR, path.basename(url));
  if (filePath !== UPLOAD_DIR && filePath.startsWith(`${UPLOAD_DIR}${path.sep}`)) {
    return filePath;
  }

  return null;
}

async function countDiaryImageReferences(url: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ referenceCount: bigint | number }>>`
    SELECT COUNT(*) AS referenceCount
    FROM user_pregnancy_diaries
    WHERE image_urls IS NOT NULL
      AND JSON_CONTAINS(image_urls, JSON_QUOTE(${url}))
  `;

  return Number(rows[0]?.referenceCount || 0);
}

export async function cleanupUnusedDiaryImages(urls: string[]): Promise<void> {
  const candidates = [...new Set(urls)].filter(isDiaryImageUrl);

  for (const url of candidates) {
    try {
      const referenceCount = await countDiaryImageReferences(url);
      if (referenceCount > 0) {
        continue;
      }

      const cosObjectKey = resolveCosObjectKeyFromPublicUrl(url);
      if (cosObjectKey) {
        await deleteCosObject(cosObjectKey);
        continue;
      }

      const filePath = resolveDiaryUploadFilePath(url);
      if (!filePath) {
        continue;
      }
      await fs.promises.unlink(filePath);
    } catch {
      // Best-effort cleanup: record updates should not fail because an old upload is missing.
    }
  }
}
