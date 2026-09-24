const mockPrisma = {
  expenseEntry: { findMany: jest.fn() },
  contractionSession: { findMany: jest.fn() },
  movementSession: { findMany: jest.fn() },
  pregnancyWeightRecord: { findMany: jest.fn() },
  diaryEntry: { findMany: jest.fn() },
  careLog: { findMany: jest.fn() },
  babyMeasurement: { findMany: jest.fn() },
  vaccinationRecord: { findMany: jest.fn() },
  foodTrial: { findMany: jest.fn() },
}

jest.mock('../src/config/database', () => ({ __esModule: true, default: mockPrisma }))

import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import routes from '../src/routes/tool-record.routes'
import { errorHandler } from '../src/middlewares/error.middleware'

const app = express()
app.use(express.json())
app.use('/tool-records', routes)
app.use(errorHandler)
const secret = 'tool-summary-route-test-secret-123456'
const auth = () => `Bearer ${jwt.sign({ userId: '91001' }, secret, { expiresIn: '1m' })}`
const originalSecret = process.env.JWT_SECRET

beforeEach(() => {
  process.env.JWT_SECRET = secret
  for (const model of Object.values(mockPrisma)) model.findMany.mockReset()
})
afterAll(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

it('requires auth and validates the annual summary year', async () => {
  await request(app).get('/tool-records/expenses/annual?year=2026').expect(401)
  await request(app).get('/tool-records/expenses/annual?year=1800').set('Authorization', auth()).expect(400)
  expect(mockPrisma.expenseEntry.findMany).not.toHaveBeenCalled()
})

it('returns a user-scoped annual expense summary', async () => {
  mockPrisma.expenseEntry.findMany.mockResolvedValue([
    { occurredAt: new Date('2026-01-02T00:00:00.000Z'), amountCents: 10000, direction: 'expense' },
    { occurredAt: new Date('2026-01-03T00:00:00.000Z'), amountCents: 2000, direction: 'refund' },
  ])
  const response = await request(app).get('/tool-records/expenses/annual?year=2026').set('Authorization', auth()).expect(200)
  expect(mockPrisma.expenseEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 91001n, occurredAt: { gte: new Date('2026-01-01T00:00:00.000Z'), lt: new Date('2027-01-01T00:00:00.000Z') } } }))
  expect(response.body.data).toMatchObject({ year: 2026, expenseCents: 10000, refundCents: 2000, netCents: 8000, entryCount: 2 })
})

it('returns grouped calendar records for a bounded date range', async () => {
  for (const model of Object.values(mockPrisma)) model.findMany.mockResolvedValue([])
  mockPrisma.contractionSession.findMany.mockResolvedValue([{ id: 1n, startedAt: new Date('2026-09-23T08:00:00.000Z'), durationSeconds: 40 }])
  const response = await request(app).get('/tool-records/calendar-summary?from=2026-09-23&to=2026-09-24').set('Authorization', auth()).expect(200)
  expect(response.body.data).toEqual([{ date: '2026-09-23', count: 1, records: [{ id: '1', toolId: 'contractions', date: '2026-09-23', title: '宫缩 40 秒' }] }])
})
