import type { CalendarEvent as PrismaCalendarEvent, Prisma } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import { awardBehaviorPoints } from '../services/checkin.service';
import {
  cleanupUnusedDiaryImages,
  getRemovedDiaryImageUrls,
  isDiaryImageUrl,
} from '../services/diary-image-cleanup.service';
import {
  getDiaryUploadCurrentImageCount,
  hasDiaryUploadSlot,
  MAX_DIARY_IMAGES_PER_WEEK,
  parseDiaryUploadImageUrls,
} from '../services/diary-upload-limit.service';
import {
  isCosStorageEnabled,
  uploadFileToCos,
} from '../services/cos-storage.service';
import {
  buildStandardScheduleEventPayload,
  buildStandardSchedulePlan,
  getMissingStandardScheduleDefinitions,
} from '../utils/calendar-standard-plan';
import { calculatePregnancyWeekFromDueDate } from '../utils/pregnancy';
import { getPostpartumTimelineTodos } from '../utils/postpartum-timeline';
import {
  calculatePostpartumWeek,
  getPostpartumStorageWeek,
  parseTimelinePeriodInput,
  PREGNANCY_WEEK_MAX,
  PREGNANCY_WEEK_MIN,
  POSTPARTUM_WEEK_MAX,
  POSTPARTUM_WEEK_MIN,
  resolveTimelineBabyBirthday,
  toTimelinePeriodFromStorageWeek,
  type TimelinePeriod,
} from '../utils/timeline';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseTimeString = (value: unknown): Date | null => {
  if (value === undefined) {
    return null;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError('时间格式无效', ErrorCodes.PARAM_ERROR, 400);
  }

  const normalized = value.trim();
  const match = TIME_PATTERN.exec(normalized);
  if (!match) {
    throw new AppError('时间格式无效，请使用 HH:mm', ErrorCodes.PARAM_ERROR, 400);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
};

const formatUtcTime = (value: Date | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
};

// 辅助函数：将 Prisma CalendarEvent 序列化为前端期望的格式
const serializeEvent = (event: PrismaCalendarEvent) => {
  const { eventTime, endTime, isAllDay, isRecurring, status, ...rest } = event;
  return {
    ...rest,
    startTime: formatUtcTime(eventTime),
    endTime: formatUtcTime(endTime),
    isAllDay: isAllDay === 1,
    isRecurring: isRecurring === 1,
    isCompleted: status === 1,
    reminderEnabled: (rest.reminderMinutes ?? 0) > 0,
    status,
  };
};

type SerializedCalendarEvent = ReturnType<typeof serializeEvent>;

// 辅助函数：获取一周的开始和结束日期（周一到周日）
const getWeekRange = (dateStr: string): { start: Date; end: Date } => {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  // 调整为周一作为一周的开始（0=周日, 1=周一...）
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

// 辅助函数：格式化日期为 YYYY-MM-DD（使用本地时间，与 getWeekRange 的 setHours 保持一致）
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


const serializeTimelinePeriod = (period: TimelinePeriod) => ({
  timelineKey: period.timelineKey,
  stage: period.stage,
  displayWeek: period.week,
  timelineTitle: period.title,
  timelineShortTitle: period.shortTitle,
});

const serializeTimelineMetaFromStorageWeek = (storageWeek: number) => {
  const period = toTimelinePeriodFromStorageWeek(storageWeek);
  return {
    week: period.storageWeek,
    ...serializeTimelinePeriod(period),
  };
};

const serializeTimelinePeriodWithStorageWeek = (period: TimelinePeriod) => ({
  week: period.storageWeek,
  ...serializeTimelinePeriod(period),
});

const parseTimelinePeriod = (input: { week?: unknown; timelineKey?: unknown }): TimelinePeriod => {
  const period = parseTimelinePeriodInput(input);
  if (!period) {
    throw new AppError('时间线参数无效', ErrorCodes.PARAM_ERROR, 400);
  }
  return period;
};

const parseOptionalTimelinePeriod = (input: { week?: unknown; timelineKey?: unknown }): TimelinePeriod | null => {
  const hasTimelineInput = input.week !== undefined
    || (typeof input.timelineKey === 'string' && input.timelineKey.trim() !== '');
  const period = parseTimelinePeriodInput(input);
  if (!period && hasTimelineInput) {
    throw new AppError('时间线参数无效', ErrorCodes.PARAM_ERROR, 400);
  }
  return period;
};

const parseTodoKey = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new AppError('待办标识不能为空', ErrorCodes.PARAM_ERROR, 400);
  }

  const todoKey = value.trim();
  if (!todoKey || todoKey.length > 100) {
    throw new AppError('待办标识无效', ErrorCodes.PARAM_ERROR, 400);
  }

  return todoKey;
};

