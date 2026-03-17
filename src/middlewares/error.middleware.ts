import { Request, Response, NextFunction } from 'express';

// 统一响应格式
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

// 错误码定义
export const ErrorCodes = {
  SUCCESS: 0,
  PARAM_ERROR: 1001,
  PARAM_FORMAT_ERROR: 1002,
  USER_NOT_FOUND: 2001,
  PASSWORD_ERROR: 2002,
  USER_EXISTS: 2003,
  PHONE_REGISTERED: 2004,
  TOKEN_INVALID: 2005,
  TOKEN_EXPIRED: 2006,
  ARTICLE_NOT_FOUND: 3001,
  CATEGORY_NOT_FOUND: 3002,
  TAG_NOT_FOUND: 3003,
  NO_PERMISSION: 4001,
  SERVER_ERROR: 5001,
  DB_ERROR: 5002,
  THIRD_PARTY_ERROR: 5003
} as const;

// 自定义错误类
export class AppError extends Error {
  public code: number;
  public statusCode: number;
  public errors?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    code: number = ErrorCodes.SERVER_ERROR,
    statusCode: number = 500,
    errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'AppError';
  }
}

// 404 处理
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError('资源不存在', ErrorCodes.SERVER_ERROR, 404);
  next(error);
};

// 全局错误处理
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    const response: ApiResponse = {
      code: err.code,
      message: err.message
    };
    if (err.errors) {
      response.errors = err.errors;
    }
    return res.status(err.statusCode).json(response);
  }

  // 未知错误
  return res.status(500).json({
    code: ErrorCodes.SERVER_ERROR,
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
  });
};

// 成功响应辅助函数
export const successResponse = <T>(data: T, message: string = 'success'): ApiResponse<T> => ({
  code: 0,
  message,
  data
});

// 分页响应辅助函数
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  pagination: PaginationMeta;
}

export const paginatedResponse = <T>(
  list: T[],
  page: number,
  pageSize: number,
  total: number
): ApiResponse<PaginatedResponse<T>> => ({
  code: 0,
  message: 'success',
  data: {
    list,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  }
});