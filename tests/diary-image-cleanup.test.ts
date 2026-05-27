import path from 'path';
import {
  getRemovedDiaryImageUrls,
  resolveDiaryUploadFilePath,
} from '../src/services/diary-image-cleanup.service';
import { resolveCosObjectKeyFromPublicUrl } from '../src/services/cos-storage.service';

describe('diary image cleanup helpers', () => {
  const originalCosBaseUrl = process.env.COS_PUBLIC_BASE_URL;
  const originalCosUploadPrefix = process.env.COS_UPLOAD_PREFIX;

  beforeEach(() => {
    process.env.COS_PUBLIC_BASE_URL = 'https://beihu-1304335890.cos.ap-shanghai.myqcloud.com';
    process.env.COS_UPLOAD_PREFIX = 'diary';
  });

  afterAll(() => {
    if (originalCosBaseUrl === undefined) {
      delete process.env.COS_PUBLIC_BASE_URL;
    } else {
      process.env.COS_PUBLIC_BASE_URL = originalCosBaseUrl;
    }
    if (originalCosUploadPrefix === undefined) {
      delete process.env.COS_UPLOAD_PREFIX;
    } else {
      process.env.COS_UPLOAD_PREFIX = originalCosUploadPrefix;
    }
  });

  it('returns unique upload URLs removed from a diary', () => {
    const cosUrl = 'https://beihu-1304335890.cos.ap-shanghai.myqcloud.com/diary/2026/05/1710000000000-aabbccddeeff0014.jpg';

    expect(getRemovedDiaryImageUrls([
      '/uploads/1710000000000-aabbccddeeff0011.jpg',
      '/uploads/1710000000000-aabbccddeeff0011.jpg',
      '/uploads/1710000000000-aabbccddeeff0012.png',
      cosUrl,
      'https://example.com/remote.jpg',
    ], [
      '/uploads/1710000000000-aabbccddeeff0012.png',
      '/uploads/1710000000000-aabbccddeeff0013.webp',
    ])).toEqual(['/uploads/1710000000000-aabbccddeeff0011.jpg', cosUrl]);
  });

  it('resolves valid upload URLs into the uploads directory only', () => {
    const filePath = resolveDiaryUploadFilePath('/uploads/1710000000000-aabbccddeeff0011.jpg');

    expect(filePath).toBe(path.resolve(process.cwd(), 'uploads', '1710000000000-aabbccddeeff0011.jpg'));
    expect(resolveDiaryUploadFilePath('/uploads/../secret.jpg')).toBeNull();
    expect(resolveDiaryUploadFilePath('https://example.com/remote.jpg')).toBeNull();
  });

  it('resolves configured COS diary object keys only', () => {
    expect(resolveCosObjectKeyFromPublicUrl(
      'https://beihu-1304335890.cos.ap-shanghai.myqcloud.com/diary/2026/05/1710000000000-aabbccddeeff0011.jpg',
    )).toBe('diary/2026/05/1710000000000-aabbccddeeff0011.jpg');
    expect(resolveCosObjectKeyFromPublicUrl(
      'https://beihu-1304335890.cos.ap-shanghai.myqcloud.com/private/1710000000000-aabbccddeeff0011.jpg',
    )).toBeNull();
  });
});
