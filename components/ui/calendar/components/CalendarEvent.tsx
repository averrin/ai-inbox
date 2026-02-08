import dayjs from 'dayjs'
import * as React from 'react'
import type { AccessibilityProps } from 'react-native'
import { OVERLAP_OFFSET, u } from '../commonStyles'
import { useCalendarTouchableOpacityProps } from '../hooks/useCalendarTouchableOpacityProps'
import type { EventCellStyle, EventRenderer, ICalendarEventBase, Mode } from '../interfaces'
import { useTheme } from '../theme/ThemeContext'
import { DAY_MINUTES, getRelativeTopInDay, getStyleForOverlappingEvent } from '../utils/datetime'
import { typedMemo } from '../utils/react'
import { DefaultCalendarEventRenderer } from './DefaultCalendarEventRenderer'

import { DraggableEventWrapper } from './DraggableEventWrapper'

const getEventCellPositionStyle = (start: Date, end: Date, minHour: number, hours: number) => {
  const totalMinutesInRange = (DAY_MINUTES / 24) * hours
  const durationInMinutes = dayjs(end).diff(start, 'minute')
  const relativeHeight = 100 * (1 / totalMinutesInRange) * durationInMinutes
  const relativeTop = getRelativeTopInDay(dayjs(start), minHour, hours)
  const relativeTopOffset = (minHour * 60) / DAY_MINUTES
  return {
    height: `${relativeHeight}%`,
    top: `${relativeTop - relativeTopOffset}%`,
  }
}

interface CalendarEventProps<T extends ICalendarEventBase> {
  event: T
  onPressEvent?: (event: T) => void
  eventCellStyle?: EventCellStyle<T>
  eventCellTextColor?: string
  eventCellAccessibilityProps?: AccessibilityProps
  showTime: boolean
  eventCount?: number
  eventOrder?: number
  overlapOffset?: number
  renderEvent?: EventRenderer<T>
  ampm: boolean
  mode?: Mode
  maxHour?: number
  minHour?: number
  hours?: number
  isNow?: boolean
  cellHeight?: number
  onEventDrop?: (event: T, newDate: Date) => void
}

function _CalendarEvent<T extends ICalendarEventBase>({
  event,
  onPressEvent,
  eventCellStyle,
  eventCellAccessibilityProps = {},
  eventCellTextColor,
  showTime,
  eventCount = 1,
  eventOrder = 0,
  overlapOffset = OVERLAP_OFFSET,
  renderEvent,
  ampm,
  mode,
  minHour = 0,
  hours = 24,
  isNow,
  cellHeight = 50,
  onEventDrop,
}: CalendarEventProps<T>) {
  const theme = useTheme()

  const palettes = React.useMemo(
    () => [theme.palette.primary, ...theme.eventCellOverlappings],
    [theme],
  )

  const overlapStyles = React.useMemo(() => {
    return getStyleForOverlappingEvent(eventOrder, overlapOffset, palettes, eventCount)
  }, [eventOrder, overlapOffset, palettes, eventCount])

  const { backgroundColor: overlapBackgroundColor, ...layoutOnlyOverlapStyles } = (overlapStyles as any)

  const layoutStyles = React.useMemo(() => {
    return mode === 'schedule'
      ? [layoutOnlyOverlapStyles]
      : [
        getEventCellPositionStyle(event.start, event.end, minHour, hours),
        layoutOnlyOverlapStyles,
        u.absolute,
        u['mt-2'],
      ]
  }, [mode, layoutOnlyOverlapStyles, event.start, event.end, minHour, hours])

  const isMovable = (event as any).movable
  const canDrag = isMovable && !!onEventDrop && mode !== 'schedule'

  const touchableOpacityProps = useCalendarTouchableOpacityProps({
    event,
    eventCellStyle,
    eventCellAccessibilityProps,
    onPressEvent,
    injectedStyles: canDrag 
      ? [u.absolute, { width: '100%', height: '100%' }] 
      : [{ backgroundColor: overlapBackgroundColor }, ...layoutStyles],
  })

  const textColor = React.useMemo(() => {
    const fgColors = palettes.map((p) => p.contrastText)
    return fgColors[eventCount % fgColors.length] || fgColors[0]
  }, [eventCount, palettes])

  const content = renderEvent
    ? renderEvent(event, touchableOpacityProps)
    : (
      <DefaultCalendarEventRenderer
        event={event}
        showTime={showTime}
        ampm={ampm}
        touchableOpacityProps={touchableOpacityProps}
        textColor={eventCellTextColor || textColor}
        isNow={event.isNow || isNow}
      />
    )

  if (!canDrag) {
    return content
  }

  return (
    <DraggableEventWrapper
      eventStart={dayjs(event.start).toDate()}
      minHour={minHour}
      cellHeight={cellHeight}
      onDrop={(newDate) => onEventDrop?.(event, newDate)}
      enabled={true}
      style={layoutStyles}
    >
      {content}
    </DraggableEventWrapper>
  )
}

export const CalendarEvent = typedMemo(_CalendarEvent)
