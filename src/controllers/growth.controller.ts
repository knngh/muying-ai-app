import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, paginatedResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';

// 获取成长档案
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('未授权', ErrorCodes.TOKEN_INVALID, 401);

    const profile = await prisma.growthProfile.findUnique({
      where: { userId: BigInt(userId) },
    });

    res.json(successResponse(profile ? {
      id: profile.id.toString(),
      userId: profile.userId.toString(),
      name: profile.name,
      birthday: profile.birthday?.toISOString() || null,
      gender: profile.gender,
      stageHint: profile.stageHint,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    } : null));
  } catch (error) {
    next(error);
  }
};

// 创建或更新成长档案
export const upsertProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('未授权', ErrorCodes.TOKEN_INVALID, 401);

    const { name, birthday, gender, stageHint } = req.body;

    const profile = await prisma.growthProfile.upsert({
      where: { userId: BigInt(userId) },
      create: {
        userId: BigInt(userId),
        name: name || '宝宝',
        birthday: birthday ? new Date(birthday) : null,
        gender: gender ?? 0,
        stageHint: stageHint || null,
      },
      update: {
        ...(name !== undefined && { name }),
        ...(birthday !== undefined && { birthday: birthday ? new Date(birthday) : null }),
        ...(gender !== undefined && { gender }),
        ...(stageHint !== undefined && { stageHint }),
      },
    });

    res.json(successResponse({
      id: profile.id.toString(),
      userId: profile.userId.toString(),
      name: profile.name,
      birthday: profile.birthday?.toISOString() || null,
      gender: profile.gender,
      stageHint: profile.stageHint,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    }));
  } catch (error) {
    next(error);
  }
};

// 获取成长记录列表
export const getRecords = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('未授权', ErrorCodes.TOKEN_INVALID, 401);

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(Number(req.query.pageSize || 20), 50);
    const recordType = req.query.recordType ? String(req.query.recordType) : undefined;

    const where = {
      userId: BigInt(userId),
      ...(recordType && { recordType }),
    };

    const [records, total] = await Promise.all([
      prisma.growthRecord.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.growthRecord.count({ where }),
    ]);

    const list = records.map(r => ({
      id: r.id.toString(),
      userId: r.userId.toString(),
      profileId: r.profileId.toString(),
      recordType: r.recordType,
      status: r.status,
      note: r.note,
      recordedAt: r.recordedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    res.json(paginatedResponse(list, page, pageSize, total));
  } catch (error) {
    next(error);
  }
};

// 创建成长记录
export const createRecord = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('未授权', ErrorCodes.TOKEN_INVALID, 401);

    const { recordType, note, recordedAt } = req.body;

    if (!recordType) {
      throw new AppError('记录类型不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    // 确保档案存在
    let profile = await prisma.growthProfile.findUnique({
      where: { userId: BigInt(userId) },
    });

    if (!profile) {
      profile = await prisma.growthProfile.create({
        data: { userId: BigInt(userId) },
      });
    }

    const record = await prisma.growthRecord.create({
      data: {
        userId: BigInt(userId),
        profileId: profile.id,
        recordType,
        status: 'active',
        note: note || '',
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      },
    });

    res.json(successResponse({
      id: record.id.toString(),
      userId: record.userId.toString(),
      profileId: record.profileId.toString(),
      recordType: record.recordType,
      status: record.status,
      note: record.note,
      recordedAt: record.recordedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));
  } catch (error) {
    next(error);
  }
};
