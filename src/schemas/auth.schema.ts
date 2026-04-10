import { z } from 'zod';

const dateString = z.string().refine((value) => {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  if (isDateOnly) {
    return !Number.isNaN(new Date(`${normalized}T00:00:00.000Z`).getTime());
  }

  return !Number.isNaN(new Date(normalized).getTime());
}, '日期格式错误');

export const registerBody = z.object({
  username: z.string().min(2, '用户名至少2个字符').max(20, '用户名最多20个字符'),
  password: z.string()
    .min(8, '密码至少8个字符')
    .max(64, '密码最多64个字符'),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式错误').optional(),
  email: z.string().email('邮箱格式错误').optional(),
  pregnancyWeek: z.coerce.number().int().min(1).max(42).optional(),
});

export const loginBody = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

export const updateProfileBody = z.object({
  nickname: z.string().min(1).max(30).optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式错误').optional().nullable(),
  email: z.string().email('邮箱格式错误').optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  pregnancyStatus: z.coerce.number().int().min(0).max(3).optional(),
  dueDate: dateString.optional().nullable(),
  babyBirthday: dateString.optional().nullable(),
  babyGender: z.coerce.number().int().min(0).max(2).optional(),
  caregiverRole: z.coerce.number().int().min(0).max(4).optional(),
  childNickname: z.string().min(1).max(30).optional().nullable(),
  childBirthMode: z.coerce.number().int().min(0).max(2).optional(),
  feedingMode: z.coerce.number().int().min(0).max(4).optional(),
  developmentConcerns: z.string().min(1).max(200).optional().nullable(),
  familyNotes: z.string().min(1).max(500).optional().nullable(),
}).refine(data => Object.keys(data).length > 0, {
  message: '请提供至少一个需要更新的字段',
});

export const changePasswordBody = z.object({
  oldPassword: z.string().min(1, '请输入旧密码'),
  newPassword: z.string()
    .min(8, '新密码至少8个字符')
    .max(64, '新密码最多64个字符'),
});

export const wechatLoginBody = z.object({
  code: z.string().min(1, '微信登录code不能为空'),
  pregnancyWeek: z.coerce.number().int().min(1).max(42).optional(),
});

export const checkUsernameQuery = z.object({
  username: z.string().min(1, '用户名不能为空').max(20),
});

export const checkPhoneQuery = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式错误'),
});
