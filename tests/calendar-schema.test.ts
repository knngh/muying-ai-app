import {
  createEventBody,
  dragEventBody,
  getEventsQuery,
  updateEventBody,
  weekDateQuery,
  weekQuery,
} from '../src/schemas/calendar.schema';

describe('calendar schemas', () => {
  it('accepts valid date-only calendar inputs', () => {
    expect(createEventBody.parse({
      title: '产检',
      eventType: 'checkup',
      eventDate: '2026-04-26',
      eventTime: '09:30',
      endDate: '',
      endTime: '',
    })).toMatchObject({
      eventDate: '2026-04-26',
      eventTime: '09:30',
    });

    expect(updateEventBody.parse({
      eventDate: '2026-04-27',
      eventTime: null,
      endDate: null,
    })).toEqual({
      eventDate: '2026-04-27',
      eventTime: null,
      endDate: null,
    });
  });

  it('rejects impossible dates before controllers call new Date', () => {
    expect(createEventBody.safeParse({
      title: '产检',
      eventType: 'checkup',
      eventDate: '2026-02-31',
    }).success).toBe(false);

    expect(getEventsQuery.safeParse({
      startDate: '2026-04-01',
      endDate: 'not-a-date',
    }).success).toBe(false);

    expect(weekDateQuery.safeParse({ date: '2026-13-01' }).success).toBe(false);
    expect(dragEventBody.safeParse({ newDate: '2026-00-10' }).success).toBe(false);
  });

  it('rejects invalid time and week query values', () => {
    expect(createEventBody.safeParse({
      title: '提醒',
      eventType: 'reminder',
      eventDate: '2026-04-26',
      eventTime: '24:00',
    }).success).toBe(false);

    expect(weekQuery.parse({ week: '12' })).toEqual({ week: 12 });
    expect(weekQuery.safeParse({ week: '0' }).success).toBe(false);
    expect(weekQuery.safeParse({ week: '41' }).success).toBe(false);
  });
});