const parseDiaryContent = (value: unknown, hasImages = false): string => {
  if ((value === undefined || value === null) && hasImages) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new AppError('记录内容不能为空', ErrorCodes.PARAM_ERROR, 400);
  }

  const content = value.trim();
  if (!content && !hasImages) {
    throw new AppError('记录内容不能为空', ErrorCodes.PARAM_ERROR, 400);
  }

  if (content.length > 500) {
    throw new AppError('记录内容不能超过500字', ErrorCodes.PARAM_ERROR, 400);
  }

  return content;
};

const parseDiaryImageUrls = (value: unknown): string[] => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new AppError('照片列表格式无效', ErrorCodes.PARAM_ERROR, 400);
  }

  if (value.length > MAX_DIARY_IMAGES_PER_WEEK) {
    throw new AppError(`最多添加${MAX_DIARY_IMAGES_PER_WEEK}张照片`, ErrorCodes.PARAM_ERROR, 400);
  }

  return value.map((item) => {
    if (typeof item !== 'string') {
      throw new AppError('照片地址无效', ErrorCodes.PARAM_ERROR, 400);
    }

    const url = item.trim();
    if (!isDiaryImageUrl(url)) {
      throw new AppError('照片地址无效', ErrorCodes.PARAM_ERROR, 400);
    }
    return url;
  });
};

const serializeDiaryImageUrls = (value: Prisma.JsonValue | null | undefined): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && isDiaryImageUrl(item));
};

const parseCustomTodoContent = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new AppError('待办内容不能为空', ErrorCodes.PARAM_ERROR, 400);
  }

  const content = value.trim();
  if (!content) {
    throw new AppError('待办内容不能为空', ErrorCodes.PARAM_ERROR, 400);
  }

  if (content.length > 200) {
    throw new AppError('待办内容不能超过200字', ErrorCodes.PARAM_ERROR, 400);
  }

  return content;
};

const parseCustomTodoId = (value: unknown): bigint => {
  const rawId = String(value ?? '').trim();
  if (!/^\d+$/.test(rawId)) {
    throw new AppError('待办不存在', ErrorCodes.PARAM_ERROR, 400);
  }

  const id = BigInt(rawId);
  if (id <= 0) {
    throw new AppError('待办不存在', ErrorCodes.PARAM_ERROR, 400);
  }
  return id;
};

async function loadStandardScheduleContext(
  userId: string,
  client: typeof prisma = prisma,
) {
  const userIdBigInt = BigInt(userId);

  const [user, existingEvents] = await Promise.all([
    client.user.findUniqueOrThrow({
      where: { id: userIdBigInt },
      select: {
        pregnancyStatus: true,
        dueDate: true,
        babyBirthday: true,
      },
    }),
    client.calendarEvent.findMany({
      where: {
        userId: userIdBigInt,
        deletedAt: null,
        reminderType: {
          startsWith: 'std-',
        },
      },
      select: {
        id: true,
        reminderType: true,
        status: true,
      },
    }),
  ]);

  return { user, existingEvents };
}

