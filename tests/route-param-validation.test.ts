import type { Router } from 'express';

const queryRateLimiter = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'query' });
const searchRateLimiter = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'search' });
const writeRateLimiter = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'write' });
const authMiddleware = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'auth' });

const validate = jest.fn((schema: { body?: unknown; params?: unknown; query?: unknown }) => {
  const parts = Object.keys(schema).sort();
  return Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), {
    _id: `validate:${parts.join('+')}`,
  });
});

const getArticles = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getArticles' });
const getArticleBySlug = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getArticleBySlug' });
const getAuthorityArticleTranslation = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getAuthorityArticleTranslation' });
const getRelatedArticles = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getRelatedArticles' });
const searchArticles = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'searchArticles' });
const likeArticle = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'likeArticle' });
const unlikeArticle = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'unlikeArticle' });
const favoriteArticle = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'favoriteArticle' });
const unfavoriteArticle = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'unfavoriteArticle' });
const getCacheStats = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getCacheStats' });

const getFavorites = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getFavorites' });
const addFavorite = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'addFavorite' });
const removeFavorite = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'removeFavorite' });
const getReadHistory = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getReadHistory' });
const recordReadHistory = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'recordReadHistory' });
const getUserStats = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getUserStats' });
const getPregnancyProfile = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getPregnancyProfile' });
const uploadImage = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'uploadImage' });

const getVaccines = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getVaccines' });
const getVaccineById = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getVaccineById' });
const getCategories = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getCategories' });
const getCategoryBySlug = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getCategoryBySlug' });
const getTags = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getTags' });
const getArticlesByTag = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getArticlesByTag' });
const checkin = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'checkin' });
const getCheckinStatus = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getCheckinStatus' });
const getPointsLogs = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getPointsLogs' });
const redeemPoints = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'redeemPoints' });

const calendarControllerNames = [
  'getEvents',
  'getWeekEvents',
  'getDayEvents',
  'getTodoProgress',
  'updateTodoProgress',
  'getPregnancyDiaries',
  'savePregnancyDiary',
  'deletePregnancyDiary',
  'getCustomTodos',
  'getStandardSchedule',
  'generateStandardSchedule',
  'createCustomTodo',
  'updateCustomTodo',
  'deleteCustomTodo',
  'createEvent',
  'updateEvent',
  'dragEvent',
  'batchUpdateEvents',
  'deleteEvent',
  'batchDeleteEvents',
  'completeEvent',
  'getEventTypes',
] as const;

const calendarControllers = Object.fromEntries(
  calendarControllerNames.map((name) => [
    name,
    Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: name }),
  ]),
) as Record<typeof calendarControllerNames[number], unknown>;

jest.mock('../src/middlewares/rateLimiter.middleware', () => ({
  queryRateLimiter,
  searchRateLimiter,
  writeRateLimiter,
}));

jest.mock('../src/middlewares/auth.middleware', () => ({
  authMiddleware,
}));

jest.mock('../src/middlewares/validate.middleware', () => ({
  validate,
}));

jest.mock('../src/middlewares/upload.middleware', () => ({
  uploadImage,
}));

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    user: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../src/controllers/article.controller', () => ({
  getArticles,
  getArticleBySlug,
  getAuthorityArticleTranslation,
  getRelatedArticles,
  searchArticles,
  likeArticle,
  unlikeArticle,
  favoriteArticle,
  unfavoriteArticle,
  getCacheStats,
}));

jest.mock('../src/controllers/user.controller', () => ({
  getFavorites,
  addFavorite,
  removeFavorite,
  getReadHistory,
  recordReadHistory,
  getUserStats,
  getPregnancyProfile,
}));

jest.mock('../src/controllers/vaccine.controller', () => ({
  getVaccines,
  getVaccineById,
}));

jest.mock('../src/controllers/category.controller', () => ({
  getCategories,
  getCategoryBySlug,
}));

jest.mock('../src/controllers/tag.controller', () => ({
  getTags,
  getArticlesByTag,
}));

jest.mock('../src/controllers/checkin.controller', () => ({
  checkin,
  getStatus: getCheckinStatus,
  getPointsLogs,
  redeemPoints,
}));

jest.mock('../src/controllers/calendar.controller', () => calendarControllers);

import articleRoutes from '../src/routes/article.routes';
import calendarRoutes from '../src/routes/calendar.routes';
import categoryRoutes from '../src/routes/category.routes';
import checkinRoutes from '../src/routes/checkin.routes';
import tagRoutes from '../src/routes/tag.routes';
import userRoutes from '../src/routes/user.routes';
import vaccineRoutes from '../src/routes/vaccine.routes';

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

function routeLayers(router: Router): RouteLayer[] {
  return (router as unknown as { stack: RouteLayer[] }).stack;
}

