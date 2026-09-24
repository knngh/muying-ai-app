import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError, ErrorCodes, successResponse } from '../middlewares/error.middleware';
import { groupCalendarSummaryRecords, summarizeExpenseYear } from '../services/tool-record-summary.service';

const requireUserId = (req: Request): bigint => {
  if (!req.userId) throw new AppError('未授权', ErrorCodes.TOKEN_INVALID, 401);
  return BigInt(req.userId);
};

const serializeContraction = (record: {
  id: bigint; startedAt: Date; endedAt: Date; durationSeconds: number; intervalSeconds: number | null; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), startedAt: record.startedAt.toISOString(), endedAt: record.endedAt.toISOString(),
  durationSeconds: record.durationSeconds, intervalSeconds: record.intervalSeconds,
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializeMovement = (record: {
  id: bigint; startedAt: Date; endedAt: Date; count: number; method: string; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), startedAt: record.startedAt.toISOString(), endedAt: record.endedAt.toISOString(),
  count: record.count, method: record.method,
  durationSeconds: Math.max(0, Math.round((record.endedAt.getTime() - record.startedAt.getTime()) / 1000)),
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializeWeight = (record: {
  id: bigint; measuredAt: Date; weightKg: unknown; source: string; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), measuredAt: record.measuredAt.toISOString().slice(0, 10),
  weightKg: Number(record.weightKg), source: record.source,
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializeDiary = (record: {
  id: bigint; entryDate: Date; mood: string | null; content: string; imageUrls: unknown; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), entryDate: record.entryDate.toISOString().slice(0, 10), mood: record.mood,
  content: record.content, imageUrls: Array.isArray(record.imageUrls) ? record.imageUrls : [],
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializeExpense = (record: {
  id: bigint; occurredAt: Date; amountCents: number; direction: string; category: string; note: string | null; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), occurredAt: record.occurredAt.toISOString().slice(0, 10), amountCents: record.amountCents,
  direction: record.direction, category: record.category, note: record.note,
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializeCare = (record: {
  id: bigint; kind: string; recordedAt: Date; endedAt: Date | null; amountMl: number | null; side: string | null; diaperType: string | null; note: string | null; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), kind: record.kind, recordedAt: record.recordedAt.toISOString(), endedAt: record.endedAt?.toISOString() || null,
  amountMl: record.amountMl, side: record.side, diaperType: record.diaperType, note: record.note,
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializeMeasurement = (record: {
  id: bigint; measuredAt: Date; metric: string; value: unknown; unit: string; method: string | null; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), measuredAt: record.measuredAt.toISOString().slice(0, 10), metric: record.metric,
  value: Number(record.value), unit: record.unit, method: record.method,
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializeVaccination = (record: {
  id: bigint; vaccineName: string; administeredAt: Date; status: string; doseNumber: number | null; note: string | null; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), vaccineName: record.vaccineName, administeredAt: record.administeredAt.toISOString().slice(0, 10),
  status: record.status, doseNumber: record.doseNumber, note: record.note,
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializeFood = (record: {
  id: bigint; foodName: string; triedAt: Date; observation: string | null; responseStatus: string; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), foodName: record.foodName, triedAt: record.triedAt.toISOString().slice(0, 10),
  observation: record.observation, responseStatus: record.responseStatus,
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializePacking = (record: {
  id: bigint; name: string; category: string; quantity: number; isDone: boolean; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), name: record.name, category: record.category, quantity: record.quantity, isDone: record.isDone,
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

function parseDatePair(startedAt: string, endedAt: string): { start: Date; end: Date } {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (end.getTime() < start.getTime()) throw new AppError('结束时间不能早于开始时间', ErrorCodes.PARAM_ERROR, 400);
  return { start, end };
}

export const getContractions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const list = await prisma.contractionSession.findMany({ where: { userId }, orderBy: { startedAt: 'desc' }, take: limit });
    res.json(successResponse(list.map(serializeContraction)));
  } catch (error) { next(error); }
};

export const createContraction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { startedAt, endedAt, durationSeconds, intervalSeconds, clientOperationId } = req.body;
    const { start, end } = parseDatePair(startedAt, endedAt);
    if (clientOperationId) {
      const existing = await prisma.contractionSession.findFirst({ where: { userId, clientOperationId } });
      if (existing) { res.json(successResponse(serializeContraction(existing))); return; }
    }
    const created = await prisma.contractionSession.create({ data: {
      userId, startedAt: start, endedAt: end, durationSeconds, intervalSeconds: intervalSeconds ?? null, clientOperationId: clientOperationId || null,
    } });
    res.json(successResponse(serializeContraction(created)));
  } catch (error) { next(error); }
};

export const getMovements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const list = await prisma.movementSession.findMany({ where: { userId }, orderBy: { startedAt: 'desc' }, take: limit });
    res.json(successResponse(list.map(serializeMovement)));
  } catch (error) { next(error); }
};

export const createMovement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { startedAt, endedAt, count, method, clientOperationId } = req.body;
    const { start, end } = parseDatePair(startedAt, endedAt);
    if (clientOperationId) {
      const existing = await prisma.movementSession.findFirst({ where: { userId, clientOperationId } });
      if (existing) { res.json(successResponse(serializeMovement(existing))); return; }
    }
    const created = await prisma.movementSession.create({ data: {
      userId, startedAt: start, endedAt: end, count, method, clientOperationId: clientOperationId || null,
    } });
    res.json(successResponse(serializeMovement(created)));
  } catch (error) { next(error); }
};

export const getWeights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const list = await prisma.pregnancyWeightRecord.findMany({ where: { userId }, orderBy: { measuredAt: 'desc' }, take: limit });
    res.json(successResponse(list.map(serializeWeight)));
  } catch (error) { next(error); }
};

