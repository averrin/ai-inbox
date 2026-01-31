import dayjs from 'dayjs'
import * as React from 'react'
import {
  type AccessibilityProps,
  Platform,
  StyleSheet,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { u } from '../commonStyles'
import { useNow } from '../hooks/useNow'
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
} from '../utils/datetime'
import { typedMemo } from '../utils/react'
import { CalendarEvent } from './CalendarEvent'
import { CalendarMarker } from './CalendarMarker'
import { CalendarRange } from './CalendarRange'
import { CalendarZone } from './CalendarZone'
import { HourGuideCell } from './HourGuideCell'
import { HourGuideColumn } from './HourGuideColumn'

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
  enableEnrichedEvents?: boolean
  eventsAreSorted?: boolean
  timeslots?: number
  hourComponent?: HourRenderer
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
  enableEnrichedEvents = false,
  eventsAreSorted = false,
  timeslots = 0,
  hourComponent,
  refreshControl,
}: CalendarBodyProps<T> & { refreshControl?: React.ReactElement }) {
  const scrollView = React.useRef<ScrollView>(null)
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

  // Helper to count how many ranges are active at the event's START time
  const getOverlappingRangeCount = React.useCallback((event: T, allRanges: T[]): number => {
    const eventStart = dayjs(event.start)

    const count = allRanges.filter(range => {
      const rangeStart = dayjs(range.start)
      const rangeEnd = dayjs(range.end)

      // Check if the event START time falls within this range
      // Use half-open interval [start, end): inclusive start, exclusive end
      // This prevents double-counting for events exactly on boundaries
      const isActive = (eventStart.isAfter(rangeStart) || eventStart.isSame(rangeStart, 'minute')) &&
        eventStart.isBefore(rangeEnd) &&  // Exclusive end
        rangeStart.isSame(eventStart, 'day')

      return isActive
    }).length

    return count
  }, [])

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
    if (scrollView.current && scrollOffsetMinutes && Platform.OS !== 'ios') {
      // We add delay here to work correct on React Native
      // see: https://stackoverflow.com/questions/33208477/react-native-android-scrollview-scrollto-not-working
      timeout = setTimeout(
        () => {
          if (scrollView?.current) {
            scrollView.current.scrollTo({
              y: (cellHeight * scrollOffsetMinutes) / 60,
              animated: false,
            })
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
  }, [scrollOffsetMinutes, cellHeight])

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
      // Events are being sorted once so we dont have to do it on each loop
      const sortedEvents = standardEvents.sort((a, b) => a.start.getDate() - b.start.getDate())
      return sortedEvents.map((event) => ({
        ...event,
        overlapPosition: getOrderOfEvent(event, sortedEvents),
        overlapCount: getCountOfEventsAtEvent(event, sortedEvents),
      }))
    }

    return standardEvents
  }, [enableEnrichedEvents, standardEvents, isEventOrderingEnabled])

  const _renderMappedEvent = React.useCallback(
    (event: T, index: number) => {
      // Add range overlap count to event
      const enrichedEvent = {
        ...event,
        rangeOverlapCount: getOverlappingRangeCount(event, ranges)
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
      getOverlappingRangeCount,
      ranges,
    ],
  )

  const _renderRanges = React.useCallback(
    (date: dayjs.Dayjs) => {
      const dayRanges = ranges.filter((event) => dayjs(event.start).isSame(date, 'day'))

      // Calculate offsets based on range-to-range overlap
      // Build the offsets array sequentially so we can reference previous values
      const rangeOffsets: number[] = []
      for (let index = 0; index < dayRanges.length; index++) {
        const range = dayRanges[index]
        const rangeStart = dayjs(range.start)
        const rangeEnd = dayjs(range.end)

        // Count how many PREVIOUS ranges in the list overlap with this one
        let offset = 0
        for (let i = 0; i < index; i++) {
          const otherRange = dayRanges[i]
          const otherStart = dayjs(otherRange.start)
          const otherEnd = dayjs(otherRange.end)

          // Check if ranges overlap in time
          const overlaps = rangeStart.isBefore(otherEnd) && rangeEnd.isAfter(otherStart) &&
            !rangeEnd.isSame(otherStart, 'minute') && !rangeStart.isSame(otherEnd, 'minute')

          if (overlaps) {
            const otherOffset = rangeOffsets[i]
            offset = Math.max(offset, otherOffset + 1)
          }
        }

        rangeOffsets.push(offset)
      }

      return dayRanges.map((event, index) => {
        const offset = rangeOffsets[index]
        const hasEventOverlap = offset > 0  // Range has overlap if offset > 0

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
    [ranges, minHour, hours.length],
  )

  const _renderZones = React.useCallback(
    (date: dayjs.Dayjs) => {
      return zones
        .filter((event) => dayjs(event.start).isSame(date, 'day'))
        .map((event, index) => (
          <CalendarZone
            key={`zone-${index}-${event.start}-${event.title}`}
            event={event}
            minHour={minHour}
            hours={hours.length}
          />
        ))
    },
    [zones, minHour, hours.length],
  )

  const _renderMarkers = React.useCallback(
    (date: dayjs.Dayjs) => {
      return markers
        .filter((event) => dayjs(event.start).isSame(date, 'day'))
        .map((event, index) => {
          // Add range overlap count to marker
          const enrichedEvent = {
            ...event,
            rangeOverlapCount: getOverlappingRangeCount(event, ranges)
          }

          return (
            <CalendarMarker
              key={`marker-${index}-${event.start}-${event.title}`}
              event={enrichedEvent}
              minHour={minHour}
              hours={hours.length}
              renderEvent={renderEvent}
              onPressEvent={onPressEvent}
            />
          )
        })
    },
    [markers, minHour, hours.length, renderEvent, onPressEvent, getOverlappingRangeCount, ranges],
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
        refreshControl={refreshControl}
      >
        <View style={[u['flex-1'], theme.isRTL ? u['flex-row-reverse'] : u['flex-row']]}>
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
            <View style={[u['flex-1'], u['overflow-hidden']]} key={date.toString()}>
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
        </View>
      </ScrollView>
    </React.Fragment>
  )
}

export const CalendarBody = typedMemo(_CalendarBody)