// 辅助函数：获取周的唯一标识（YYYY-WW）
const getWeekId = (date: Date): string => {
  const year = date.getFullYear();
  const start = new Date(year, 0, 1);
  const diff = (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const weekNumber = Math.ceil((diff + start.getDay() + 1) / 7);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
};

// 获取周历数据（新接口）
export const getWeekEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.query; // YYYY-MM-DD 格式，默认为今天
    const userId = req.userId!;

    const targetDate = date ? new Date(date as string) : new Date();
    const { start, end } = getWeekRange(formatDate(targetDate));

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: BigInt(userId),
        deletedAt: null,
        eventDate: {
          gte: start,
          lte: end
        }
      },
      orderBy: [
        { eventDate: 'asc' },
        { eventTime: 'asc' }
      ]
    });

    // 按日期分组
    const eventsByDate: Record<string, SerializedCalendarEvent[]> = {};
    const weekDays: Array<{ date: string; dayOfWeek: number; dayName: string; isToday: boolean }> = [];
    
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const today = formatDate(new Date());

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = formatDate(currentDate);
      
      eventsByDate[dateStr] = [];
      weekDays.push({
        date: dateStr,
        dayOfWeek: currentDate.getDay(),
        dayName: dayNames[currentDate.getDay()],
        isToday: dateStr === today
      });
    }

    // 将事件分配到对应日期（序列化后）
    events.forEach((event) => {
      const dateStr = formatDate(event.eventDate);
      if (eventsByDate[dateStr]) {
        eventsByDate[dateStr].push(serializeEvent(event));
      }
    });

    // 计算周统计
    const weekStats = {
      total: events.length,
      completed: events.filter((event) => event.status === 1).length,
      pending: events.filter((event) => event.status === 0).length
    };

    res.json(successResponse({
      weekId: getWeekId(targetDate),
      weekStart: formatDate(start),
      weekEnd: formatDate(end),
      weekDays,
      eventsByDate,
      stats: weekStats
    }));
  } catch (error) {
    next(error);
  }
};

// 获取事件列表（保留原接口）
export const getEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, type } = req.query;
    const userId = req.userId!;

    if (!startDate || !endDate) {
      throw new AppError('请提供开始和结束日期', ErrorCodes.PARAM_ERROR, 400);
    }

    const where: Prisma.CalendarEventWhereInput = {
      userId: BigInt(userId),
      deletedAt: null
    };

    if (typeof type === 'string' && type.trim()) {
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

    res.json(successResponse({ list: events.map(serializeEvent) }));
  } catch (error) {
    next(error);
  }
};

// 获取孕周待办进度
export const getTodoProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const period = parseOptionalTimelinePeriod(req.query);

    const where: { userId: bigint; week?: number } = {
      userId: BigInt(userId)
    };

    if (period) {
      where.week = period.storageWeek;
    }

    const progressList = await prisma.userPregnancyTodoProgress.findMany({
      where,
      orderBy: [
        { week: 'asc' },
        { todoKey: 'asc' }
      ]
    });

    res.json(successResponse({
      list: progressList.map((item) => ({
        ...serializeTimelineMetaFromStorageWeek(item.week),
        todoKey: item.todoKey,
        completed: true,
        completedAt: item.completedAt.toISOString()
      }))
    }));
  } catch (error) {
    next(error);
  }
};

// 保存孕周待办进度
export const updateTodoProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const period = parseTimelinePeriod(req.body);
    const week = period.storageWeek;
    const todoKey = parseTodoKey(req.body.todoKey);
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
      throw new AppError('待办完成状态无效', ErrorCodes.PARAM_ERROR, 400);
    }

    if (completed) {
      const progress = await prisma.userPregnancyTodoProgress.upsert({
        where: {
          userId_week_todoKey: {
            userId: BigInt(userId),
            week,
            todoKey
          }
        },
        create: {
          userId: BigInt(userId),
          week,
          todoKey,
          completedAt: new Date()
        },
        update: {
          completedAt: new Date()
        }
      });

      res.json(successResponse({
        ...serializeTimelineMetaFromStorageWeek(progress.week),
        todoKey: progress.todoKey,
        completed: true,
        completedAt: progress.completedAt.toISOString()
      }, '保存成功'));
      return;
    }

    await prisma.userPregnancyTodoProgress.deleteMany({
      where: {
        userId: BigInt(userId),
        week,
        todoKey
      }
    });

    res.json(successResponse({
      ...serializeTimelineMetaFromStorageWeek(week),
      todoKey,
      completed: false
    }, '已取消完成'));
  } catch (error) {
    next(error);
  }
};

