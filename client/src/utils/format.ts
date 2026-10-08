// Date-only values (YYYY-MM-DD) are shown as "08 Oct 2026". They are read as UTC dates so
// the day never shifts with the viewer's timezone.
export function formatDate(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Timestamps (ISO, UTC) are shown in the viewer's local timezone: "08 Oct 2026" and "09:10 AM".
export function formatTimestampDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
