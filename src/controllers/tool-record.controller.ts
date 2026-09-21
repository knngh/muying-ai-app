import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError, ErrorCodes, successResponse } from '../middlewares/error.middleware';

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
  count: record.count, method: record.method, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});

const serializeWeight = (record: {
  id: bigint; measuredAt: Date; weightKg: unknown; source: string; createdAt: Date; updatedAt: Date;
}) => ({
  id: record.id.toString(), measuredAt: record.measuredAt.toISOString().slice(0, 10),
  weightKg: Number(record.weightKg), source: record.source,
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