// 获取孕周记录
export const getPregnancyDiaries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const period = parseOptionalTimelinePeriod(req.query);

    const where: { userId: bigint; week?: number } = {
      userId: BigInt(userId)
    };

    if (period) {
      where.week = period.storageWeek;
    }

    const diaries = await prisma.userPregnancyDiary.findMany({
      where,
      orderBy: { week: 'asc' }
    });

    res.json(successResponse({
      list: diaries.map((item) => ({
        ...serializeTimelineMetaFromStorageWeek(item.week),
        content: item.content,
        imageUrls: serializeDiaryImageUrls(item.imageUrls),
        date: formatDate(item.updatedAt),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    }));
  } catch (error) {
    next(error);
  }
};

// 保存孕周记录
export const savePregnancyDiary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const period = parseTimelinePeriod(req.body);
    const week = period.storageWeek;
    const imageUrls = parseDiaryImageUrls(req.body.imageUrls);
    const content = parseDiaryContent(req.body.content, imageUrls.length > 0);
    const existingDiary = await prisma.userPregnancyDiary.findUnique({
      where: {
        userId_week: {
          userId: BigInt(userId),
          week
        }
      }
    });
    const previousImageUrls = serializeDiaryImageUrls(existingDiary?.imageUrls);

    const diary = await prisma.userPregnancyDiary.upsert({
      where: {
        userId_week: {
          userId: BigInt(userId),
          week
        }
      },
      create: {
        userId: BigInt(userId),
        week,
        content,
        imageUrls
      },
      update: {
        content,
        imageUrls
      }
    });
    void cleanupUnusedDiaryImages(getRemovedDiaryImageUrls(previousImageUrls, imageUrls));

    res.json(successResponse({
      ...serializeTimelineMetaFromStorageWeek(diary.week),
      content: diary.content,
      imageUrls: serializeDiaryImageUrls(diary.imageUrls),
      date: formatDate(diary.updatedAt),
      createdAt: diary.createdAt.toISOString(),
      updatedAt: diary.updatedAt.toISOString()
    }, '保存成功'));
  } catch (error) {
    next(error);
  }
};

// 上传孕育记录照片
export const uploadPregnancyDiaryImage = async (req: Request, res: Response, next: NextFunction) => {
  let uploadedUrl: string | null = null;

  try {
    const file = req.file;
    if (!file) {
      throw new AppError('请选择图片', ErrorCodes.PARAM_ERROR, 400);
    }

    const localUploadedUrl = `/uploads/${file.filename}`;
    uploadedUrl = localUploadedUrl;
    const period = parseTimelinePeriod(req.body);
    let draftImageUrls: string[];
    try {
      draftImageUrls = parseDiaryUploadImageUrls(req.body.imageUrls);
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : '照片列表格式无效', ErrorCodes.PARAM_ERROR, 400);
    }

    const existingDiary = await prisma.userPregnancyDiary.findUnique({
      where: {
        userId_week: {
          userId: BigInt(req.userId!),
          week: period.storageWeek,
        },
      },
    });
    const currentImageCount = getDiaryUploadCurrentImageCount({
      draftImageUrlsProvided: Object.prototype.hasOwnProperty.call(req.body, 'imageUrls'),
      draftImageUrls,
      existingImageUrls: serializeDiaryImageUrls(existingDiary?.imageUrls),
    });

    if (!hasDiaryUploadSlot(currentImageCount)) {
      throw new AppError(`最多添加${MAX_DIARY_IMAGES_PER_WEEK}张照片`, ErrorCodes.PARAM_ERROR, 400);
    }

    if (isCosStorageEnabled()) {
      const cosResult = await uploadFileToCos(file);
      uploadedUrl = cosResult.url;
    }

    res.json(successResponse({
      url: uploadedUrl,
      filename: file.filename,
    }, '上传成功'));
  } catch (error) {
    if (uploadedUrl) {
      await cleanupUnusedDiaryImages([uploadedUrl]);
    }
    next(error);
  }
};

