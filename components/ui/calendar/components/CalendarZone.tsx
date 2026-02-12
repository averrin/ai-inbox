import dayjs from 'dayjs'
import React from 'react'
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import type { ICalendarEventBase } from '../interfaces'
import { getRelativeTopInDay, DAY_MINUTES } from '../utils/datetime'
import { LinearGradient } from 'expo-linear-gradient'
import { hexToRgba } from '../../color-picker/colorUtils'

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
  onPress,
}: CalendarZoneProps<T> & { onPress?: () => void }) {
  const start = dayjs(event.start)
  const end = dayjs(event.end)
  const top = getRelativeTopInDay(start, minHour, hours)

  const totalMinutesInRange = (DAY_MINUTES / 24) * hours
  const durationInMinutes = end.diff(start, 'minute')
  const relativeHeight = 100 * (1 / totalMinutesInRange) * durationInMinutes

  // Default to semi-transparent gray if no color provided
  const color = (event as any).color || '#64748b' // Default slate-500 if missing
  const borderColor = (event as any).borderColor || color
  const borderWidth = (event as any).borderWidth !== undefined ? (event as any).borderWidth : 2
  
  // Z-Index Logic: 
  // Free Time (empty) zones = 0 (bottom)
  // Titled/Custom Zones = 2 (above free time, below standard events which start at 10)
  const isFreeTime = (event as any).typeTag === 'FREE_TIME';
  const zIndex = isFreeTime ? 0 : 2;

  // Generate diagonal stripes with opacity
  const step = 0.05
  const stripeColors: string[] = []
  const stripeLocations: number[] = []

  // Ensure color is a valid string before converting
  const bgRgba = isFreeTime ? 'rgba(200, 255, 200, 0.3)' : hexToRgba(color.startsWith('#') ? color : '#64748b', 0.6)

  for (let i = 0; i < 20; i++) {
    const isColor = i % 2 === 1
    const c = isColor ? bgRgba : 'transparent'
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
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          top: `${top}%`,
          height: `${relativeHeight}%`,
          borderColor: borderColor,
          borderWidth: borderWidth,
          // borderStyle: 'dashed',
          borderRadius: 4,
          overflow: 'visible', // Changed from hidden to visible to allow touches on badges 
          borderLeftWidth: 0,
          borderRightWidth: 0,
          borderTopWidth: borderWidth, 
          borderBottomWidth: borderWidth,
          zIndex: zIndex,
        }
      ]}
    >
      {/* Background Gradient Layer - pointerEvents none so clicks fall through to grid if needed, 
          but actually we want the zone background to specific NOT block touches unless we want to allow editing the whole zone?
          Requirement says "open zone edit modal on pressing on zone's badge". 
          So general zone area should probable NOT capture touches if it overlays other things.
      */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 4 }]} pointerEvents="none">
         <LinearGradient
            colors={stripeColors as any}
            locations={stripeLocations as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
      </View>

      {/* Title (for non-FREE_TIME zones) */}
      {(event as any).typeTag !== 'FREE_TIME' && (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            paddingHorizontal: 6,
            paddingVertical: 4,
            zIndex: 10000,
            backgroundColor: borderColor || '#f1f5f9',
            borderRadius: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 2,
            elevation: 2,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.1)'
          }}
        >
          <Text style={{ color: '#bfc9d8ff', fontSize: 11, fontWeight: 'bold' }} numberOfLines={1}>
            {event.title}
          </Text>
        </TouchableOpacity>
      )}

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
          top: 4, // Align with title
        }}
      >
        <Text style={{ color: borderColor || 'white', fontSize: 10, fontWeight: 'bold' }}>
          {durationStr}
        </Text>
      </View>
    </View>
  )
}
