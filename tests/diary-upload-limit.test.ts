import {
  getDiaryUploadCurrentImageCount,
  hasDiaryUploadSlot,
  parseDiaryUploadImageUrls,
} from '../src/services/diary-upload-limit.service';

describe('diary upload limit helpers', () => {
  const originalCosBaseUrl = process.env.COS_PUBLIC_BASE_URL;
  const originalCosUploadPrefix = process.env.COS_UPLOAD_PREFIX;
  const imageUrls = [
    '/uploads/1710000000000-aabbccddeeff0001.jpg',
    '/uploads/1710000000000-aabbccddeeff0002.webp',
    '/uploads/1710000000000-aabbccddeeff0003.png',
  ];

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

  it('parses multipart imageUrls JSON from upload requests', () => {
    expect(parseDiaryUploadImageUrls(JSON.stringify(imageUrls.slice(0, 2)))).toEqual(imageUrls.slice(0, 2));
    expect(parseDiaryUploadImageUrls(undefined)).toEqual([]);
  });

  it('accepts configured COS diary image URLs', () => {
    const cosUrl = 'https://beihu-1304335890.cos.ap-shanghai.myqcloud.com/diary/2026/05/1710000000000-aabbccddeeff0001.jpg';

    expect(parseDiaryUploadImageUrls(JSON.stringify([cosUrl]))).toEqual([cosUrl]);
  });

  it('rejects malformed or excessive upload image lists', () => {
    expect(() => parseDiaryUploadImageUrls('not-json')).toThrow('照片列表格式无效');
    expect(() => parseDiaryUploadImageUrls(['https://example.com/image.jpg'])).toThrow('照片地址无效');
    expect(() => parseDiaryUploadImageUrls([...imageUrls, '/uploads/1710000000000-aabbccddeeff0004.gif']))
      .toThrow('最多添加3张照片');
  });

  it('uses the current draft count when the client sends draft imageUrls', () => {
    expect(getDiaryUploadCurrentImageCount({
      draftImageUrlsProvided: true,
      draftImageUrls: imageUrls.slice(0, 2),
      existingImageUrls: imageUrls,
    })).toBe(2);
    expect(hasDiaryUploadSlot(2)).toBe(true);
    expect(hasDiaryUploadSlot(3)).toBe(false);
  });

  it('falls back to saved diary image count for legacy upload clients', () => {
    expect(getDiaryUploadCurrentImageCount({
      draftImageUrlsProvided: false,
      draftImageUrls: [],
      existingImageUrls: imageUrls,
    })).toBe(3);
  });
});