// 删除孕周记录
export const deletePregnancyDiary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const period = parseTimelinePeriod(req.params.week !== undefined ? { week: req.params.week } : req.query);
    const week = period.storageWeek;

    const existingDiary = await prisma.userPregnancyDiary.findUnique({
      where: {
        userId_week: {
          userId: BigInt(userId),
          week
        }
      }
    });

    if (!existingDiary) {
      throw new AppError('记录不存在', ErrorCodes.PARAM_ERROR, 404);
    }

    await prisma.userPregnancyDiary.delete({
      where: {
        userId_week: {
          userId: BigInt(userId),
          week
        }
      }
    });
    void cleanupUnusedDiaryImages(serializeDiaryImageUrls(existingDiary.imageUrls));

    res.json(successResponse(serializeTimelineMetaFromStorageWeek(week), '删除成功'));
  } catch (error) {
    next(error);
  }
};

// 获取自定义待办
export const getCustomTodos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const period = parseOptionalTimelinePeriod(req.query);

    const where: { userId: bigint; week?: number } = {
      userId: BigInt(userId)
    };

    if (period) {
      where.week = period.storageWeek;
    }

    const customTodos = await prisma.userPregnancyCustomTodo.findMany({
      where,
      orderBy: [
        { week: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    res.json(successResponse({
      list: customTodos.map((item) => ({
        id: item.id.toString(),
        ...serializeTimelineMetaFromStorageWeek(item.week),
        content: item.content,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    }));
  } catch (error) {
    next(error);
  }
};

export const getTimelineContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const userIdBigInt = BigInt(userId);

    const [user, growthProfile] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userIdBigInt },
        select: {
          pregnancyStatus: true,
          dueDate: true,
          babyBirthday: true,
        },
      }),
      prisma.growthProfile.findUnique({
        where: { userId: userIdBigInt },
        select: { birthday: true },
      }),
    ]);

    const birthdayResolution = resolveTimelineBabyBirthday({
      userBabyBirthday: user.babyBirthday,
      growthProfileBirthday: growthProfile?.birthday ?? null,
    });
    const babyBirthday = birthdayResolution.babyBirthday;
    const isPostpartumStatus = user.pregnancyStatus === 3;
    let lifecycleStage: 'preparing' | 'pregnancy' | 'postpartum' = 'preparing';
    let currentPeriod: TimelinePeriod | null = null;
    let requiresBabyBirthday = false;

    if (babyBirthday) {
      lifecycleStage = 'postpartum';
      currentPeriod = toTimelinePeriodFromStorageWeek(
        getPostpartumStorageWeek(calculatePostpartumWeek(babyBirthday)),
      );
    } else if (isPostpartumStatus) {
      lifecycleStage = 'postpartum';
      requiresBabyBirthday = true;
    } else if (user.dueDate) {
      lifecycleStage = 'pregnancy';
      const pregnancyWeek = calculatePregnancyWeekFromDueDate(user.dueDate);
      if (pregnancyWeek) {
        currentPeriod = toTimelinePeriodFromStorageWeek(
          Math.min(Math.max(pregnancyWeek, PREGNANCY_WEEK_MIN), PREGNANCY_WEEK_MAX),
        );
      }
    } else if (user.pregnancyStatus === 2) {
      lifecycleStage = 'pregnancy';
    }

    const currentPeriodMeta = currentPeriod ? serializeTimelinePeriodWithStorageWeek(currentPeriod) : null;

    res.json(successResponse({
      lifecycleStage,
      pregnancyStatus: user.pregnancyStatus,
      dueDate: user.dueDate ? formatDate(user.dueDate) : null,
      babyBirthday: babyBirthday ? formatDate(babyBirthday) : null,
      babyBirthdaySource: birthdayResolution.source,
      requiresBabyBirthday,
      currentPeriod: currentPeriodMeta,
      defaultTodos: currentPeriod
        ? getPostpartumTimelineTodos(currentPeriod).map((todo) => ({
          ...todo,
          ...serializeTimelinePeriodWithStorageWeek(currentPeriod),
          completed: false,
        }))
        : [],
      supportedRanges: {
        pregnancy: {
          minWeek: PREGNANCY_WEEK_MIN,
          maxWeek: PREGNANCY_WEEK_MAX,
          timelineKeyPrefix: 'pregnancy',
        },
        postpartum: {
          minWeek: POSTPARTUM_WEEK_MIN,
          maxWeek: POSTPARTUM_WEEK_MAX,
          timelineKeyPrefix: 'postpartum',
        },
      },
    }));
  } catch (error) {
    next(error);
  }
};

