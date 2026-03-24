import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';

// 获取疫苗列表
export const getVaccines = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { monthAge, category } = req.query;

    const where: any = { status: 1 };

    if (category) {
      where.category = category;
    }

    // 如果提供了月龄，筛选适用疫苗
    if (monthAge) {
      const age = Number(monthAge);
      where.OR = [
        { minMonth: { lte: age }, maxMonth: { gte: age } },
        { minMonth: { lte: age }, maxMonth: null },
        { minMonth: null, maxMonth: { gte: age } }
      ];
    }

    const vaccines = await prisma.vaccine.findMany({
      where,
      orderBy: [{ category: 'asc' }, { minMonth: 'asc' }]
    });

    res.json(successResponse({ list: vaccines }));
  } catch (error) {
    next(error);
  }
};

// 获取疫苗详情
export const getVaccineById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const vaccine = await prisma.vaccine.findUnique({
      where: { id: BigInt(id) }
    });

    if (!vaccine) {
      throw new AppError('疫苗信息不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    res.json(successResponse(vaccine));
  } catch (error) {
    next(error);
  }
};