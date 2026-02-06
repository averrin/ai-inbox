import dayjs from 'dayjs'
import React, { useState } from 'react'
import { StyleSheet, View, Text, LayoutChangeEvent } from 'react-native'
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
  const baseColor = (event as any).color || 'rgba(100,116,139, 0.5)' // slate-500 equivalent default
  const borderColor = (event as any).borderColor || baseColor
  const borderWidth = (event as any).borderWidth !== undefined ? (event as any).borderWidth : 2

  const [layout, setLayout] = useState<{width: number, height: number} | null>(null)

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width > 0 && height > 0) {
      setLayout({ width, height })
    }
  }

  // Generate fixed-angle stripes
  let gradientElement = null
  if (layout) {
    const { width, height } = layout
    const STRIPE_WIDTH = 10 // px
    // We want the pattern to cover the box with 45 degree stripes.
    // The gradient line (perpendicular to stripes) should be -45 or 45 degrees.
    // Let's produce stripes running Bottom-Left to Top-Right (/).
    // The gradient line runs Top-Left to Bottom-Right (\).
    // Vector (1, 1).
    // To ensure we cover the whole rectangle (w, h), we need the gradient vector
    // to extend far enough to project the furthest corner (w, h) onto it.
    // A vector (w+h, w+h) covers it.

    const L = width + height
    const end = { x: L / width, y: L / height }

    const diagonalLen = Math.sqrt(L * L + L * L) // L * sqrt(2)
    const step = (STRIPE_WIDTH * 2) / diagonalLen // *2 for period (color + gap)

    const colors: string[] = []
    const locations: number[] = []

    let t = 0
    while (t < 1) {
      const tStart = t
      const tMid = Math.min(t + step * 0.5, 1)
      const tEnd = Math.min(t + step, 1)

      // Color Band
      colors.push(baseColor, baseColor)
      locations.push(tStart, tMid)

      // Transparent Band
      if (tMid < 1) {
        colors.push('transparent', 'transparent')
        locations.push(tMid, tEnd)
      }

      t += step
    }

    gradientElement = (
      <LinearGradient
        colors={colors}
        locations={locations}
        start={{ x: 0, y: 0 }}
        end={end}
        style={{ flex: 1 }}
      />
    )
  }

  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      style={[
        styles.container,
        {
          top: `${top}%`,
          height: `${relativeHeight}%`,
          borderColor: borderColor,
          borderWidth: borderWidth,
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: 'rgba(15, 23, 42, 0.2)', // Slight tint (slate-900 alpha)
        }
      ]}
    >
      {gradientElement}

      {/* Duration Badge */}
      <View style={[styles.badge, { borderColor: baseColor }]}>
        <Text style={[styles.badgeText, { color: baseColor }]}>
            {durationInMinutes}m
        </Text>
      </View>
    </View>
  )
}