export const getTimelineTodos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = parseTimelinePeriod(req.query);

    res.json(successResponse({
      list: getPostpartumTimelineTodos(period).map((todo) => ({
        ...todo,
        ...serializeTimelinePeriodWithStorageWeek(period),
        completed: false,
      })),
    }));
  } catch (error) {
    next(error);
  }
};

export const getStandardSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { user, existingEvents } = await loadStandardScheduleContext(userId);
    const plan = buildStandardSchedulePlan({
      user,
      existingEvents,
    });

    res.json(successResponse(plan));
  } catch (error) {
    next(error);
  }
};

export const generateStandardSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { user, existingEvents } = await loadStandardScheduleContext(userId);
    const initialPlan = buildStandardSchedulePlan({
      user,
      existingEvents,
    });
    const babyBirthday = user.babyBirthday;

    if (!initialPlan.available || !babyBirthday) {
      res.json(successResponse({
        createdCount: 0,
        createdEventIds: [],
        plan: initialPlan,
      }, '当前阶段没有可生成的标准节点'));
      return;
    }

    const createdEventIds = await prisma.$transaction(async (tx) => {
      const latestExistingEvents = await tx.calendarEvent.findMany({
        where: {
          userId: BigInt(userId),
          deletedAt: null,
          reminderType: {
            startsWith: 'std-',
          },
        },
        select: {
          id: true,
          reminderType: true,
          status: true,
        },
      });

      const latestPlan = buildStandardSchedulePlan({
        user,
        existingEvents: latestExistingEvents,
      });
      const missingDefinitions = getMissingStandardScheduleDefinitions(latestPlan);

      if (missingDefinitions.length === 0) {
        return [] as number[];
      }

      const ids: number[] = [];

      for (const definition of missingDefinitions) {
        const payload = buildStandardScheduleEventPayload(babyBirthday, definition);
        const created = await tx.calendarEvent.create({
          data: {
            userId: BigInt(userId),
            title: payload.title,
            description: payload.description,
            eventType: payload.eventType,
            eventDate: payload.eventDate,
            isAllDay: 1,
            reminderMinutes: payload.reminderMinutes,
            reminderType: payload.reminderType,
            status: 0,
          },
          select: { id: true },
        });
        ids.push(Number(created.id));
      }

      return ids;
    });

    const refreshedContext = await loadStandardScheduleContext(userId);
    const refreshedPlan = buildStandardSchedulePlan({
      user: refreshedContext.user,
      existingEvents: refreshedContext.existingEvents,
    });

    res.status(201).json(successResponse({
      createdCount: createdEventIds.length,
      createdEventIds,
      plan: refreshedPlan,
    }, createdEventIds.length > 0 ? `已生成 ${createdEventIds.length} 个标准节点` : '标准节点已是最新'));
  } catch (error) {
    next(error);
  }
};

// 创建自定义待办
export const createCustomTodo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const period = parseTimelinePeriod(req.body);
    const week = period.storageWeek;
    const content = parseCustomTodoContent(req.body.content);

    const customTodo = await prisma.userPregnancyCustomTodo.create({
      data: {
        userId: BigInt(userId),
        week,
        content
      }
    });

    res.status(201).json(successResponse({
      id: customTodo.id.toString(),
      ...serializeTimelineMetaFromStorageWeek(customTodo.week),
      content: customTodo.content,
      createdAt: customTodo.createdAt.toISOString(),
      updatedAt: customTodo.updatedAt.toISOString()
    }, '创建成功'));
  } catch (error) {
    next(error);
  }
};

