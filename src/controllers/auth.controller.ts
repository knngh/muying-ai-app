import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import { calculateDueDateFromPregnancyWeek, normalizeGender, normalizePregnancyStatus } from '../utils/pregnancy';

const prisma = new PrismaClient();

// 生成 JWT Token
const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') } as any
  );
};

// 用户注册
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password, phone, email, pregnancyWeek } = req.body;

    // 验证必填字段
    if (!username || !password) {
      throw new AppError('用户名和密码不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : [])
        ]
      }
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new AppError('用户名已存在', ErrorCodes.USER_EXISTS, 400);
      }
      if (existingUser.phone === phone) {
        throw new AppError('手机号已注册', ErrorCodes.PHONE_REGISTERED, 400);
      }
      throw new AppError('邮箱已注册', ErrorCodes.USER_EXISTS, 400);
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    const dueDate = calculateDueDateFromPregnancyWeek(pregnancyWeek);
    const pregnancyStatus = dueDate ? 2 : 0;

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        nickname: username,
        phone,
        email,
        pregnancyStatus,
        dueDate
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        phone: true,
        email: true,
        gender: true,
        birthday: true,
        pregnancyStatus: true,
        dueDate: true,
        babyBirthday: true,
        babyGender: true,
        createdAt: true
      }
    });

    const token = generateToken(user.id.toString());

    res.status(201).json(successResponse({
      user,
      token
    }, '注册成功'));
  } catch (error) {
    next(error);
  }
};

// 用户登录
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new AppError('用户名和密码不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { phone: username },
          { email: username }
        ]
      }
    });

    if (!user) {
      throw new AppError('用户不存在', ErrorCodes.USER_NOT_FOUND, 401);
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('密码错误', ErrorCodes.PASSWORD_ERROR, 401);
    }

    // 更新最后登录信息
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip
      }
    });

    const token = generateToken(user.id.toString());

    res.json(successResponse({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        email: user.email,
        pregnancyStatus: user.pregnancyStatus,
        dueDate: user.dueDate
      },
      token
    }, '登录成功'));
  } catch (error) {
    next(error);
  }
};

// 获取当前用户信息
export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId!) },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        phone: true,
        email: true,
        gender: true,
        birthday: true,
        pregnancyStatus: true,
        dueDate: true,
        babyBirthday: true,
        babyGender: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new AppError('用户不存在', ErrorCodes.USER_NOT_FOUND, 404);
    }

    res.json(successResponse(user));
  } catch (error) {
    next(error);
  }
};

// 刷新 Token
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token 无效', ErrorCodes.TOKEN_INVALID, 401);
    }

    const oldToken = authHeader.split(' ')[1];
    
    // 验证旧 token（即使过期也尝试解码）
    const decoded = jwt.decode(oldToken) as any;
    
    if (!decoded || !decoded.userId) {
      throw new AppError('Token 无效', ErrorCodes.TOKEN_INVALID, 401);
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: BigInt(decoded.userId) }
    });

    if (!user) {
      throw new AppError('用户不存在', ErrorCodes.USER_NOT_FOUND, 401);
    }

    const newToken = generateToken(user.id.toString());

    res.json(successResponse({ token: newToken }, 'Token 刷新成功'));
  } catch (error) {
    next(error);
  }
};

// 更新用户信息
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { nickname, avatar, pregnancyStatus, dueDate, babyBirthday, babyGender } = req.body;
    const normalizedPregnancyStatus = normalizePregnancyStatus(pregnancyStatus);
    const normalizedBabyGender = normalizeGender(babyGender);

    const user = await prisma.user.update({
      where: { id: BigInt(userId!) },
      data: {
        nickname,
        avatar,
        pregnancyStatus: normalizedPregnancyStatus,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        babyBirthday: babyBirthday ? new Date(babyBirthday) : undefined,
        babyGender: normalizedBabyGender
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        phone: true,
        email: true,
        gender: true,
        birthday: true,
        pregnancyStatus: true,
        dueDate: true,
        babyBirthday: true,
        babyGender: true,
        createdAt: true
      }
    });

    res.json(successResponse(user, '更新成功'));
  } catch (error) {
    next(error);
  }
};

// 修改密码
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      throw new AppError('请输入旧密码和新密码', ErrorCodes.PARAM_ERROR, 400);
    }

    // 验证新密码强度
    if (newPassword.length < 8) {
      throw new AppError('新密码长度不能少于8位', ErrorCodes.PARAM_ERROR, 400);
    }

    // 获取用户
    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId!) }
    });

    if (!user) {
      throw new AppError('用户不存在', ErrorCodes.USER_NOT_FOUND, 404);
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('旧密码错误', ErrorCodes.PASSWORD_ERROR, 400);
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await prisma.user.update({
      where: { id: BigInt(userId!) },
      data: { passwordHash: newPasswordHash }
    });

    res.json(successResponse(null, '密码修改成功'));
  } catch (error) {
    next(error);
  }
};

// 登出（可选：将token加入黑名单）
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // JWT是无状态的，登出只需客户端删除token
    // 如需服务端失效，可实现token黑名单（需要Redis）
    res.json(successResponse(null, '登出成功'));
  } catch (error) {
    next(error);
  }
};

// 检查用户名是否可用
export const checkUsername = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username } = req.query;

    if (!username || typeof username !== 'string') {
      throw new AppError('请输入用户名', ErrorCodes.PARAM_ERROR, 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    res.json(successResponse({
      available: !existingUser
    }));
  } catch (error) {
    next(error);
  }
};

// 检查手机号是否可用
export const checkPhone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
      throw new AppError('请输入手机号', ErrorCodes.PARAM_ERROR, 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone }
    });

    res.json(successResponse({
      available: !existingUser
    }));
  } catch (error) {
    next(error);
  }
};
