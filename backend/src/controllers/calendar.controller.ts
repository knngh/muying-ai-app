import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';

const prisma = new PrismaClient();

// 获取事件列表
export const getEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, type } = req.query;
    const userId = req.userId!;

    if (!startDate || !endDate) {
      throw new AppError('请提供开始和结束日期', ErrorCodes.PARAM_ERROR, 400);
    }

    const where: any = {
      userId: BigInt(userId),
      deletedAt: null
    };

    if (type) {
      where.eventType = type;
    }

    where.eventDate = {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string)
    };

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { eventDate: 'asc' }
    });

    res.json(successResponse({ list: events }));
  } catch (error) {
    next(error);
  }
};

// 创建事件
export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const {
      title,
      description,
      eventType,
      eventDate,
      eventTime,
      endDate,
      endTime,
      isAllDay,
      isRecurring,
      recurrenceRule,
      reminderMinutes,
      reminderType,
      relatedArticleId,
      relatedVaccineId
    } = req.body;

    if (!title || !eventType || !eventDate) {
      throw new AppError('标题、事件类型和日期不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId: BigInt(userId),
        title,
        description,
        eventType,
        eventDate: new Date(eventDate),
        eventTime: eventTime ? new Date(`1970-01-01T${eventTime}`) : null,
        endDate: endDate ? new Date(endDate) : null,
        endTime: endTime ? new Date(`1970-01-01T${endTime}`) : null,
        isAllDay: isAllDay ? 1 : 0,
        isRecurring: isRecurring ? 1 : 0,
        recurrenceRule,
        reminderMinutes: reminderMinutes || 0,
        reminderType,
        relatedArticleId: relatedArticleId ? BigInt(relatedArticleId) : null,
        relatedVaccineId: relatedVaccineId ? BigInt(relatedVaccineId) : null
      }
    });

    res.status(201).json(successResponse(event, '创建成功'));
  } catch (error) {
    next(error);
  }
};

// 更新事件
export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    // 检查事件是否存在且属于当前用户
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null }
    });

    if (!existingEvent) {
      throw new AppError('事件不存在', ErrorCodes.PARAM_ERROR, 404);
    }

    const event = await prisma.calendarEvent.update({
      where: { id: BigInt(id) },
      data: req.body
    });

    res.json(successResponse(event, '更新成功'));
  } catch (error) {
    next(error);
  }
};

// 删除事件
export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const event = await prisma.calendarEvent.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null }
    });

    if (!event) {
      throw new AppError('事件不存在', ErrorCodes.PARAM_ERROR, 404);
    }

    await prisma.calendarEvent.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() }
    });

    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    next(error);
  }
};

// 标记完成
export const completeEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const event = await prisma.calendarEvent.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null }
    });

    if (!event) {
      throw new AppError('事件不存在', ErrorCodes.PARAM_ERROR, 404);
    }

    const updatedEvent = await prisma.calendarEvent.update({
      where: { id: BigInt(id) },
      data: { status: 1, completedAt: new Date() }
    });

    res.json(successResponse(updatedEvent, '标记完成'));
  } catch (error) {
    next(error);
  }
};