// 更新自定义待办
export const updateCustomTodo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const customTodoId = parseCustomTodoId(req.params.id);
    const content = parseCustomTodoContent(req.body.content);

    const existingTodo = await prisma.userPregnancyCustomTodo.findFirst({
      where: {
        id: customTodoId,
        userId: BigInt(userId)
      }
    });

    if (!existingTodo) {
      throw new AppError('待办不存在', ErrorCodes.PARAM_ERROR, 404);
    }

    const updatedTodo = await prisma.userPregnancyCustomTodo.update({
      where: {
        id: customTodoId
      },
      data: {
        content
      }
    });

    res.json(successResponse({
      id: updatedTodo.id.toString(),
      ...serializeTimelineMetaFromStorageWeek(updatedTodo.week),
      content: updatedTodo.content,
      createdAt: updatedTodo.createdAt.toISOString(),
      updatedAt: updatedTodo.updatedAt.toISOString()
    }, '更新成功'));
  } catch (error) {
    next(error);
  }
};

// 删除自定义待办
export const deleteCustomTodo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const customTodoId = parseCustomTodoId(req.params.id);

    const existingTodo = await prisma.userPregnancyCustomTodo.findFirst({
      where: {
        id: customTodoId,
        userId: BigInt(userId)
      }
    });

    if (!existingTodo) {
      throw new AppError('待办不存在', ErrorCodes.PARAM_ERROR, 404);
    }

    const todoKey = `custom-${existingTodo.id.toString()}`;

    await prisma.$transaction([
      prisma.userPregnancyCustomTodo.delete({
        where: {
          id: customTodoId
        }
      }),
      prisma.userPregnancyTodoProgress.deleteMany({
        where: {
          userId: BigInt(userId),
          week: existingTodo.week,
          todoKey
        }
      })
    ]);

    res.json(successResponse({
      id: existingTodo.id.toString(),
      ...serializeTimelineMetaFromStorageWeek(existingTodo.week),
      todoKey
    }, '删除成功'));
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
        eventTime: parseTimeString(eventTime),
        endDate: endDate ? new Date(endDate) : null,
        endTime: parseTimeString(endTime),
        isAllDay: isAllDay ? 1 : 0,
        isRecurring: isRecurring ? 1 : 0,
        recurrenceRule,
        reminderMinutes: reminderMinutes || 0,
        reminderType,
        relatedArticleId: relatedArticleId ? BigInt(relatedArticleId) : null,
        relatedVaccineId: relatedVaccineId ? BigInt(relatedVaccineId) : null
      }
    });

    res.status(201).json(successResponse(serializeEvent(event), '创建成功'));
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

    // 只允许更新安全字段，防止覆盖 userId 等敏感字段
    const { title, description, eventType, eventDate, eventTime, endDate, endTime,
            isAllDay, isRecurring, recurrenceRule, reminderMinutes, reminderType,
            status } = req.body;

    const event = await prisma.calendarEvent.update({
      where: { id: BigInt(id) },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(eventType !== undefined && { eventType }),
        ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
        ...(eventTime !== undefined && { eventTime: parseTimeString(eventTime) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(endTime !== undefined && { endTime: parseTimeString(endTime) }),
        ...(isAllDay !== undefined && { isAllDay: isAllDay ? 1 : 0 }),
        ...(isRecurring !== undefined && { isRecurring: isRecurring ? 1 : 0 }),
        ...(recurrenceRule !== undefined && { recurrenceRule }),
        ...(reminderMinutes !== undefined && { reminderMinutes }),
        ...(reminderType !== undefined && { reminderType }),
        ...(status !== undefined && { status }),
      }
    });

    res.json(successResponse(serializeEvent(event), '更新成功'));
  } catch (error) {
    next(error);
  }
};