function findRoute(router: Router, path: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete') {
  const route = routeLayers(router).find((layer) => layer.route?.path === path && layer.route.methods[method])?.route;
  if (!route) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }
  return route;
}

function routeIndex(router: Router, path: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete'): number {
  return routeLayers(router).findIndex((layer) => layer.route?.path === path && layer.route.methods[method]);
}

function routeHandleIds(router: Router, path: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete'): string[] {
  return findRoute(router, path, method).stack.map((layer) => (layer.handle as { _id?: string })._id || 'unknown');
}

describe('route parameter validation', () => {
  it('validates article numeric id routes before controllers use BigInt', () => {
    expect(routeHandleIds(articleRoutes, '/:slug/translation', 'get')).toEqual(['query', 'validate:params', 'getAuthorityArticleTranslation']);
    expect(routeHandleIds(articleRoutes, '/:slug', 'get')).toEqual(['query', 'validate:params', 'getArticleBySlug']);
    expect(routeHandleIds(articleRoutes, '/:id/related', 'get')).toEqual(['query', 'validate:params+query', 'getRelatedArticles']);
    expect(routeHandleIds(articleRoutes, '/:id/like', 'post')).toEqual(['auth', 'write', 'validate:params', 'likeArticle']);
    expect(routeHandleIds(articleRoutes, '/:id/like', 'delete')).toEqual(['auth', 'write', 'validate:params', 'unlikeArticle']);
    expect(routeHandleIds(articleRoutes, '/:id/favorite', 'post')).toEqual(['auth', 'write', 'validate:params', 'favoriteArticle']);
    expect(routeHandleIds(articleRoutes, '/:id/favorite', 'delete')).toEqual(['auth', 'write', 'validate:params', 'unfavoriteArticle']);
  });

  it('validates user favorite and vaccine id params', () => {
    expect(routeHandleIds(userRoutes, '/favorites/:articleId', 'delete')).toEqual(['write', 'validate:params', 'removeFavorite']);
    expect(routeHandleIds(vaccineRoutes, '/', 'get')).toEqual(['query', 'validate:query', 'getVaccines']);
    expect(routeHandleIds(vaccineRoutes, '/:id', 'get')).toEqual(['query', 'validate:params', 'getVaccineById']);
  });

  it('validates category and tag params/query before controller parsing', () => {
    expect(routeHandleIds(categoryRoutes, '/', 'get')).toEqual(['query', 'validate:query', 'getCategories']);
    expect(routeHandleIds(categoryRoutes, '/:slug', 'get')).toEqual(['query', 'validate:params', 'getCategoryBySlug']);
    expect(routeHandleIds(tagRoutes, '/:slug/articles', 'get')).toEqual(['query', 'validate:params+query', 'getArticlesByTag']);
  });

  it('validates checkin point log query and redeem body', () => {
    expect(routeHandleIds(checkinRoutes, '/points-log', 'get')).toEqual(['query', 'validate:query', 'getPointsLogs']);
    expect(routeHandleIds(checkinRoutes, '/redeem', 'post')).toEqual(['write', 'validate:body', 'redeemPoints']);
  });

  it('keeps calendar batch delete reachable before the dynamic event id route', () => {
    expect(routeIndex(calendarRoutes, '/events/batch', 'delete')).toBeLessThan(routeIndex(calendarRoutes, '/events/:id', 'delete'));
    expect(routeHandleIds(calendarRoutes, '/events/batch', 'delete')).toEqual(['write', 'validate:body', 'batchDeleteEvents']);
    expect(routeHandleIds(calendarRoutes, '/events/:id', 'delete')).toEqual(['write', 'validate:params', 'deleteEvent']);
  });

  it('validates calendar route params before controller parsing', () => {
    expect(routeHandleIds(calendarRoutes, '/day/:date', 'get')).toEqual(['query', 'validate:params', 'getDayEvents']);
    expect(routeHandleIds(calendarRoutes, '/diaries/:week', 'delete')).toEqual(['write', 'validate:params', 'deletePregnancyDiary']);
    expect(routeHandleIds(calendarRoutes, '/custom-todos/:id', 'put')).toEqual(['write', 'validate:body+params', 'updateCustomTodo']);
    expect(routeHandleIds(calendarRoutes, '/custom-todos/:id', 'delete')).toEqual(['write', 'validate:params', 'deleteCustomTodo']);
    expect(routeHandleIds(calendarRoutes, '/events/:id', 'put')).toEqual(['write', 'validate:body+params', 'updateEvent']);
    expect(routeHandleIds(calendarRoutes, '/events/:id/drag', 'patch')).toEqual(['write', 'validate:body+params', 'dragEvent']);
    expect(routeHandleIds(calendarRoutes, '/events/:id/complete', 'post')).toEqual(['write', 'validate:params', 'completeEvent']);
  });
});
