import dayjs from 'dayjs'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import type { EventRenderer, ICalendarEventBase } from '../interfaces'
import { getRelativeTopInDay } from '../utils/datetime'

import { useCalendarTouchableOpacityProps } from '../hooks/useCalendarTouchableOpacityProps'

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    // pointerEvents: 'none',
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'red', // Default, should override with event color
    marginLeft: 4,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'red', // Default
    opacity: 0.5,
  },
})

interface CalendarMarkerProps<T extends ICalendarEventBase> {
  event: T
  minHour: number
  hours: number
  renderEvent?: EventRenderer<T>
  onPressEvent?: (event: T) => void
}

export function CalendarMarker<T extends ICalendarEventBase>({
  event,
  minHour,
  hours,
  renderEvent,
  onPressEvent,
}: CalendarMarkerProps<T>) {
  const top = getRelativeTopInDay(dayjs(event.start), minHour, hours)

  const touchableOpacityProps = useCalendarTouchableOpacityProps({
    event,
    onPressEvent,
    injectedStyles: [
      styles.container,
      { top: `${top}%`, marginTop: -6 }, // Default centering for standard marker
    ],
  })

  // If renderEvent is provided, use it
  if (renderEvent) {
    return renderEvent(event, touchableOpacityProps)
  }

  // Center the marker vertically on the time
  // Using simplified styling for now
  const color = (event as any).color || 'red'

  return (
    <View style={[styles.container, { top: `${top}%`, marginTop: -6 }]}>
      <View style={[styles.marker, { backgroundColor: color }]} />
      <View style={[styles.line, { backgroundColor: color }]} />
    </View>
  )
}
