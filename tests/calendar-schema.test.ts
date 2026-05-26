import {
  createEventBody,
  createCustomTodoBody,
  dragEventBody,
  getEventsQuery,
  saveDiaryBody,
  updateEventBody,
  updateTodoProgressBody,
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
    expect(weekQuery.safeParse({ week: '197' }).success).toBe(false);
  });

  it('accepts timeline keys for pregnancy and postpartum record inputs', () => {
    expect(weekQuery.parse({ timelineKey: 'pregnancy:w12' })).toEqual({ timelineKey: 'pregnancy:w12' });
    expect(weekQuery.parse({ timelineKey: 'postpartum:w156' })).toEqual({ timelineKey: 'postpartum:w156' });

    expect(updateTodoProgressBody.parse({
      timelineKey: 'postpartum:w01',
      todoKey: 'postpartum:w01:newborn-home-visit',
      completed: true,
    })).toMatchObject({
      timelineKey: 'postpartum:w01',
      completed: true,
    });

    expect(saveDiaryBody.parse({
      timelineKey: 'postpartum:w26',
      content: '今天开始记录辅食和睡眠。',
      imageUrls: ['/uploads/1710000000000-aabbccddeeff0011.jpg'],
    })).toMatchObject({
      timelineKey: 'postpartum:w26',
      imageUrls: ['/uploads/1710000000000-aabbccddeeff0011.jpg'],
    });

    expect(saveDiaryBody.parse({
      timelineKey: 'postpartum:w27',
      content: '',
      imageUrls: ['/uploads/1710000000000-aabbccddeeff0012.webp'],
    })).toMatchObject({
      timelineKey: 'postpartum:w27',
      content: '',
    });

    expect(createCustomTodoBody.parse({
      timelineKey: 'postpartum:w52',
      content: '整理一岁体检问题',
    })).toMatchObject({
      timelineKey: 'postpartum:w52',
    });
  });

  it('rejects missing or invalid timeline period inputs', () => {
    expect(weekQuery.safeParse({ timelineKey: 'postpartum:w157' }).success).toBe(false);
    expect(updateTodoProgressBody.safeParse({
      todoKey: 'feeding-output-log',
      completed: true,
    }).success).toBe(false);
    expect(saveDiaryBody.safeParse({
      timelineKey: 'pregnancy:w41',
      content: '越界',
    }).success).toBe(false);
    expect(saveDiaryBody.safeParse({
      timelineKey: 'postpartum:w02',
      content: '',
      imageUrls: [],
    }).success).toBe(false);
    expect(saveDiaryBody.safeParse({
      timelineKey: 'postpartum:w02',
      content: '照片地址不应该接受外链',
      imageUrls: ['https://example.com/image.jpg'],
    }).success).toBe(false);
    expect(saveDiaryBody.safeParse({
      timelineKey: 'postpartum:w02',
      content: '照片数量过多',
      imageUrls: [
        '/uploads/1710000000000-aabbccddeeff0001.jpg',
        '/uploads/1710000000000-aabbccddeeff0002.jpg',
        '/uploads/1710000000000-aabbccddeeff0003.jpg',
        '/uploads/1710000000000-aabbccddeeff0004.jpg',
      ],
    }).success).toBe(false);
    expect(createCustomTodoBody.safeParse({
      timelineKey: 'postpartum:week1',
      content: '格式不对',
    }).success).toBe(false);
  });
});
