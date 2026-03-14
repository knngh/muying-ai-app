import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';

const prisma = new PrismaClient();

// 生成 JWT Token
const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// 用户注册
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password, phone, email } = req.body;

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

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        phone,
        email
      },
      select: {
        id: true,
        username: true,
        phone: true,
        email: true,
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

    const user = await prisma.user.update({
      where: { id: BigInt(userId!) },
      data: {
        nickname,
        avatar,
        pregnancyStatus,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        babyBirthday: babyBirthday ? new Date(babyBirthday) : undefined,
        babyGender
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        pregnancyStatus: true,
        dueDate: true,
        babyBirthday: true,
        babyGender: true
      }
    });

    res.json(successResponse(user, '更新成功'));
  } catch (error) {
    next(error);
  }
};