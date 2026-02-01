import dayjs from 'dayjs'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import type { EventRenderer, ICalendarEventBase } from '../interfaces'
import { getRelativeTopInDay } from '../utils/datetime'

import { useCalendarTouchableOpacityProps } from '../hooks/useCalendarTouchableOpacityProps'
import { DraggableEventWrapper } from './DraggableEventWrapper'

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
  cellHeight?: number
  onEventDrop?: (event: T, newDate: Date) => void
}

export function CalendarMarker<T extends ICalendarEventBase>({
  event,
  minHour,
  hours,
  renderEvent,
  onPressEvent,
  cellHeight = 50, // Default if not passed
  onEventDrop,
}: CalendarMarkerProps<T>) {
  const top = getRelativeTopInDay(dayjs(event.start), minHour, hours)

  // Position the outer wrapper
  const wrapperStyle: any = [
    styles.container,
    { top: `${top}%`, marginTop: -6 }
  ]

  const touchableOpacityProps = useCalendarTouchableOpacityProps({
    event,
    onPressEvent,
    injectedStyles: [{ position: 'absolute', width: '100%' }], // Ensure child fills wrapper
  })

  // Center the marker vertically on the time
  // Using simplified styling for now
  const color = (event as any).color || 'red'

  // Content can be custom (from ScheduleScreen) or default
  const content = renderEvent
    ? renderEvent(event, touchableOpacityProps)
    : (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.marker, { backgroundColor: color }]} />
        <View style={[styles.line, { backgroundColor: color }]} />
      </View>
    )

  return (
    <DraggableEventWrapper
      style={wrapperStyle}
      eventStart={dayjs(event.start).toDate()}
      minHour={minHour}
      cellHeight={cellHeight}
      onDrop={(newDate) => onEventDrop?.(event, newDate)}
      enabled={!!onEventDrop}
    >
      {content}
    </DraggableEventWrapper>
  )
}
