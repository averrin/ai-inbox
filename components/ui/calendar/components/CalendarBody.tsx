import dayjs from 'dayjs'
import * as React from 'react'
import {
  type AccessibilityProps,
  Platform,
  StyleSheet,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
  type RefreshControlProps,
  RefreshControl,
} from 'react-native'
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated'
import { u } from '../commonStyles'
import { useNow } from '../hooks/useNow'
import isBetween from 'dayjs/plugin/isBetween'

dayjs.extend(isBetween)
import type {
  CalendarCellStyle,
  EventCellStyle,
  EventRenderer,
  HourRenderer,
  ICalendarEventBase,
} from '../interfaces'
import { useTheme } from '../theme/ThemeContext'
import {
  SIMPLE_DATE_FORMAT,
  enrichEvents,
  getCountOfEventsAtEvent,
  getOrderOfEvent,
  getRelativeTopInDay,
  isToday,
  calculateEventLayout,
} from '../utils/datetime'
import { typedMemo } from '../utils/react'
import { CalendarEvent } from './CalendarEvent'
import { CalendarMarker } from './CalendarMarker'
import { CalendarRange } from './CalendarRange'
import { CalendarZone } from './CalendarZone'
import { HourGuideCell } from './HourGuideCell'
import { HourGuideColumn } from './HourGuideColumn'
import { QuickEntryMarker } from './QuickEntryMarker'
import * as Haptics from 'expo-haptics'
import { QuickActionMenu } from './QuickActionMenu'

const styles = StyleSheet.create({
  nowIndicator: {
    position: 'absolute',
    zIndex: 10000,
    height: 2,
    width: '100%',
  },
})

interface CalendarBodyProps<T extends ICalendarEventBase> {
  cellHeight: number
  containerHeight: number
  dateRange: dayjs.Dayjs[]
  events: T[]
  scrollOffsetMinutes: number
  ampm: boolean
  showTime: boolean
  style: ViewStyle
  eventCellTextColor?: string
  eventCellStyle?: EventCellStyle<T>
  eventCellAccessibilityProps?: AccessibilityProps
  calendarCellStyle?: CalendarCellStyle
  calendarCellAccessibilityProps?: AccessibilityProps
  hideNowIndicator?: boolean
  overlapOffset?: number
  onLongPressCell?: (date: Date) => void
  onPressCell?: (date: Date) => void
  onPressEvent?: (event: T) => void
  renderEvent?: EventRenderer<T>
  headerComponent?: React.ReactElement | null
  headerComponentStyle?: ViewStyle
  hourStyle?: TextStyle
  hideHours?: boolean
  minHour?: number
  maxHour?: number
  isEventOrderingEnabled?: boolean
  showWeekNumber?: boolean
  showVerticalScrollIndicator?: boolean
  scrollEnabled?: boolean
  enrichedEventsByDate?: Record<string, T[]>
  hourComponent?: HourRenderer
  enableEnrichedEvents?: boolean
  eventsAreSorted?: boolean
  timeslots?: number
  timeslotHeight?: number
  onQuickAction?: (action: 'event' | 'reminder', date: Date) => void
  onEventDrop?: (event: T, newDate: Date) => void
  refreshing?: boolean
  onRefresh?: () => void
}

