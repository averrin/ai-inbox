import dayjs from 'dayjs'
import React from 'react'
import { StyleSheet, View, Text } from 'react-native'
import type { ICalendarEventBase } from '../interfaces'
import { getRelativeTopInDay, DAY_MINUTES } from '../utils/datetime'
import { LinearGradient } from 'expo-linear-gradient'

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    zIndex: 0, // Behind events
  },
})

interface CalendarZoneProps<T extends ICalendarEventBase> {
  event: T
  minHour: number
  hours: number
}

export function CalendarZone<T extends ICalendarEventBase>({
  event,
  minHour,
  hours,
}: CalendarZoneProps<T>) {
  const start = dayjs(event.start)
  const end = dayjs(event.end)
  const top = getRelativeTopInDay(start, minHour, hours)

  const totalMinutesInRange = (DAY_MINUTES / 24) * hours
  const durationInMinutes = end.diff(start, 'minute')
  const relativeHeight = 100 * (1 / totalMinutesInRange) * durationInMinutes

  // Default to semi-transparent gray if no color provided
  const color = (event as any).color || 'rgba(0,0,0,0.05)'
  const borderColor = (event as any).borderColor || color
  const borderWidth = (event as any).borderWidth !== undefined ? (event as any).borderWidth : 2

  // Generate diagonal stripes
  const step = 0.05
  const stripeColors: string[] = []
  const stripeLocations: number[] = []

  for (let i = 0; i < 20; i++) {
    const isColor = i % 2 === 1
    const c = isColor ? color : 'transparent'
    stripeColors.push(c, c)
    stripeLocations.push(i * step, (i + 1) * step)
  }

  const durationStr = (() => {
    const h = Math.floor(durationInMinutes / 60)
    const m = durationInMinutes % 60
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
  })()

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          top: `${top}%`,
          height: `${relativeHeight}%`,
          borderColor: borderColor,
          borderWidth: borderWidth,
          // borderStyle: 'dashed',
          borderRadius: 4,
          overflow: 'hidden',
          justifyContent: 'center',
        }
      ]}
    >
      <LinearGradient
        colors={stripeColors as any}
        locations={stripeLocations as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Duration Badge */}
      <View
        style={{
          position: 'absolute',
          right: 4,
          backgroundColor: '#0f172a',
          borderColor: borderColor || '#334155',
          borderWidth: 1,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          zIndex: 10000,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 2,
          elevation: 4,
        }}
      >
        <Text style={{ color: borderColor || 'white', fontSize: 10, fontWeight: 'bold' }}>
          {durationStr}
        </Text>
      </View>
    </View>
  )
}
