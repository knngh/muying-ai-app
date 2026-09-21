import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import path from 'path';
import prisma from '../config/database';
import { AppError, ErrorCodes, successResponse } from '../middlewares/error.middleware';
import { PRIVATE_REPORT_ROOT, removeReportFile, resolveReportPath } from '../middlewares/report-upload.middleware';

const includeFields = { fields: { orderBy: { id: 'asc' as const } } };
type Report = Prisma.ReportDocumentGetPayload<{ include: typeof includeFields }>;
const serializeField = (field: Report['fields'][number]) => ({
  id: String(field.id), fieldKey: field.fieldKey, label: field.label, pageNumber: field.pageNumber,
  candidateValue: field.candidateValue, normalizedValue: field.normalizedValue,
  source: field.source, confidence: field.confidence === null ? null : Number(field.confidence),
  region: field.region, version: field.version, confirmedAt: field.confirmedAt?.toISOString() || null,
});
const serialize = (report: Report) => ({
  id: String(report.id), reportDate: report.reportDate.toISOString().slice(0, 10), name: report.name,
  note: report.note, hasImage: !!report.storageKey, ocrStatus: report.ocrStatus,
  pageCount: report.pageCount, fields: report.fields.map(serializeField),
  clientOperationId: report.clientOperationId,
  createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString(),
});
const userId = (req: Request) => {
  if (!req.userId) throw new AppError('请先登录', ErrorCodes.TOKEN_INVALID, 401);
  return BigInt(req.userId);
};
const notFound = () => new AppError('报告不存在', ErrorCodes.PARAM_ERROR, 404);

export const getReportDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit);
    const rows = await prisma.reportDocument.findMany({
      where: { userId: userId(req), deletedAt: null, ...(req.query.beforeId ? { id: { lt: BigInt(String(req.query.beforeId)) } } : {}) },
      orderBy: { id: 'desc' }, take: limit + 1, include: includeFields,
    });
    const list = rows.slice(0, limit);
    res.json(successResponse({ list: list.map(serialize), nextCursor: rows.length > limit ? String(list[list.length - 1].id) : null }));
  } catch (error) { next(error); }
};

export const createReportDocument = async (req: Request, res: Response, next: NextFunction) => {
  let persisted = false;
  try {
    const ownerId = userId(req);
    const { reportDate, name, note, clientOperationId } = req.body;
    const unique = { userId_clientOperationId: { userId: ownerId, clientOperationId } };
    let report = await prisma.reportDocument.findUnique({ where: unique, include: includeFields });
    if (!report) {
      try {
        report = await prisma.reportDocument.create({ data: {
          userId: ownerId, reportDate: new Date(`${reportDate}T00:00:00.000Z`), name, note: note || null,
          clientOperationId,
          storageKey: req.file ? path.relative(PRIVATE_REPORT_ROOT, req.file.path).split(path.sep).join('/') : null,
          // Only content type and size are needed; do not retain the user's original filename.
          mimeType: req.file?.mimetype || null, byteSize: req.file?.size || null,
        }, include: includeFields });
        persisted = true;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        report = await prisma.reportDocument.findUnique({ where: unique, include: includeFields });
        if (!report) throw error;
      }
    }
    if (report.deletedAt) throw new AppError('这条报告已删除，请重新建立草稿', ErrorCodes.PARAM_ERROR, 410);
    res.status(persisted ? 201 : 200).json(successResponse(serialize(report)));
  } catch (error) { next(error); }
  finally {
    if (!persisted && req.file) await removeReportFile(req.file.path).catch(() => undefined);
  }
};

export const addReportField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = userId(req);
    const id = BigInt(req.params.id);
    const field = await prisma.$transaction(async tx => {
      // Lock the active parent so deletion cannot race a field insert.
      const active = await tx.reportDocument.updateMany({
        where: { id, userId: ownerId, deletedAt: null }, data: { updatedAt: new Date() },
      });
      if (!active.count) throw notFound();
      const unique = { reportDocumentId_pageNumber_fieldKey: { reportDocumentId: id, pageNumber: 1, fieldKey: req.body.fieldKey } };
      const existing = await tx.reportField.findUnique({ where: unique });
      if (existing) return existing;
      if (await tx.reportField.count({ where: { reportDocumentId: id } }) >= 100) {
        throw new AppError('每份报告最多记录 100 个字段', ErrorCodes.PARAM_ERROR, 400);
      }
      return tx.reportField.create({ data: {
        reportDocumentId: id, ...req.body, source: 'manual', normalizedValue: null, confirmedAt: null,
      } });
    });
    res.status(201).json(successResponse(serializeField(field)));
  } catch (error) { next(error); }
};

export const confirmReportField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = userId(req);
    const where = {
      id: BigInt(req.params.fieldId), reportDocumentId: BigInt(req.params.id),
      reportDocument: { userId: ownerId, deletedAt: null },
    };
    const field = await prisma.reportField.findFirst({ where });
    if (!field) throw notFound();
    const updated = await prisma.reportField.updateMany({
      where: { ...where, version: req.body.version },
      data: { normalizedValue: req.body.normalizedValue, confirmedAt: new Date(), version: { increment: 1 } },
    });
    if (!updated.count) throw new AppError('字段已更新，请刷新后重新核对', ErrorCodes.PARAM_ERROR, 409);
    const result = await prisma.reportField.findFirst({ where });
    if (!result) throw notFound();
    res.json(successResponse(serializeField(result)));
  } catch (error) { next(error); }
};

export const downloadReportDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = userId(req);
    const report = await prisma.reportDocument.findFirst({ where: { id: BigInt(req.params.id), userId: ownerId, deletedAt: null } });
    if (!report?.storageKey) throw notFound();
    const filePath = resolveReportPath(report.storageKey, String(ownerId));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', report.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="report-${report.id}"`);
    res.sendFile(filePath, { cacheControl: false, lastModified: false }, error => {
      if (error && !res.headersSent) {
        res.removeHeader('Content-Type');
        next(notFound());
      }
    });
  } catch (error) { next(error); }
};

export const deleteReportDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = userId(req);
    const id = BigInt(req.params.id);
    const report = await prisma.reportDocument.findFirst({ where: { id, userId: ownerId } });
    if (!report) throw notFound();
    // Keep an empty tombstone so a timed-out creation retry cannot resurrect a deleted archive.
    await prisma.$transaction([
      prisma.reportDocument.update({ where: { id }, data: { deletedAt: new Date(), name: '', note: null, originalFilename: null } }),
      prisma.reportField.deleteMany({ where: { reportDocumentId: id } }),
    ]);
    if (report.storageKey) {
      await removeReportFile(resolveReportPath(report.storageKey, String(ownerId)));
      await prisma.reportDocument.update({ where: { id }, data: { storageKey: null, mimeType: null, byteSize: null } });
    }
    res.json(successResponse({ id: String(id) }));
  } catch (error) { next(error); }
};