function _CalendarBody<T extends ICalendarEventBase>({
  containerHeight,
  cellHeight,
  dateRange,
  style,
  onLongPressCell,
  onPressCell,
  events,
  onPressEvent,
  eventCellTextColor,
  eventCellStyle,
  eventCellAccessibilityProps = {},
  calendarCellStyle,
  calendarCellAccessibilityProps = {},
  ampm,
  showTime,
  scrollOffsetMinutes,
  hideNowIndicator,
  overlapOffset,
  renderEvent,
  headerComponent = null,
  headerComponentStyle = {},
  hourStyle = {},
  hideHours = false,
  minHour = 0,
  maxHour = 23,
  isEventOrderingEnabled = true,
  showWeekNumber = false,
  showVerticalScrollIndicator = false,
  scrollEnabled = true,
  enrichedEventsByDate,
  hourComponent,
  refreshControl,
  enableEnrichedEvents = false,
  eventsAreSorted = false,
  timeslots = 0,
  onQuickAction,
  onEventDrop,
  refreshing,
  onRefresh,
}: CalendarBodyProps<T> & { refreshControl?: React.ReactElement<RefreshControlProps> }) {
  const scrollView = React.useRef<ScrollView>(null)
  const [hasScrolled, setHasScrolled] = React.useState(false)
  const { now } = useNow(!hideNowIndicator)
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i)

  const { markers, zones, ranges, standardEvents } = React.useMemo(() => {
    const markers: T[] = []
    const zones: T[] = []
    const ranges: T[] = []
    const standardEvents: T[] = []

    events.forEach((e) => {
      if (e.type === 'marker') markers.push(e)
      else if (e.type === 'zone') zones.push(e)
      else if (e.type === 'range') ranges.push(e)
      else standardEvents.push(e)
    })

    return { markers, zones, ranges, standardEvents }
  }, [events])

  // --- Gesture Handling ---
  const gestureActive = useSharedValue(false)
  const touchY = useSharedValue(0)
  const touchX = useSharedValue(0)

  // Menu state - kept in JS state because it needs to mount/unmount content
  const [menuVisible, setMenuVisible] = React.useState(false)
  const [menuPosition, setMenuPosition] = React.useState({ top: 0, left: 0 })
  const [selectedDateForAction, setSelectedDateForAction] = React.useState<Date | null>(null)

  // Calculate snap interval (15 minutes)
  const SNAP_MINUTES = 15
  const SNAP_HEIGHT = (cellHeight * SNAP_MINUTES) / 60

  const handleLongPressStart = React.useCallback(
    () => {
      try {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium)
      } catch (e) {
        // Haptics not available
      }
    },
    [],
  )

  const handleQuickActionTrigger = React.useCallback(
    (action: 'event' | 'reminder', date: Date) => {
      onQuickAction?.(action, date)
    },
    [onQuickAction]
  )

  const handleGestureEnd = React.useCallback(
    (y: number, x: number) => {
      // Show menu
      setMenuVisible(true)
      setMenuPosition({ top: y, left: x })

      // Calculate date from Y position
      const snapHeight = (cellHeight * 15) / 60
      const snappedY = Math.floor(y / snapHeight) * snapHeight

      // Determine day index (simplified)
      const dayIndex = 0

      // Calculate minutes from start of day (accounting for minHour if needed? 
      // y=0 is minHour. cellHeight covers 1 hour.

      // If Y is pixels from top of scrolling content...
      // content starts at minHour.
      // So y / cellHeight = hours since minHour.

      const hoursFromMinHour = snappedY / cellHeight
      const totalMinutesFromStartOfDay = (minHour * 60) + (hoursFromMinHour * 60)

      if (dateRange[dayIndex]) {
        // Use dayjs to robustly construct date
        // Re-construct from format string to ensure Local 00:00 anchor
        const baseDate = dayjs(dateRange[dayIndex].format('YYYY-MM-DD'))
          .startOf('day')
          .add(totalMinutesFromStartOfDay, 'minute')
          .toDate()

        setSelectedDateForAction(baseDate)
      }
    },
    [cellHeight, dateRange, minHour]
  )

  const gesture = React.useMemo(() => {
    return Gesture.Pan()
      .activateAfterLongPress(500)
      .onStart((e) => {
        gestureActive.value = true
        touchY.value = e.y
        touchX.value = e.x
        runOnJS(handleLongPressStart)()
      })
      .onUpdate((e) => {
        touchY.value = e.y
        touchX.value = e.x
      })
      .onEnd(() => {
        gestureActive.value = false
        runOnJS(handleGestureEnd)(touchY.value, touchX.value)
      })
  }, [gestureActive, touchY, touchX, handleLongPressStart, handleGestureEnd])

  const handleMenuAction = (action: 'event' | 'reminder') => {
    setMenuVisible(false)
    if (selectedDateForAction) {
      onQuickAction?.(action, selectedDateForAction)
    }
  }

  // Pre-calculate offsets for all ranges (grouped by day)
  const rangeOffsetsByEvent = React.useMemo(() => {
    const map = new Map<T, number>()

    // Group ranges by day
    const rangesByDay = new Map<string, T[]>()
    ranges.forEach((r) => {
      const d = dayjs(r.start).format(SIMPLE_DATE_FORMAT)
      if (!rangesByDay.has(d)) rangesByDay.set(d, [])
      rangesByDay.get(d)!.push(r)
    })

    // Calculate offsets for each day
    rangesByDay.forEach((dayRanges) => {
      // Sort ranges by start time for deterministic layout
      dayRanges.sort((a, b) => a.start.getTime() - b.start.getTime())

      const currentOffsets: number[] = []
      for (let index = 0; index < dayRanges.length; index++) {
        const range = dayRanges[index]
        const rangeStart = dayjs(range.start)
        const rangeEnd = dayjs(range.end)

        const usedOffsets = new Set<number>()

        for (let i = 0; i < index; i++) {
          const otherRange = dayRanges[i]
          const otherStart = dayjs(otherRange.start)
          const otherEnd = dayjs(otherRange.end)

          // Check if ranges overlap in time
          const overlaps =
            rangeStart.isBefore(otherEnd) &&
            rangeEnd.isAfter(otherStart) &&
            !rangeEnd.isSame(otherStart, 'minute') &&
            !rangeStart.isSame(otherEnd, 'minute')

          if (overlaps) {
            const otherOffset = currentOffsets[i]
            usedOffsets.add(otherOffset)
          }
        }

        let offset = 0
        while (usedOffsets.has(offset)) {
          offset++
        }

        currentOffsets.push(offset)
        map.set(range, offset)
      }
    })

    return map
  }, [ranges])

  // Helper to find the maximum offset of any overlapping range
  const getMaxOverlappingRangeIndex = React.useCallback(
    (event: T, allRanges: T[], offsetsMap: Map<T, number>): number => {
      const eventStart = dayjs(event.start)
      const eventEnd = dayjs(event.end)

      const overlappingRanges = allRanges.filter((range) => {
        const rangeStart = dayjs(range.start)
        const rangeEnd = dayjs(range.end)

        // Check if ranges overlap in time
        // Overlap if (StartA < EndB) and (EndA > StartB)
        const isActive =
          eventStart.isBefore(rangeEnd) &&
          eventEnd.isAfter(rangeStart) &&
          !eventEnd.isSame(rangeStart, 'minute') &&
          !eventStart.isSame(rangeEnd, 'minute') &&
          rangeStart.isSame(eventStart, 'day')

        return isActive
      })

      if (overlappingRanges.length === 0) return -1

      let maxIndex = -1
      overlappingRanges.forEach((r) => {
        const offset = offsetsMap.get(r)
        if (offset !== undefined) {
          maxIndex = Math.max(maxIndex, offset)
        }
      })

      return maxIndex
    },
    [],
  )

  // Helper to check if any events overlap with ranges on a given day
  const hasEventsOverlappingRanges = React.useCallback((date: dayjs.Dayjs, allRanges: T[], allEvents: T[]): boolean => {
    const dayRanges = allRanges.filter(r => dayjs(r.start).isSame(date, 'day'))
    if (dayRanges.length === 0) return false

    const dayEvents = allEvents.filter(e => dayjs(e.start).isSame(date, 'day'))

    return dayEvents.some(event => {
      const eventStart = dayjs(event.start)
      const eventEnd = dayjs(event.end)

      return dayRanges.some(range => {
        const rangeStart = dayjs(range.start)
        const rangeEnd = dayjs(range.end)
        // Exclude exact boundary matches
        return rangeStart.isBefore(eventEnd) && rangeEnd.isAfter(eventStart) &&
          !rangeEnd.isSame(eventStart, 'minute') && !rangeStart.isSame(eventEnd, 'minute')
      })
    })
  }, [])

  React.useEffect(() => {
    let timeout: NodeJS.Timeout
    if (scrollView.current && scrollOffsetMinutes && Platform.OS !== 'ios' && !hasScrolled && !refreshing) {
      // We add delay here to work correct on React Native
      // see: https://stackoverflow.com/questions/33208477/react-native-android-scrollview-scrollto-not-working
      timeout = setTimeout(
        () => {
          if (scrollView?.current) {
            scrollView.current.scrollTo({
              y: (cellHeight * scrollOffsetMinutes) / 60,
              animated: false,
            })
            setHasScrolled(true)
          }
        },
        Platform.OS === 'web' ? 0 : 10,
      )
    }
    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [scrollOffsetMinutes, cellHeight, hasScrolled, refreshing])

  const _onPressCell = React.useCallback(
    (date: dayjs.Dayjs) => {
      onPressCell?.(date.toDate())
    },
    [onPressCell],
  )

  const _onLongPressCell = React.useCallback(
    (date: dayjs.Dayjs) => {
      onLongPressCell?.(date.toDate())
    },
    [onLongPressCell],
  )

  const internalEnrichedEventsByDate = React.useMemo(() => {
    if (enableEnrichedEvents) {
      return enrichedEventsByDate || enrichEvents(standardEvents, eventsAreSorted)
    }
    return {}
  }, [enableEnrichedEvents, enrichedEventsByDate, standardEvents, eventsAreSorted])

  const enrichedEvents = React.useMemo(() => {
    if (enableEnrichedEvents) return []

    if (isEventOrderingEnabled) {
      return calculateEventLayout(standardEvents)
    }

    return standardEvents
  }, [enableEnrichedEvents, standardEvents, isEventOrderingEnabled])

  const _renderMappedEvent = React.useCallback(
    (event: T, index: number) => {
      // Calculate range overlap count based on max index of overlapping ranges
      const maxRangeIndex = getMaxOverlappingRangeIndex(event, ranges, rangeOffsetsByEvent)
      const rangeOverlapCount = maxRangeIndex + 1

      const start = dayjs(event.start)
      const end = dayjs(event.end)
      const isNow = dayjs(now).isBetween(start, end, null, '[)') || 
                    ((dayjs(now).isAfter(start) || dayjs(now).isSame(start)) && dayjs(now).isBefore(end))

      const enrichedEvent = {
        ...event,
        rangeOverlapCount,
        isNow,
      }

      return (
        <CalendarEvent
          key={`${index}${event.start}${event.title}${event.end}`}
          event={enrichedEvent}
          onPressEvent={onPressEvent}
          eventCellStyle={eventCellStyle}
          eventCellAccessibilityProps={eventCellAccessibilityProps}
          eventCellTextColor={eventCellTextColor}
          showTime={showTime}
          eventCount={event.overlapCount}
          eventOrder={event.overlapPosition}
          overlapOffset={overlapOffset}
          renderEvent={renderEvent}
          ampm={ampm}
          maxHour={maxHour}
          minHour={minHour}
          hours={hours.length}
        />
      )
    },
    [
      ampm,
      eventCellStyle,
      eventCellTextColor,
      eventCellAccessibilityProps,
      onPressEvent,
      overlapOffset,
      renderEvent,
      showTime,
      maxHour,
      minHour,
      hours.length,
      getMaxOverlappingRangeIndex,
      ranges,
      rangeOffsetsByEvent,
    ],
  )

  const _renderRanges = React.useCallback(
    (date: dayjs.Dayjs) => {
      const dayRanges = ranges.filter((event) => dayjs(event.start).isSame(date, 'day'))

      return dayRanges.map((event, index) => {
        const offset = rangeOffsetsByEvent.get(event) || 0
        const hasEventOverlap = offset > 0 // Range has overlap if offset > 0

        return (
          <CalendarRange
            key={`range-${index}-${event.start}-${event.title}`}
            event={event}
            minHour={minHour}
            hours={hours.length}
            offset={offset}
            hasEventOverlap={hasEventOverlap}
          />
        )
      })
    },
    [ranges, minHour, hours.length, rangeOffsetsByEvent],
  )

  const _renderZones = React.useCallback(
    (date: dayjs.Dayjs) => {
      return zones
        .filter((event) => {
          const eventStart = dayjs(event.start)
          const eventEnd = dayjs(event.end)
          return eventStart.isBefore(date.endOf('day')) && eventEnd.isAfter(date.startOf('day'))
        })
        .map((event, index) => {
          // Adjust start/end for the current day to ensure correct top/height calculation
          const start = dayjs(event.start).isAfter(date.startOf('day')) 
            ? event.start 
            : date.startOf('day').toDate()
          const end = dayjs(event.end).isBefore(date.endOf('day')) 
            ? event.end 
            : date.endOf('day').toDate()
          const adjustedEvent = { ...event, start, end }

          return (
            <CalendarZone
              key={`zone-${index}-${event.start}-${event.title}`}
              event={adjustedEvent}
              minHour={minHour}
              hours={hours.length}
            />
          )
        })
    },
    [zones, minHour, hours.length],
  )

  const _renderMarkers = React.useCallback(
    (date: dayjs.Dayjs) => {
      return markers
        .filter((event) => dayjs(event.start).isSame(date, 'day'))
        .map((event, index) => {
          // Add range overlap count to marker
          const maxRangeIndex = getMaxOverlappingRangeIndex(event, ranges, rangeOffsetsByEvent)
          const rangeOverlapCount = maxRangeIndex + 1

          const enrichedEvent = {
            ...event,
            rangeOverlapCount,
          }

          return (
            <CalendarMarker
              key={`marker-${index}-${event.start}-${event.title}`}
              event={enrichedEvent}
              minHour={minHour}
              hours={hours.length}
              renderEvent={renderEvent}
              onPressEvent={onPressEvent}
              cellHeight={cellHeight}
              onEventDrop={onEventDrop}
            />
          )
        })
    },
    [
      markers,
      minHour,
      hours.length,
      renderEvent,
      onPressEvent,
      getMaxOverlappingRangeIndex,
      ranges,
      rangeOffsetsByEvent,
    ],
  )

  const _renderEvents = React.useCallback(
    (date: dayjs.Dayjs) => {
      if (enableEnrichedEvents) {
        return (internalEnrichedEventsByDate[date.format(SIMPLE_DATE_FORMAT)] || []).map(
          _renderMappedEvent,
        )
      }

      return (
        <>
          {/* Render events of this date */}
          {/* M  T  (W)  T  F  S  S */}
          {/*       S-E             */}
          {(enrichedEvents as T[])
            .filter(({ start }) =>
              dayjs(start).isBetween(date.startOf('day'), date.endOf('day'), null, '[)'),
            )
            .map(_renderMappedEvent)}

          {/* Render events which starts before this date and ends on this date */}
          {/* M  T  (W)  T  F  S  S */}
          {/* S------E              */}
          {(enrichedEvents as T[])
            .filter(
              ({ start, end }) =>
                dayjs(start).isBefore(date.startOf('day')) &&
                dayjs(end).isBetween(date.startOf('day'), date.endOf('day'), null, '[)'),
            )
            .map((event) => ({
              ...event,
              start: dayjs(event.end).startOf('day'),
            }))
            .map(_renderMappedEvent)}

          {/* Render events which starts before this date and ends after this date */}
          {/* M  T  (W)  T  F  S  S */}
          {/*    S-------E          */}
          {(enrichedEvents as T[])
            .filter(
              ({ start, end }) =>
                dayjs(start).isBefore(date.startOf('day')) && dayjs(end).isAfter(date.endOf('day')),
            )
            .map((event) => ({
              ...event,
              start: dayjs(event.end).startOf('day'),
              end: dayjs(event.end).endOf('day'),
            }))
            .map(_renderMappedEvent)}
        </>
      )
    },
    [_renderMappedEvent, enableEnrichedEvents, enrichedEvents, internalEnrichedEventsByDate],
  )

  const theme = useTheme()

  return (
    <React.Fragment>
      {headerComponent != null ? <View style={headerComponentStyle}>{headerComponent}</View> : null}
      <ScrollView
        style={[
          {
            height: containerHeight - cellHeight * 3,
          },
          style,
        ]}
        ref={scrollView}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={showVerticalScrollIndicator}
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled
        contentOffset={Platform.OS === 'ios' ? { x: 0, y: scrollOffsetMinutes } : { x: 0, y: 0 }}
        refreshControl={
          refreshControl || (onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={theme.palette.primary.main}
              colors={[theme.palette.primary.main]}
            />
          ) : undefined)
        }
      >
        <View style={[theme.isRTL ? u['flex-row-reverse'] : u['flex-row']]}>
          {(!hideHours || showWeekNumber) && (
            <View style={[u['z-20'], u['w-50']]}>
              {hours.map((hour) => (
                <HourGuideColumn
                  key={hour}
                  cellHeight={cellHeight}
                  hour={hour}
                  ampm={ampm}
                  hourStyle={hourStyle}
                  calendarCellAccessibilityProps={calendarCellAccessibilityProps}
                  hourComponent={hourComponent}
                />
              ))}
            </View>
          )}

          {dateRange.map((date) => (
            <View style={[u['flex-1'], { overflow: 'visible' }]} key={date.toString()}>
              <GestureDetector gesture={gesture}>
                <View style={StyleSheet.absoluteFill}>
                  {hours.map((hour, index) => (
                    <HourGuideCell
                      key={hour}
                      cellHeight={cellHeight}
                      date={date}
                      hour={hour}
                      onLongPress={_onLongPressCell}
                      onPress={_onPressCell}
                      index={index}
                      calendarCellStyle={calendarCellStyle}
                      calendarCellAccessibilityProps={calendarCellAccessibilityProps}
                      timeslots={timeslots}
                    />
                  ))}
                </View>
              </GestureDetector>
              {_renderZones(date)}
              {_renderRanges(date)}
              {_renderEvents(date)}
              {_renderMarkers(date)}
              {isToday(date) && !hideNowIndicator && (
                <View
                  style={[
                    styles.nowIndicator,
                    { backgroundColor: theme.palette.nowIndicator },
                    {
                      top: `${getRelativeTopInDay(now, minHour, hours.length)}%`,
                    },
                  ]}
                />
              )}
            </View>
          ))}

          {/* Overlay for Visual Markers - Now inside content view to share coordinate system */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <QuickEntryMarker touchY={touchY} isActive={gestureActive} cellHeight={cellHeight} minHour={minHour} />
          </View>

          {menuVisible && (
            <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={() => setMenuVisible(false)}
                activeOpacity={1}
              />
              <QuickActionMenu
                top={menuPosition.top}
                left={menuPosition.left}
                onAction={handleMenuAction}
              />
            </View>
          )}

        </View>
      </ScrollView>
    </React.Fragment>
  )
}

export const CalendarBody = typedMemo(_CalendarBody)
