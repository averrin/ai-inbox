import dayjs from 'dayjs'
import * as React from 'react'
import { Platform, Text, TouchableOpacity } from 'react-native'

import type { CalendarTouchableOpacityProps, ICalendarEventBase } from '../interfaces'
import { useTheme } from '../theme/ThemeContext'
import { formatStartEnd } from '../utils/datetime'

interface DefaultCalendarEventRendererProps<T extends ICalendarEventBase> {
  touchableOpacityProps: CalendarTouchableOpacityProps
  event: T
  showTime?: boolean
  textColor: string
  ampm: boolean
  isNow?: boolean
}

export function DefaultCalendarEventRenderer<T extends ICalendarEventBase>({
  touchableOpacityProps,
  event,
  showTime = true,
  textColor,
  ampm,
  isNow,
}: DefaultCalendarEventRendererProps<T>) {
  const theme = useTheme()
  const eventTimeStyle = { fontSize: theme.typography.xs.fontSize, color: textColor }
  const eventTitleStyle = { fontSize: theme.typography.sm.fontSize, color: textColor }
  
  const glowColor = theme.palette.primary.main;
  const nowStyle = isNow ? {
    zIndex: 1000,
    shadowColor: glowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 4,
    borderColor: glowColor,
    ...(Platform.OS === 'web' && {
      boxShadow: `0 8px 32px ${glowColor}88`,
    }),
  } : {}

  return (
    <TouchableOpacity {...touchableOpacityProps} style={[touchableOpacityProps.style, nowStyle]}>
      {dayjs(event.end).diff(event.start, 'minute') < 32 && showTime ? (
        <Text style={eventTitleStyle}>
          {event.title},
          <Text style={eventTimeStyle}>
            {dayjs(event.start).format(ampm ? 'hh:mm a' : 'HH:mm')}
          </Text>
        </Text>
      ) : (
        <>
          <Text style={eventTitleStyle}>{event.title}</Text>
          {showTime && (
            <Text style={eventTimeStyle}>
              {formatStartEnd(event.start, event.end, ampm ? 'h:mm a' : 'HH:mm')}
            </Text>
          )}
          {event.children && event.children}
        </>
      )}
    </TouchableOpacity>
  )
}