export const createWeight = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { measuredAt, weightKg, source, clientOperationId } = req.body;
    if (clientOperationId) {
      const existing = await prisma.pregnancyWeightRecord.findFirst({ where: { userId, clientOperationId } });
      if (existing) { res.json(successResponse(serializeWeight(existing))); return; }
    }
    const created = await prisma.pregnancyWeightRecord.create({ data: {
      userId, measuredAt: new Date(`${measuredAt}T00:00:00.000Z`), weightKg, source, clientOperationId: clientOperationId || null,
    } });
    res.json(successResponse(serializeWeight(created)));
  } catch (error) { next(error); }
};

export const getDiaryEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const list = await prisma.diaryEntry.findMany({ where: { userId }, orderBy: { entryDate: 'desc' }, take: limit });
    res.json(successResponse(list.map(serializeDiary)));
  } catch (error) { next(error); }
};

export const createDiaryEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { entryDate, mood, content, clientOperationId } = req.body;
    if (clientOperationId) {
      const existing = await prisma.diaryEntry.findFirst({ where: { userId, clientOperationId } });
      if (existing) { res.json(successResponse(serializeDiary(existing))); return; }
    }
    const created = await prisma.diaryEntry.create({ data: {
      userId, entryDate: new Date(`${entryDate}T00:00:00.000Z`), mood: mood || null, content, imageUrls: [], clientOperationId: clientOperationId || null,
    } });
    res.json(successResponse(serializeDiary(created)));
  } catch (error) { next(error); }
};

export const getExpenseEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const list = await prisma.expenseEntry.findMany({ where: { userId }, orderBy: { occurredAt: 'desc' }, take: limit });
    res.json(successResponse(list.map(serializeExpense)));
  } catch (error) { next(error); }
};

export const getAnnualExpenseSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const year = Number(req.query.year);
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const records = await prisma.expenseEntry.findMany({
      where: { userId, occurredAt: { gte: start, lt: end } },
      select: { occurredAt: true, amountCents: true, direction: true },
      orderBy: { occurredAt: 'asc' },
    });
    res.json(successResponse(summarizeExpenseYear(records, year)));
  } catch (error) { next(error); }
};

function isoDate(value: Date): string { return value.toISOString().slice(0, 10); }

