// API date-only fields are serialized as UTC timestamps. Keep their calendar
// date rather than converting midnight UTC to the previous day in US timezones.
export function dateOnly(value: string | null | undefined): string {
  return value?.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0] || ''
}
