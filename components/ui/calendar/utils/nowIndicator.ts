import dayjs from 'dayjs'

interface SimpleEvent {
  start: Date
  end: Date
}

interface UpcomingEvent {
  title: string
  minutesUntil: number
}

export function getNowIndicatorInfo(
  now: dayjs.Dayjs,
  activeEvent: SimpleEvent | undefined,
  ampm = false,
  upcomingEvent?: UpcomingEvent,
) {
  const timeText = now.format(ampm ? 'h:mm A' : 'HH:mm')

  if (!activeEvent) {
    if (upcomingEvent && upcomingEvent.minutesUntil > 0) {
      return `${timeText} • ${upcomingEvent.minutesUntil}m to ${upcomingEvent.title}`
    }
    return timeText
  }

  const start = dayjs(activeEvent.start)
  const end = dayjs(activeEvent.end)
  const totalMinutes = end.diff(start, 'minute')
  const elapsedMinutes = now.diff(start, 'minute')

  // Avoid division by zero and cases where end < start (invalid event)
  if (totalMinutes <= 0) {
    return timeText
  }

  // Ensure percentage is between 0 and 100
  const percentage = Math.min(100, Math.max(0, Math.round((elapsedMinutes / totalMinutes) * 100)))

  // Time left in minutes
  const timeLeft = end.diff(now, 'minute')

  // If time left is negative (event finished but slightly off), clamp to 0 or negative
  // But usually we want to show positive time left until it's over.
  // If event is over (now > end), we probably shouldn't show it as active.
  // The caller is responsible for passing an active event (now between start and end).

  return `${timeText} • ${percentage}% (${timeLeft}m left)`
}
