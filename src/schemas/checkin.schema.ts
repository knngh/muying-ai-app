import { z } from 'zod';

export const pointsLogQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const redeemPointsBody = z.object({
  points: z.coerce.number()
    .int('points 必须为整数')
    .min(100, '兑换范围：100~3000积分')
    .max(3000, '兑换范围：100~3000积分')
    .refine(value => value % 100 === 0, '兑换积分必须是100的整数倍'),
});