// 拖拽更新事件日期（新接口）
export const dragEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { newDate, newTime } = req.body;

    if (!newDate) {
      throw new AppError('请提供新日期', ErrorCodes.PARAM_ERROR, 400);
    }

    // 检查事件是否存在且属于当前用户
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null }
    });

    if (!existingEvent) {
      throw new AppError('事件不存在', ErrorCodes.PARAM_ERROR, 404);
    }

    const updateData: Prisma.CalendarEventUpdateInput = {
      eventDate: new Date(newDate)
    };

    if (newTime !== undefined) {
      updateData.eventTime = parseTimeString(newTime);
    }

    const event = await prisma.calendarEvent.update({
      where: { id: BigInt(id) },
      data: updateData
    });

    res.json(successResponse(serializeEvent(event), '拖拽更新成功'));
  } catch (error) {
    next(error);
  }
};

// 批量更新事件（新接口）
export const batchUpdateEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { events } = req.body; // [{ id, eventDate, eventTime, status, ... }, ...]

    if (!Array.isArray(events) || events.length === 0) {
      throw new AppError('请提供要更新的事件列表', ErrorCodes.PARAM_ERROR, 400);
    }

    const results = [];

    for (const eventUpdate of events) {
      const { id, title, description, eventDate, eventTime, status } = eventUpdate;

      // 验证事件所有权
      const existingEvent = await prisma.calendarEvent.findFirst({
        where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null }
      });

      if (!existingEvent) {
        continue; // 跳过不存在的事件
      }

      // 只允许更新安全字段
      const safeData: Prisma.CalendarEventUpdateInput = {};
      if (title !== undefined) safeData.title = title;
      if (description !== undefined) safeData.description = description;
      if (eventDate !== undefined) safeData.eventDate = new Date(eventDate);
      if (eventTime !== undefined) safeData.eventTime = parseTimeString(eventTime);
      if (status !== undefined) safeData.status = status;

      const updated = await prisma.calendarEvent.update({
        where: { id: BigInt(id) },
        data: safeData
      });

      results.push(serializeEvent(updated));
    }

    res.json(successResponse({ updated: results.length, events: results }, '批量更新成功'));
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

// 批量删除事件（新接口）
export const batchDeleteEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { ids } = req.body; // [id1, id2, ...]

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('请提供要删除的事件ID列表', ErrorCodes.PARAM_ERROR, 400);
    }

    // 验证所有权并批量软删除
    const result = await prisma.calendarEvent.updateMany({
      where: {
        id: { in: ids.map((id: string) => BigInt(id)) },
        userId: BigInt(userId),
        deletedAt: null
      },
      data: { deletedAt: new Date() }
    });

    res.json(successResponse({ deleted: result.count }, '批量删除成功'));
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

    res.json(successResponse(serializeEvent(updatedEvent), '标记完成'));

    // 行为积分：完成待办奖励（fire-and-forget）
    awardBehaviorPoints(userId, 'todo', id).catch(() => {});
  } catch (error) {
    next(error);
  }
};

// 获取事件类型列表（新接口）
export const getEventTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 预定义的事件类型
    const eventTypes = [
      { value: 'checkup', label: '产检', color: '#4CAF50' },
      { value: 'vaccine', label: '疫苗接种', color: '#2196F3' },
      { value: 'reminder', label: '提醒事项', color: '#FF9800' },
      { value: 'exercise', label: '运动', color: '#9C27B0' },
      { value: 'diet', label: '饮食', color: '#E91E63' },
      { value: 'other', label: '其他', color: '#607D8B' }
    ];

    res.json(successResponse(eventTypes));
  } catch (error) {
    next(error);
  }
};

// 获取单日事件（新接口）
export const getDayEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.params;
    const userId = req.userId!;

    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: BigInt(userId),
        deletedAt: null,
        eventDate: {
          gte: targetDate,
          lt: nextDay
        }
      },
      orderBy: [
        { isAllDay: 'desc' },
        { eventTime: 'asc' }
      ]
    });

    res.json(successResponse({
      date,
      events: events.map(serializeEvent),
      stats: {
        total: events.length,
        completed: events.filter((event) => event.status === 1).length
      }
    }));
  } catch (error) {
    next(error);
  }
};
