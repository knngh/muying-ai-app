import { Request, Response, NextFunction } from 'express';
import { successResponse } from '../middlewares/error.middleware';
import { filterNameLibrary } from '../services/name-library.service';
import { evaluateNames } from '../services/name-evaluation.service';

export const getNames = (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse(filterNameLibrary(req.query as unknown as Parameters<typeof filterNameLibrary>[0])));
  } catch (error) {
    next(error);
  }
};

export const createNameEvaluation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(successResponse(await evaluateNames(req.body)));
  } catch (error) { next(error); }
};
