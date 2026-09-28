import { test, expect } from '@playwright/test'
import { buildCalendarFile } from '../src/utils/calendarExport'
import type { CalendarEvent } from '../../shared/types'

const event: CalendarEvent = {
  id: 17, userId: 'fixture-user', title: '产检预约', description: '记得带检查资料',
  eventDate: '2026-12-31T00:00:00.000Z', eventType: 'checkup',
  isCompleted: false, reminderEnabled: false, status: '0',
  createdAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T00:00:00.000Z',
}

test('calendar file preserves an ISO date as an all-day date and has RFC required properties', () => {
  const contents = buildCalendarFile(event)
  const lines = contents.split('\r\n')
  expect(lines).toContain('VERSION:2.0')
  expect(lines).toContain('BEGIN:VEVENT')
  expect(lines.filter((line) => line.startsWith('UID:'))).toHaveLength(1)
  expect(lines.find((line) => line.startsWith('DTSTAMP:'))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/)
  expect(lines).toContain('DTSTART;VALUE=DATE:20261231')
  expect(contents).toMatch(/^BEGIN:VCALENDAR\r\n[\s\S]*END:VEVENT\r\nEND:VCALENDAR\r\n$/)
  expect(contents.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/)
})

test('calendar file preserves a scheduled time and configured reminder interval', () => {
  const contents = buildCalendarFile({ ...event, eventDate: '2028-02-29', startTime: '09:05', reminderEnabled: true, reminderMinutes: 30 })
  expect(contents).toContain('DTSTART:20280229T090500\r\n')
  expect(contents).toContain('BEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\n')
  expect(contents).toContain('END:VALARM\r\n')
})

test('disabled reminder emits no alarm and a newly enabled reminder defaults to one day', () => {
  expect(buildCalendarFile({ ...event, reminderMinutes: 30 })).not.toContain('VALARM')
  expect(buildCalendarFile({ ...event, reminderEnabled: true })).toContain('TRIGGER:-PT1440M\r\n')
})

test('Chinese and emoji fields fold at 75 UTF-8 octets and round-trip escaped text without injecting properties', () => {
  const title = `${'孕育健康记录🌸'.repeat(12)},检查;带资料\\原件`
  const description = '第一行\r\n第二行,分号;反斜线\\\nBEGIN:VEVENT'
  const contents = buildCalendarFile({ ...event, title, description, reminderEnabled: true })
  const physicalLines = contents.split('\r\n')
  for (const line of physicalLines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  expect(physicalLines.some((line) => line.startsWith(' '))).toBe(true)
  const unfolded = contents.replace(/\r\n[ \t]/g, '')
  const fields = unfolded.split('\r\n')
  expect(fields.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(1)
  expect(fields.find((line) => line.startsWith('SUMMARY:'))).toBe(`SUMMARY:${'孕育健康记录🌸'.repeat(12)}\\,检查\\;带资料\\\\原件`)
  expect(fields.find((line) => line.startsWith('DESCRIPTION:'))).toBe('DESCRIPTION:第一行\\n第二行\\,分号\\;反斜线\\\\\\nBEGIN:VEVENT')
  expect(unfolded).not.toContain('\uFFFD')
})
