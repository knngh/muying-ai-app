import type { CalendarEvent } from '@/api/modules'
import { dateOnly } from './dateOnly'

function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&')
}

// RFC 5545 lines are limited to 75 octets; Chinese labels need byte-aware folding.
function foldLine(line: string) {
  const encoder = new TextEncoder()
  let width = 0
  let folded = ''
  for (const char of line) {
    const bytes = encoder.encode(char).length
    if (width + bytes > 75) { folded += '\r\n '; width = 1 }
    folded += char
    width += bytes
  }
  return folded
}

export function buildCalendarFile(event: CalendarEvent): string {
  const date = dateOnly(event.eventDate).replace(/-/g, '')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Beihu//Calendar//ZH',
    'BEGIN:VEVENT', `UID:beihu-${event.id}@beihu.me`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    event.startTime
      ? `DTSTART:${date}T${event.startTime.replace(/:/g, '')}00`
      : `DTSTART;VALUE=DATE:${date}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description || '')}`,
  ]
  if (event.reminderEnabled) {
    lines.push('BEGIN:VALARM', `TRIGGER:-PT${event.reminderMinutes || 1440}M`, 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(event.title)}`, 'END:VALARM')
  }
  lines.push('END:VEVENT', 'END:VCALENDAR', '')
  return lines.map(foldLine).join('\r\n')
}

export function downloadCalendarEvent(event: CalendarEvent) {
  const url = URL.createObjectURL(new Blob([buildCalendarFile(event)], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `beihu-event-${event.id}.ics`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
