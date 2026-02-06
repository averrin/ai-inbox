import dayjs from 'dayjs'
import React from 'react'
import { StyleSheet, View, Text } from 'react-native'
import type { ICalendarEventBase } from '../interfaces'
import { getRelativeTopInDay, DAY_MINUTES } from '../utils/datetime'

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 6, // Narrow strip
    zIndex: 150, // Above normal events?
    borderRadius: 3,
  },
})

interface CalendarRangeProps<T extends ICalendarEventBase> {
  event: T
  minHour: number
  hours: number
  offset?: number
  hasEventOverlap?: boolean
}

export function CalendarRange<T extends ICalendarEventBase>({
  event,
  minHour,
  hours,
  offset = 0,
  hasEventOverlap = false,
}: CalendarRangeProps<T>) {
  const start = dayjs(event.start)
  const end = dayjs(event.end)
  const top = getRelativeTopInDay(start, minHour, hours)

  const totalMinutesInRange = (DAY_MINUTES / 24) * hours
  const durationInMinutes = end.diff(start, 'minute')
  const relativeHeight = 100 * (1 / totalMinutesInRange) * durationInMinutes

  const color = (event as any).color || 'blue'
  const title = (event as any).title || ''

  // Calculate actual pixel height to determine if title should be shown
  // Assuming typical hour height of ~60px, adjust if needed
  const shouldShowTitle = relativeHeight > 5

  return (
    <View
      style={[
        styles.container,
        {
          top: `${top}%`,
          height: `${relativeHeight}%`,
          backgroundColor: color,
          left: hasEventOverlap ? offset * 8 : 0, // No offset when no overlap
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000-offset,
        }
      ]}
    >
      {shouldShowTitle && title && (
        <Text
          style={{
            fontSize: 12,
            fontWeight: 'bold',
            color: color,
            width: 120, // Ensure strictly defined width for rotation stability
            textAlign: 'center',
            textShadowColor: 'black',
            textShadowRadius: 8,
            textShadowOffset: { width: 0, height: 0 }, // Outline effect
            transform: [
              { rotate: '90deg' }
            ],
            marginLeft: 16,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      )}
    </View>
  )
}
