import { resolveCosObjectKeyFromPublicUrl } from '../services/cos-storage.service';

export const LOCAL_DIARY_IMAGE_URL_PATTERN = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|gif|webp)$/i;

export function isDiaryImageUrl(url: string): boolean {
  return LOCAL_DIARY_IMAGE_URL_PATTERN.test(url) || Boolean(resolveCosObjectKeyFromPublicUrl(url));
}
