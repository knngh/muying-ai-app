import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import { calculateDueDateFromPregnancyWeek } from '../utils/pregnancy';

const prisma = new PrismaClient();

const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') } as any
  );
};

export const wechatLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, pregnancyWeek } = req.body;

    if (!code) {
      throw new AppError('缺少微信登录凭证', ErrorCodes.PARAM_ERROR, 400);
    }

    const appId = process.env.WECHAT_APPID;
    const appSecret = process.env.WECHAT_APPSECRET;

    if (!appId || !appSecret) {
      console.warn('⚠️ 未配置 WECHAT_APPID 或 WECHAT_APPSECRET，使用模拟登录');
      // 开发阶段模拟登录逻辑
      const mockOpenid = 'mock_openid_' + code.substring(0, 10);
      let user = await prisma.user.findUnique({ where: { openid: mockOpenid } });

      const dueDate = calculateDueDateFromPregnancyWeek(pregnancyWeek);
      const pregnancyStatus = dueDate ? 2 : 0;

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: req.ip,
            pregnancyStatus: pregnancyWeek ? pregnancyStatus : user.pregnancyStatus,
            dueDate: pregnancyWeek ? dueDate : user.dueDate
          }
        });
      } else {
        const randomPassword = Math.random().toString(36).slice(-8);
        const passwordHash = await require('bcryptjs').hash(randomPassword, 10);
        const randomUsername = `wxuser_${Math.random().toString(36).slice(2, 8)}`;

        user = await prisma.user.create({
          data: {
            openid: mockOpenid,
            username: randomUsername,
            nickname: '微信用户',
            passwordHash,
            pregnancyStatus,
            dueDate
          }
        });
      }

      const token = generateToken(user.id.toString());
      return res.json(successResponse({
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          pregnancyStatus: user.pregnancyStatus,
          dueDate: user.dueDate
        },
        token
      }, '微信登录成功(模拟)'));
    }

    // 真实的微信接口请求逻辑
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    const wxResponse = await axios.get(wxUrl);
    
    if (wxResponse.data.errcode) {
      console.error('WeChat API Error:', wxResponse.data);
      throw new AppError('微信登录失败: ' + wxResponse.data.errmsg, ErrorCodes.THIRD_PARTY_ERROR, 401);
    }

    const { openid } = wxResponse.data;

    const dueDate = calculateDueDateFromPregnancyWeek(pregnancyWeek);
    const pregnancyStatus = dueDate ? 2 : 0;

    let user = await prisma.user.findUnique({ where: { openid } });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: req.ip,
          pregnancyStatus: pregnancyWeek ? pregnancyStatus : user.pregnancyStatus,
          dueDate: pregnancyWeek ? dueDate : user.dueDate
        }
      });
    } else {
      const randomPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await require('bcryptjs').hash(randomPassword, 10);
      const randomUsername = `wxuser_${Math.random().toString(36).slice(2, 8)}`;

      user = await prisma.user.create({
        data: {
          openid,
          username: randomUsername,
          nickname: '微信用户',
          passwordHash,
          pregnancyStatus,
          dueDate
        }
      });
    }

    const token = generateToken(user.id.toString());

    res.json(successResponse({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        pregnancyStatus: user.pregnancyStatus,
        dueDate: user.dueDate
      },
      token
    }, '微信登录成功'));

  } catch (error) {
    next(error);
  }
};
