import path from 'path';
import {
  getRemovedDiaryImageUrls,
  resolveDiaryUploadFilePath,
} from '../src/services/diary-image-cleanup.service';

describe('diary image cleanup helpers', () => {
  it('returns unique upload URLs removed from a diary', () => {
    expect(getRemovedDiaryImageUrls([
      '/uploads/1710000000000-aabbccddeeff0011.jpg',
      '/uploads/1710000000000-aabbccddeeff0011.jpg',
      '/uploads/1710000000000-aabbccddeeff0012.png',
      'https://example.com/remote.jpg',
    ], [
      '/uploads/1710000000000-aabbccddeeff0012.png',
      '/uploads/1710000000000-aabbccddeeff0013.webp',
    ])).toEqual(['/uploads/1710000000000-aabbccddeeff0011.jpg']);
  });

  it('resolves valid upload URLs into the uploads directory only', () => {
    const filePath = resolveDiaryUploadFilePath('/uploads/1710000000000-aabbccddeeff0011.jpg');

    expect(filePath).toBe(path.resolve(process.cwd(), 'uploads', '1710000000000-aabbccddeeff0011.jpg'));
    expect(resolveDiaryUploadFilePath('/uploads/../secret.jpg')).toBeNull();
    expect(resolveDiaryUploadFilePath('https://example.com/remote.jpg')).toBeNull();
  });
});
