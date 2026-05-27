import { DIARY_IMAGE_URL_PATTERN } from './diary-image-cleanup.service';

export const MAX_DIARY_IMAGES_PER_WEEK = 3;

export function parseDiaryUploadImageUrls(value: unknown): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  let rawValue = value;
  if (typeof value === 'string') {
    try {
      rawValue = JSON.parse(value);
    } catch {
      throw new Error('照片列表格式无效');
    }
  }

  if (!Array.isArray(rawValue)) {
    throw new Error('照片列表格式无效');
  }

  if (rawValue.length > MAX_DIARY_IMAGES_PER_WEEK) {
    throw new Error(`最多添加${MAX_DIARY_IMAGES_PER_WEEK}张照片`);
  }

  return rawValue.map((item) => {
    if (typeof item !== 'string') {
      throw new Error('照片地址无效');
    }

    const url = item.trim();
    if (!DIARY_IMAGE_URL_PATTERN.test(url)) {
      throw new Error('照片地址无效');
    }
    return url;
  });
}

export function getDiaryUploadCurrentImageCount(input: {
  draftImageUrlsProvided: boolean;
  draftImageUrls: string[];
  existingImageUrls: string[];
}): number {
  return input.draftImageUrlsProvided
    ? input.draftImageUrls.length
    : input.existingImageUrls.length;
}

export function hasDiaryUploadSlot(currentImageCount: number): boolean {
  return currentImageCount < MAX_DIARY_IMAGES_PER_WEEK;
}
