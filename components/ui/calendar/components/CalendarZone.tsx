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
  badge: {
    position: 'absolute',
    top: '50%',
    right: 3,
    transform: [{ translateY: '-50%' }],
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#0f172a', // slate-900
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  }
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
        }
      ]}
    >
      <LinearGradient
        colors={stripeColors as any}
        locations={stripeLocations as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />

      {/* Duration Badge */}
      <View style={[styles.badge, { borderColor: color }]}>
        <Text style={[styles.badgeText, { color: color }]}>
            {durationInMinutes}m
        </Text>
      </View>
    </View>
  )
}
