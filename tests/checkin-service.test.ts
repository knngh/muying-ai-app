const mockUserCheckinFindUnique = jest.fn();
const mockUserCheckinFindMany = jest.fn();
const mockUserCheckinCount = jest.fn();
const mockUserCheckinCreate = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserFindUniqueOrThrow = jest.fn();
const mockUserPointsLogCreate = jest.fn();
const mockTransaction = jest.fn();
const mockPrismaClientKnownRequestError = class PrismaClientKnownRequestError extends Error {
  code: string;

  constructor(message: string, options: { code: string }) {
    super(message);
    this.code = options.code;
  }
};

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    userCheckin: {
      findUnique: mockUserCheckinFindUnique,
      findMany: mockUserCheckinFindMany,
      count: mockUserCheckinCount,
      create: mockUserCheckinCreate,
    },
    user: {
      update: mockUserUpdate,
      findUniqueOrThrow: mockUserFindUniqueOrThrow,
    },
    userPointsLog: {
      create: mockUserPointsLogCreate,
    },
    $transaction: mockTransaction,
  },
}));

jest.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: mockPrismaClientKnownRequestError,
  },
}));

jest.mock('../src/services/cache.service', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

import { AppError, ErrorCodes } from '../src/middlewares/error.middleware';
import { getCheckinStatus, performCheckin } from '../src/services/checkin.service';

function makeDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function buildUniqueConstraintError() {
  return new mockPrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002' });
}

describe('checkin.service', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(makeDate('2026-05-05'));

    mockUserCheckinFindUnique.mockReset();
    mockUserCheckinFindMany.mockReset();
    mockUserCheckinCount.mockReset();
    mockUserCheckinCreate.mockReset();
    mockUserUpdate.mockReset();
    mockUserFindUniqueOrThrow.mockReset();
    mockUserPointsLogCreate.mockReset();
    mockTransaction.mockReset();

    mockTransaction.mockImplementation(async (callback) => callback({
      userCheckin: {
        create: mockUserCheckinCreate,
        count: mockUserCheckinCount,
      },
      user: {
        update: mockUserUpdate,
      },
      userPointsLog: {
        create: mockUserPointsLogCreate,
      },
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates one atomic checkin and returns frontend-compatible status fields', async () => {
    mockUserCheckinFindUnique.mockResolvedValue(null);
    mockUserCheckinFindMany.mockResolvedValue([
      { checkinDate: makeDate('2026-05-04') },
      { checkinDate: makeDate('2026-05-03') },
    ]);
    mockUserUpdate.mockResolvedValue({ totalPoints: 120 });
    mockUserCheckinCount.mockResolvedValue(8);

    const result = await performCheckin('42');

    expect(mockUserCheckinCreate).toHaveBeenCalledWith({
      data: {
        userId: 42n,
        checkinDate: makeDate('2026-05-05'),
        streakCount: 3,
        pointsAwarded: 10,
      },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 42n },
      data: { totalPoints: { increment: 10 } },
      select: { totalPoints: true },
    });
    expect(mockUserPointsLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42n,
        points: 10,
        balance: 120,
        source: 'checkin',
        sourceId: '2026-05-05',
      }),
    });
    expect(result).toMatchObject({
      checkinDate: '2026-05-05',
      streakCount: 3,
      consecutiveDays: 3,
      streakDates: ['2026-05-03', '2026-05-04', '2026-05-05'],
      totalDays: 8,
      checkedInToday: true,
      pointsAwarded: 10,
      pointsEarned: 10,
      totalPoints: 120,
      nextBonusAt: 7,
      nextBonusPoints: 10,
    });
  });

  it('rejects duplicate checkin before opening a transaction', async () => {
    mockUserCheckinFindUnique.mockResolvedValue({ id: 1n });

    await expect(performCheckin('42')).rejects.toMatchObject<AppError>({
      code: ErrorCodes.PARAM_ERROR,
      statusCode: 400,
      message: '今日已签到',
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('maps unique constraint races to duplicate checkin errors', async () => {
    mockUserCheckinFindUnique.mockResolvedValue(null);
    mockUserCheckinFindMany.mockResolvedValue([]);
    mockTransaction.mockRejectedValue(buildUniqueConstraintError());

    await expect(performCheckin('42')).rejects.toMatchObject<AppError>({
      code: ErrorCodes.PARAM_ERROR,
      statusCode: 400,
      message: '今日已签到',
    });
  });

  it('returns checkin status with streak dates, total days, and monthly checkins', async () => {
    mockUserCheckinFindUnique.mockResolvedValue({ id: 1n });
    mockUserCheckinFindMany
      .mockResolvedValueOnce([
        { checkinDate: makeDate('2026-05-05') },
        { checkinDate: makeDate('2026-05-04') },
        { checkinDate: makeDate('2026-05-03') },
      ])
      .mockResolvedValueOnce([
        { checkinDate: makeDate('2026-05-03') },
        { checkinDate: makeDate('2026-05-04') },
        { checkinDate: makeDate('2026-05-05') },
      ]);
    mockUserFindUniqueOrThrow.mockResolvedValue({ totalPoints: 120 });
    mockUserCheckinCount.mockResolvedValue(8);

    const status = await getCheckinStatus('42');

    expect(status).toMatchObject({
      checkedInToday: true,
      currentStreak: 3,
      consecutiveDays: 3,
      streakDates: ['2026-05-03', '2026-05-04', '2026-05-05'],
      totalDays: 8,
      totalPoints: 120,
      monthlyCheckins: ['2026-05-03', '2026-05-04', '2026-05-05'],
      nextBonusAt: 7,
      nextBonusPoints: 10,
    });
  });
});