export const getCalendarSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const from = new Date(`${String(req.query.from)}T00:00:00.000Z`);
    const toExclusive = new Date(`${String(req.query.to)}T00:00:00.000Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const range = { gte: from, lt: toExclusive };
    const [contractions, movements, weights, diaries, expenses, care, growth, vaccinations, foods] = await Promise.all([
      prisma.contractionSession.findMany({ where: { userId, startedAt: range }, select: { id: true, startedAt: true, durationSeconds: true } }),
      prisma.movementSession.findMany({ where: { userId, startedAt: range }, select: { id: true, startedAt: true, count: true } }),
      prisma.pregnancyWeightRecord.findMany({ where: { userId, measuredAt: range }, select: { id: true, measuredAt: true, weightKg: true } }),
      prisma.diaryEntry.findMany({ where: { userId, entryDate: range }, select: { id: true, entryDate: true } }),
      prisma.expenseEntry.findMany({ where: { userId, occurredAt: range }, select: { id: true, occurredAt: true, amountCents: true, direction: true } }),
      prisma.careLog.findMany({ where: { userId, recordedAt: range }, select: { id: true, recordedAt: true, kind: true } }),
      prisma.babyMeasurement.findMany({ where: { userId, measuredAt: range }, select: { id: true, measuredAt: true, metric: true, value: true, unit: true } }),
      prisma.vaccinationRecord.findMany({ where: { userId, administeredAt: range }, select: { id: true, administeredAt: true, vaccineName: true } }),
      prisma.foodTrial.findMany({ where: { userId, triedAt: range }, select: { id: true, triedAt: true, foodName: true } }),
    ]);
    const records = [
      ...contractions.map(item => ({ id: item.id.toString(), toolId: 'contractions', date: isoDate(item.startedAt), title: `宫缩 ${item.durationSeconds} 秒` })),
      ...movements.map(item => ({ id: item.id.toString(), toolId: 'movement', date: isoDate(item.startedAt), title: `胎动 ${item.count} 次` })),
      ...weights.map(item => ({ id: item.id.toString(), toolId: 'weight', date: isoDate(item.measuredAt), title: `体重 ${Number(item.weightKg)} kg` })),
      ...diaries.map(item => ({ id: item.id.toString(), toolId: 'diary', date: isoDate(item.entryDate), title: '孕育日记' })),
      ...expenses.map(item => ({ id: item.id.toString(), toolId: 'expenses', date: isoDate(item.occurredAt), title: `账目 ${item.amountCents} 分 · ${item.direction}` })),
      ...care.map(item => ({ id: item.id.toString(), toolId: 'care', date: isoDate(item.recordedAt), title: `照护 · ${item.kind}` })),
      ...growth.map(item => ({ id: item.id.toString(), toolId: 'growth', date: isoDate(item.measuredAt), title: `生长 ${item.metric} ${Number(item.value)}${item.unit}` })),
      ...vaccinations.map(item => ({ id: item.id.toString(), toolId: 'vaccines', date: isoDate(item.administeredAt), title: item.vaccineName })),
      ...foods.map(item => ({ id: item.id.toString(), toolId: 'foods', date: isoDate(item.triedAt), title: item.foodName })),
    ];
    res.json(successResponse(groupCalendarSummaryRecords(records)));
  } catch (error) { next(error); }
};

export const createExpenseEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { occurredAt, amountCents, direction, category, note, clientOperationId } = req.body;
    if (clientOperationId) {
      const existing = await prisma.expenseEntry.findFirst({ where: { userId, clientOperationId } });
      if (existing) { res.json(successResponse(serializeExpense(existing))); return; }
    }
    const created = await prisma.expenseEntry.create({ data: {
      userId, occurredAt: new Date(`${occurredAt}T00:00:00.000Z`), amountCents, direction, category, note: note || null, clientOperationId: clientOperationId || null,
    } });
    res.json(successResponse(serializeExpense(created)));
  } catch (error) { next(error); }
};

export const getCareLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const list = await prisma.careLog.findMany({ where: { userId }, orderBy: { recordedAt: 'desc' }, take: limit });
    res.json(successResponse(list.map(serializeCare)));
  } catch (error) { next(error); }
};

export const createCareLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { kind, recordedAt, endedAt, amountMl, side, diaperType, note, clientOperationId } = req.body;
    if (clientOperationId) {
      const existing = await prisma.careLog.findFirst({ where: { userId, clientOperationId } });
      if (existing) { res.json(successResponse(serializeCare(existing))); return; }
    }
    const created = await prisma.careLog.create({ data: {
      userId, kind, recordedAt: new Date(recordedAt), endedAt: endedAt ? new Date(endedAt) : null,
      amountMl: amountMl ?? null, side: side || null, diaperType: diaperType || null, note: note || null, clientOperationId: clientOperationId || null,
    } });
    res.json(successResponse(serializeCare(created)));
  } catch (error) { next(error); }
};

export const getBabyMeasurements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const list = await prisma.babyMeasurement.findMany({ where: { userId }, orderBy: { measuredAt: 'desc' }, take: limit });
    res.json(successResponse(list.map(serializeMeasurement)));
  } catch (error) { next(error); }
};

export const createBabyMeasurement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { measuredAt, metric, value, unit, method, clientOperationId } = req.body;
    if (clientOperationId) {
      const existing = await prisma.babyMeasurement.findFirst({ where: { userId, clientOperationId } });
      if (existing) { res.json(successResponse(serializeMeasurement(existing))); return; }
    }
    const created = await prisma.babyMeasurement.create({ data: {
      userId, measuredAt: new Date(`${measuredAt}T00:00:00.000Z`), metric, value, unit, method: method || null, clientOperationId: clientOperationId || null,
    } });
    res.json(successResponse(serializeMeasurement(created)));
  } catch (error) { next(error); }
};

export const getVaccinationRecords = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const list = await prisma.vaccinationRecord.findMany({ where: { userId }, orderBy: { administeredAt: 'desc' }, take: limit });
    res.json(successResponse(list.map(serializeVaccination)));
  } catch (error) { next(error); }
};

export const createVaccinationRecord = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { vaccineName, administeredAt, status, doseNumber, note, clientOperationId } = req.body;
    if (clientOperationId) {
      const existing = await prisma.vaccinationRecord.findFirst({ where: { userId, clientOperationId } });
      if (existing) { res.json(successResponse(serializeVaccination(existing))); return; }
    }
    const created = await prisma.vaccinationRecord.create({ data: {
      userId, vaccineName, administeredAt: new Date(`${administeredAt}T00:00:00.000Z`), status,
      doseNumber: doseNumber ?? null, note: note || null, clientOperationId: clientOperationId || null,
    } });
    res.json(successResponse(serializeVaccination(created)));
  } catch (error) { next(error); }
};

export const getFoodTrials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const list = await prisma.foodTrial.findMany({ where: { userId }, orderBy: { triedAt: 'desc' }, take: limit });
    res.json(successResponse(list.map(serializeFood)));
  } catch (error) { next(error); }
};

export const createFoodTrial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { foodName, triedAt, observation, responseStatus, clientOperationId } = req.body;
    if (clientOperationId) {
      const existing = await prisma.foodTrial.findFirst({ where: { userId, clientOperationId } });
      if (existing) { res.json(successResponse(serializeFood(existing))); return; }
    }
    const created = await prisma.foodTrial.create({ data: {
      userId, foodName, triedAt: new Date(`${triedAt}T00:00:00.000Z`), observation: observation || null, responseStatus, clientOperationId: clientOperationId || null,
    } });
    res.json(successResponse(serializeFood(created)));
  } catch (error) { next(error); }
};

const DEFAULT_PACKING_ITEMS = [
  ['证件与产检资料', '证件', 1], ['医保卡/就诊卡', '证件', 1], ['手机与充电器', '证件', 1], ['现金或支付工具', '证件', 1],
  ['产褥垫', '妈妈', 1], ['一次性内裤', '妈妈', 1], ['哺乳内衣', '妈妈', 2], ['防溢乳垫', '妈妈', 1], ['产妇卫生巾', '妈妈', 1], ['洗漱用品', '妈妈', 1], ['拖鞋和出院衣物', '妈妈', 1], ['吸管杯或带吸管水杯', '妈妈', 1],
  ['新生儿衣物', '宝宝', 2], ['纸尿裤', '宝宝', 1], ['包被', '宝宝', 2], ['小方巾', '宝宝', 3], ['婴儿湿巾', '宝宝', 1], ['护臀用品', '宝宝', 1], ['新生儿帽子', '宝宝', 1],
] as const;

export const getPackingItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    await prisma.packingItem.createMany({ data: DEFAULT_PACKING_ITEMS.map(([name, category, quantity]) => ({ userId, name, category, quantity })), skipDuplicates: true });
    const list = await prisma.packingItem.findMany({ where: { userId }, orderBy: [{ category: 'asc' }, { createdAt: 'asc' }] });
    res.json(successResponse(list.map(serializePacking)));
  } catch (error) { next(error); }
};

export const upsertPackingItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { name, category, quantity, isDone, clientOperationId } = req.body;
    const item = await prisma.packingItem.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name, category, quantity, isDone, clientOperationId: clientOperationId || null },
      update: { category, quantity, isDone, ...(clientOperationId ? { clientOperationId } : {}) },
    });
    res.json(successResponse(serializePacking(item)));
  } catch (error) { next(error); }
};
