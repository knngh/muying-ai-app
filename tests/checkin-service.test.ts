const mockUserCheckinFindUnique = jest.fn();
const mockUserCheckinFindFirst = jest.fn();
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
      findFirst: mockUserCheckinFindFirst,
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

import { getCheckinStatus, performCheckin } from '../src/services/checkin.service';

function makeDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function makeDbDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function makeEndOfDay(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function buildUniqueConstraintError() {
  return new mockPrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002' });
}

describe('checkin.service', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(makeDate('2026-05-05'));

    mockUserCheckinFindUnique.mockReset();
    mockUserCheckinFindFirst.mockReset();
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
    mockUserCheckinFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 2n,
        checkinDate: makeDbDate('2026-05-04'),
        streakCount: 2,
        createdAt: makeDate('2026-05-04'),
      });
    mockUserUpdate.mockResolvedValue({ totalPoints: 120 });
    mockUserCheckinCount.mockResolvedValue(8);

    const result = await performCheckin('42');

    expect(mockUserCheckinCreate).toHaveBeenCalledWith({
      data: {
        userId: 42n,
        checkinDate: makeDbDate('2026-05-05'),
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

  it('returns current status for duplicate checkin before opening a transaction', async () => {
    mockUserCheckinFindFirst
      .mockResolvedValueOnce({
        id: 1n,
        checkinDate: makeDbDate('2026-05-05'),
        streakCount: 3,
        createdAt: makeDate('2026-05-05'),
      })
      .mockResolvedValueOnce({
        id: 1n,
        checkinDate: makeDbDate('2026-05-05'),
        streakCount: 3,
        createdAt: makeDate('2026-05-05'),
      });
    mockUserCheckinFindMany.mockResolvedValueOnce([
      { checkinDate: makeDbDate('2026-05-03') },
      { checkinDate: makeDbDate('2026-05-04') },
      { checkinDate: makeDbDate('2026-05-05') },
    ]);
    mockUserFindUniqueOrThrow.mockResolvedValue({ totalPoints: 120 });
    mockUserCheckinCount.mockResolvedValue(8);

    const result = await performCheckin('42');

    expect(result).toMatchObject({
      alreadyCheckedIn: true,
      checkedInToday: true,
      streakCount: 3,
      consecutiveDays: 3,
      streakDates: ['2026-05-03', '2026-05-04', '2026-05-05'],
      pointsAwarded: 0,
      pointsEarned: 0,
      totalPoints: 120,
      totalDays: 8,
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('maps unique constraint races to idempotent duplicate checkin status', async () => {
    mockUserCheckinFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 1n,
        checkinDate: makeDbDate('2026-05-05'),
        streakCount: 1,
        createdAt: makeDate('2026-05-05'),
      });
    mockUserCheckinFindMany.mockResolvedValueOnce([
      { checkinDate: makeDbDate('2026-05-05') },
    ]);
    mockUserFindUniqueOrThrow.mockResolvedValue({ totalPoints: 115 });
    mockUserCheckinCount.mockResolvedValue(7);
    mockTransaction.mockRejectedValue(buildUniqueConstraintError());

    const result = await performCheckin('42');

    expect(result).toMatchObject({
      alreadyCheckedIn: true,
      checkedInToday: true,
      streakCount: 1,
      consecutiveDays: 1,
      streakDates: ['2026-05-05'],
      pointsAwarded: 0,
      pointsEarned: 0,
      totalPoints: 115,
      totalDays: 7,
    });
  });

  it('returns checkin status with streak dates, total days, and monthly checkins', async () => {
    mockUserCheckinFindFirst.mockResolvedValue({
      id: 1n,
      checkinDate: makeDbDate('2026-05-05'),
      streakCount: 3,
      createdAt: makeDate('2026-05-05'),
    });
    mockUserCheckinFindMany.mockResolvedValueOnce([
      { checkinDate: makeDbDate('2026-05-03') },
      { checkinDate: makeDbDate('2026-05-04') },
      { checkinDate: makeDbDate('2026-05-05') },
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

  it('keeps yesterday streak visible before today is checked in', async () => {
    mockUserCheckinFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 1n,
        checkinDate: makeDbDate('2026-05-04'),
        streakCount: 1,
        createdAt: makeDate('2026-05-04'),
      });
    mockUserCheckinFindMany.mockResolvedValueOnce([
      { checkinDate: makeDbDate('2026-05-04'), createdAt: makeDate('2026-05-04') },
    ]);
    mockUserFindUniqueOrThrow.mockResolvedValue({ totalPoints: 105 });
    mockUserCheckinCount.mockResolvedValue(1);

    const status = await getCheckinStatus('42');

    expect(status).toMatchObject({
      checkedInToday: false,
      currentStreak: 1,
      consecutiveDays: 1,
      streakDates: ['2026-05-04'],
      totalDays: 1,
      totalPoints: 105,
      monthlyCheckins: ['2026-05-04'],
      nextBonusAt: 3,
      nextBonusPoints: 5,
    });
  });

  it('keeps today checked in when old DATE rows are shifted by local timezone', async () => {
    mockUserCheckinFindFirst.mockResolvedValue({
      id: 1n,
      checkinDate: makeDbDate('2026-05-04'),
      streakCount: 4,
      createdAt: makeDate('2026-05-05'),
    });
    mockUserCheckinFindMany.mockResolvedValueOnce([
      { checkinDate: makeDbDate('2026-05-04'), createdAt: makeDate('2026-05-05') },
    ]);
    mockUserFindUniqueOrThrow.mockResolvedValue({ totalPoints: 120 });
    mockUserCheckinCount.mockResolvedValue(8);

    const status = await getCheckinStatus('42');

    expect(mockUserCheckinFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        createdAt: {
          gte: makeDate('2026-05-05'),
          lte: makeEndOfDay('2026-05-05'),
        },
      }),
    }));
    expect(status).toMatchObject({
      checkedInToday: true,
      currentStreak: 4,
      consecutiveDays: 4,
      streakDates: ['2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05'],
      totalDays: 8,
      totalPoints: 120,
      monthlyCheckins: ['2026-05-05'],
      nextBonusAt: 7,
      nextBonusPoints: 10,
    });
  });
});
