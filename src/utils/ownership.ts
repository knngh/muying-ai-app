import { AppError, ErrorCodes } from '../middlewares/error.middleware';

/**
 * 校验资源所有权，防止越权操作
 * @param resourceUserId 资源所属用户 ID（支持 string 或 bigint）
 * @param requestUserId 当前请求用户 ID
 */
export function assertOwnership(
  resourceUserId: string | bigint,
  requestUserId: string
): void {
  if (resourceUserId.toString() !== requestUserId) {
    throw new AppError('无权操作此资源', ErrorCodes.NO_PERMISSION, 403);
  }
}
