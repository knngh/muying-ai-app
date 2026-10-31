import { ensurePhotoPrivacy } from '../mini-program/src/utils/photo-privacy';

type PrivacyOptions = { success: (result: { needAuthorization: boolean }) => void; fail: (error?: unknown) => void };
const setUni = (value: unknown) => { (globalThis as unknown as { uni: unknown }).uni = value; };

it('waits for explicit agreement before allowing photo access', async () => {
  setUni({ getPrivacySetting: (options: PrivacyOptions) => options.success({ needAuthorization: true }) });
  const consent = jest.fn().mockResolvedValue(false);
  expect(await ensurePhotoPrivacy(consent)).toBe(false);
  expect(consent).toHaveBeenCalledTimes(1);
  consent.mockResolvedValueOnce(true);
  expect(await ensurePhotoPrivacy(consent)).toBe(true);
});
it('allows already authorized users and platforms without the WeChat privacy API', async () => {
  const consent = jest.fn();
  setUni({});
  expect(await ensurePhotoPrivacy(consent)).toBe(true);
  setUni({ getPrivacySetting: (options: PrivacyOptions) => options.success({ needAuthorization: false }) });
  expect(await ensurePhotoPrivacy(consent)).toBe(true);
  expect(consent).not.toHaveBeenCalled();
});
it('keeps photo access closed when privacy state cannot be read', async () => {
  const consent = jest.fn();
  setUni({ getPrivacySetting: (options: PrivacyOptions) => options.fail({ errMsg: 'network' }) });
  expect(await ensurePhotoPrivacy(consent)).toBe(false);
  setUni({ getPrivacySetting: () => { throw new Error('unavailable'); } });
  expect(await ensurePhotoPrivacy(consent)).toBe(false);
  expect(consent).not.toHaveBeenCalled();
});
