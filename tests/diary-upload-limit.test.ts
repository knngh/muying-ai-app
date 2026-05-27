import {
  getDiaryUploadCurrentImageCount,
  hasDiaryUploadSlot,
  parseDiaryUploadImageUrls,
} from '../src/services/diary-upload-limit.service';

describe('diary upload limit helpers', () => {
  const imageUrls = [
    '/uploads/1710000000000-aabbccddeeff0001.jpg',
    '/uploads/1710000000000-aabbccddeeff0002.webp',
    '/uploads/1710000000000-aabbccddeeff0003.png',
  ];

  it('parses multipart imageUrls JSON from upload requests', () => {
    expect(parseDiaryUploadImageUrls(JSON.stringify(imageUrls.slice(0, 2)))).toEqual(imageUrls.slice(0, 2));
    expect(parseDiaryUploadImageUrls(undefined)).toEqual([]);
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
