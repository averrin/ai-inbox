import React from 'react'
import dayjs from 'dayjs'
import { useEventTypesStore } from '../../../../store/eventTypes'
import type { ICalendarEventBase } from '../interfaces'

export function useTimeRangeEvents(dateRange: dayjs.Dayjs[]): ICalendarEventBase[] {
    const { ranges } = useEventTypesStore()

    return React.useMemo(() => {
        const events: ICalendarEventBase[] = []

        if (!ranges || ranges.length === 0 || !dateRange || dateRange.length === 0) {
            return events
        }

        // Filter enabled ranges
        const enabledRanges = ranges.filter(r => r.isEnabled)

        // For each day in the view
        dateRange.forEach(date => {
            const dayOfWeek = date.day() // 0 (Sunday) to 6 (Saturday)

            // Find ranges active on this day
            enabledRanges.forEach(range => {
                if (range.days.includes(dayOfWeek)) {
                    // Construct start/end dates for this specific day
                    const start = date
                        .hour(range.start.hour)
                        .minute(range.start.minute)
                        .second(0)
                        .millisecond(0)
                        .toDate()

                    const end = date
                        .hour(range.end.hour)
                        .minute(range.end.minute)
                        .second(0)
                        .millisecond(0)
                        .toDate()

                    // If end time is before start time (e.g., spans midnight), handle it
                    // For simple daily ranges, we assume it ends next day if end < start
                    // But typically time ranges are within a day. 
                    // If a user sets 23:00 - 01:00, that's tricky. 
                    let finalEnd = end
                    if (dayjs(end).isBefore(dayjs(start))) {
                        finalEnd = dayjs(end).add(1, 'day').toDate()
                    }

                    events.push({
                        start,
                        end: finalEnd,
                        title: range.title,
                        color: range.color,
                        type: 'range',
                        isWork: range.isWork,
                    } as ICalendarEventBase & { color: string; isWork?: boolean })
                }
            })
        })

        return events
    }, [ranges, dateRange])
}
