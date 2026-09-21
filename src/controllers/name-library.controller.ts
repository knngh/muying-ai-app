import { Request, Response, NextFunction } from 'express';
import { successResponse } from '../middlewares/error.middleware';
import { filterNameLibrary } from '../services/name-library.service';

export const getNames = (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse(filterNameLibrary(req.query as unknown as Parameters<typeof filterNameLibrary>[0])));
  } catch (error) {
    next(error);
  }
};
