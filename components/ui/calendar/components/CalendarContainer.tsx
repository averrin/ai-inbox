import dayjs from 'dayjs'
import React, { useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { type AccessibilityProps, type TextStyle, type ViewStyle, type RefreshControlProps } from 'react-native'
import InfinitePager, { type InfinitePagerImperativeApi } from 'react-native-infinite-pager'

import { MIN_HEIGHT } from '../commonStyles'
import type {
  AllDayEventCellStyle,
  CalendarCellStyle,
  CalendarCellTextStyle,
  DateRangeHandler,
  EventCellStyle,
  EventRenderer,
  HeaderRenderer,
  HorizontalDirection,
  HourRenderer,
  ICalendarEventBase,
  Mode,
  MonthHeaderRenderer,
  WeekNum,
} from '../interfaces'
import { useTheme } from '../theme/ThemeContext'
import {
  getDatesInMonth,
  getDatesInNextCustomDays,
  getDatesInNextOneDay,
  getDatesInNextThreeDays,
  getDatesInWeek,
  isAllDayEvent,
  modeToNum,
} from '../utils/datetime'
import { typedMemo } from '../utils/react'
import { CalendarBody } from './CalendarBody'
import { CalendarBodyForMonthView } from './CalendarBodyForMonthView'
import { CalendarHeader } from './CalendarHeader'
import { CalendarHeaderForMonthView } from './CalendarHeaderForMonthView'
import { Schedule } from './Schedule'

// Imperative API for programmatic navigation
export interface CalendarRef {
  goNext: () => void
  goPrev: () => void
  goToDate: (date: Date) => void
}

export interface CalendarContainerProps<T extends ICalendarEventBase> {
  /**
   * To remove Hours Column from week View.
   */
  hideHours?: boolean
  /**
   * Events to be rendered. This is a required prop.
   */
  events: T[]

  /**
   * The height of calendar component. This is a required prop.
   */
  height: number

  /**
   * The height of each hour row.
   */
  hourRowHeight?: number

  /**
   * Adjusts the indentation of events that occur during the same time period. Defaults to 20 on web and 8 on mobile.
   */
  overlapOffset?: number

  /**
   * Custom style. It accepts styles or an array of styles, or a function that returns styles or an array of styles.
   */
  eventCellStyle?: EventCellStyle<T>
  eventCellTextColor?: string
  eventCellAccessibilityProps?: AccessibilityProps
  allDayEventCellStyle?: AllDayEventCellStyle<T>
  allDayEventCellTextColor?: string
  allDayEventCellAccessibilityProps?: AccessibilityProps
  calendarCellStyle?: CalendarCellStyle
  calendarCellTextStyle?: CalendarCellTextStyle
  calendarCellAccessibilityProps?: AccessibilityProps
  calendarCellAccessibilityPropsForMonthView?: AccessibilityProps
  calendarContainerStyle?: ViewStyle
  headerContainerStyle?: ViewStyle
  headerContainerAccessibilityProps?: AccessibilityProps
  headerContentStyle?: ViewStyle
  headerCellAccessibilityProps?: AccessibilityProps
  dayHeaderStyle?: ViewStyle
  dayHeaderHighlightColor?: string
  weekDayHeaderHighlightColor?: string
  bodyContainerStyle?: ViewStyle

  // Custom renderer
  renderEvent?: EventRenderer<T>
  renderHeader?: HeaderRenderer<T>
  renderHeaderForMonthView?: MonthHeaderRenderer
  renderCustomDateForMonth?: (date: Date) => React.ReactElement | null

  ampm?: boolean
  date?: Date
  locale?: string
  hideNowIndicator?: boolean
  showAdjacentMonths?: boolean
  mode?: Mode
  scrollOffsetMinutes?: number
  showTime?: boolean
  minHour?: number
  maxHour?: number
  swipeEnabled?: boolean
  weekStartsOn?: WeekNum
  onChangeDate?: DateRangeHandler
  onLongPressCell?: (date: Date) => void
  onPressCell?: (date: Date) => void
  resetPageOnPressCell?: boolean
  onPressDateHeader?: (date: Date) => void
  onPressEvent?: (event: T) => void
  weekEndsOn?: WeekNum
  maxVisibleEventCount?: number
  eventMinHeightForMonthView?: number
  activeDate?: Date
  headerComponent?: React.ReactElement | null
  headerComponentStyle?: ViewStyle
  hourStyle?: TextStyle
  showAllDayEventCell?: boolean
  sortedMonthView?: boolean
  moreLabel?: string
  isEventOrderingEnabled?: boolean

  //Week Number
  showWeekNumber?: boolean
  showSixWeeks?: boolean
  weekNumberPrefix?: string
  onPressMoreLabel?: (event: T[]) => void
  disableMonthEventCellPress?: boolean
  showVerticalScrollIndicator?: boolean
  /**
   * Indicates if the calendar body should be scrollable
   */
  verticalScrollEnabled?: boolean
  itemSeparatorComponent?:
  | React.ComponentType<{
    highlighted: boolean
  }>
  | null
  | undefined
  /**
   * Callback when the user swipes horizontally.
   * Note: Memoize this callback to avoid un-necessary re-renders.
   * @param date The date where the user swiped to.
   */
  onSwipeEnd?: (date: Date) => void
  /**
   * If provided, we will skip the internal process of building the enriched events by date dictionary.
   */
  enrichedEventsByDate?: Record<string, T[]>
  /**
   * If true, the events will be enriched with the following properties:
   * - `overlapPosition`: position of the event in the stack of overlapping events
   * Default value is `false`.
   */
  enableEnrichedEvents?: boolean
  /**
   * If true, skip the sorting of events improving the performance.
   * This parameter is ignored if `enableEnrichedEvents` is `false`.
   * Default value is `false`.
   */
  eventsAreSorted?: boolean
  timeslots?: number
  hourComponent?: HourRenderer
  scheduleMonthSeparatorStyle?: TextStyle
  refreshControl?: React.ReactElement<RefreshControlProps>
  /**
   * Imperative ref for programmatic navigation (goNext, goPrev, goToDate)
   */
  imperativeRef?: React.RefObject<CalendarRef | null>

  /**
   * Callback when a quick action is triggered via long-press
   */
  onQuickAction?: (action: 'event' | 'reminder' | 'zone', date: Date) => void
  onEventDrop?: (event: T, newDate: Date) => void
  refreshing?: boolean
  onRefresh?: () => void
}

function _CalendarContainer<T extends ICalendarEventBase>({
  events,
  height,
  hourRowHeight,
  ampm = false,
  date,
  allDayEventCellStyle = {},
  allDayEventCellTextColor = '',
  allDayEventCellAccessibilityProps = {},
  eventCellStyle,
  eventCellTextColor = '',
  eventCellAccessibilityProps = {},
  calendarCellAccessibilityPropsForMonthView = {},
  calendarCellStyle,
  calendarCellTextStyle,
  calendarCellAccessibilityProps = {},
  locale = 'en',
  hideNowIndicator = false,
  mode = 'week',
  overlapOffset,
  scrollOffsetMinutes = 0,
  showTime = true,
  headerContainerStyle = {},
  headerContainerAccessibilityProps = {},
  headerContentStyle = {},
  headerCellAccessibilityProps = {},
  dayHeaderStyle = {},
  dayHeaderHighlightColor = '',
  weekDayHeaderHighlightColor = '',
  bodyContainerStyle = {},
  swipeEnabled = true,
  weekStartsOn = 0,
  onChangeDate,
  onLongPressCell,
  onPressCell,
  resetPageOnPressCell = false,
  onPressDateHeader,
  onPressEvent,
  renderEvent,
  renderHeader: HeaderComponent = CalendarHeader,
  renderHeaderForMonthView: HeaderComponentForMonthView = CalendarHeaderForMonthView,
  weekEndsOn = 6,
  maxVisibleEventCount = 3,
  eventMinHeightForMonthView = 22,
  activeDate,
  headerComponent = null,
  headerComponentStyle = {},
  hourStyle = {},
  showAllDayEventCell = true,
  moreLabel = '{moreCount} More',
  showAdjacentMonths = true,
  sortedMonthView = true,
  hideHours = false,
  minHour = 0,
  maxHour = 23,
  isEventOrderingEnabled,
  showWeekNumber = false,
  showSixWeeks = false,
  weekNumberPrefix = '',
  onPressMoreLabel,
  renderCustomDateForMonth,
  disableMonthEventCellPress = false,
  showVerticalScrollIndicator = false,
  verticalScrollEnabled = true,
  itemSeparatorComponent = null,
  enrichedEventsByDate,
  enableEnrichedEvents = false,
  eventsAreSorted = false,
  onSwipeEnd,
  timeslots = 0,
  hourComponent,
  scheduleMonthSeparatorStyle = {},
  refreshControl,
  imperativeRef,
  onQuickAction,
  onEventDrop,
  refreshing,
  onRefresh,
}: CalendarContainerProps<T>) {
  // To ensure we have proper effect callback, use string to date comparision.
  const dateString = date?.toString()

  const calendarRef = useRef<InfinitePagerImperativeApi>(null)
  const isInternalReset = useRef(false)
  const currentPage = useRef(0)

  const [targetDate, setTargetDate] = React.useState(() => dayjs(date))

  // Expose imperative navigation API
  useImperativeHandle(imperativeRef, () => ({
    goNext: () => {
      calendarRef.current?.setPage(currentPage.current + 1, { animated: true })
    },
    goPrev: () => {
      calendarRef.current?.setPage(currentPage.current - 1, { animated: true })
    },
    goToDate: (newDate: Date) => {
      // For arbitrary date jumps, we need to update targetDate and reset page
      setTargetDate(dayjs(newDate))
      // Explicitly notify parent to synchronize other components (like DateRuler)
      onSwipeEnd?.(newDate)
    }
  }), [onSwipeEnd, mode, targetDate])

  const getCurrentDate = React.useCallback(
    (page: number) => {
      return targetDate.add(modeToNum(mode, targetDate, page), 'day')
    },
    [mode, targetDate],
  )

  const getDateRange = React.useCallback(
    (date: string | dayjs.Dayjs) => {
      switch (mode) {
        case 'month':
          return getDatesInMonth(date, locale)
        case 'week':
          return getDatesInWeek(date, weekStartsOn, locale)
        case '3days':
          return getDatesInNextThreeDays(date, locale)
        case 'day':
          return getDatesInNextOneDay(date, locale)
        case 'custom':
          return getDatesInNextCustomDays(date, weekStartsOn, weekEndsOn, locale)
        case 'schedule': // TODO: this will update
          return getDatesInMonth(date, locale)
        default:
          throw new Error(
            `[react-native-big-calendar] The mode which you specified "${mode}" is not supported.`,
          )
      }
    },
    [mode, locale, weekEndsOn, weekStartsOn],
  )

  const allDayEvents = React.useMemo(
    () => events.filter((event) => isAllDayEvent(event.start, event.end, event.allDay)),
    [events],
  )

  React.useEffect(() => {
    if (dateString) {
      const newDate = dayjs(dateString)
      // Check if the current page already shows this date
      if (newDate.isSame(getCurrentDate(currentPage.current), 'day')) {
        return
      }

      setTargetDate(newDate)
    }
  }, [dateString, getCurrentDate]) // if setting `[date]`, it will triggered twice

  // Use useLayoutEffect to reset page synchronously before paint when mode changes
  // This ensures InfinitePager doesn't render with the wrong page index
  // The issue: InfinitePager maintains its page index across mode changes, but page indices
  // mean different things in different modes (e.g., page 5 in day mode = 5 days, but in
  // month mode = ~5 months). Resetting to page 0 on mode change prevents showing wrong dates.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mode is a prop and we need to reset when it changes
  useLayoutEffect(() => {
    if (calendarRef.current) {
      calendarRef.current.setPage(0, { animated: false })
    }
  }, [mode]) // Reset to page 0 immediately when mode changes

  // biome-ignore lint/correctness/useExhaustiveDependencies: targetDate changes should reset the page
  useLayoutEffect(() => {
    isInternalReset.current = true
    currentPage.current = 0
    calendarRef.current?.setPage(0, { animated: false })
    // We don't reset isInternalReset here because setPage is async-ish or might trigger immediately.
    // We'll reset it in the next frame or after the effect.
    setTimeout(() => { isInternalReset.current = false }, 50)
  }, [targetDate])

  const daytimeEvents = React.useMemo(
    () => events.filter((event) => !isAllDayEvent(event.start, event.end, event.allDay)),
    [events],
  )

  const allEvents = React.useMemo(
    () => [...daytimeEvents, ...allDayEvents],
    [daytimeEvents, allDayEvents],
  )

  if (minHour < 0) {
    throw new Error('minHour should be 0 or greater')
  }
  if (maxHour > 23) {
    throw new Error('maxHour should be less that 24')
  }
  if (minHour >= maxHour) {
    throw new Error('minHour should be less than maxHour')
  }

  const cellHeight = React.useMemo(
    () => hourRowHeight || Math.max(height - 30, MIN_HEIGHT) / 24,
    [height, hourRowHeight],
  )

  const theme = useTheme()

  const onSwipeHorizontal = React.useCallback(
    (direction: HorizontalDirection) => {
      if (!swipeEnabled) {
        return
      }
      let nextTargetDate: dayjs.Dayjs
      if ((direction === 'LEFT' && !theme.isRTL) || (direction === 'RIGHT' && theme.isRTL)) {
        nextTargetDate = targetDate.add(modeToNum(mode, targetDate), 'day')
      } else {
        if (mode === 'month') {
          nextTargetDate = targetDate.add(targetDate.date() * -1, 'day')
        } else {
          nextTargetDate = targetDate.add(modeToNum(mode, targetDate) * -1, 'day')
        }
      }
      setTargetDate(nextTargetDate)
      onSwipeEnd?.(nextTargetDate.toDate())
    },
    [swipeEnabled, theme.isRTL, onSwipeEnd, targetDate, mode],
  )

  React.useEffect(() => {
    if (dateString && onChangeDate) {
      const timeoutId = setTimeout(() => {
        const dateRange = getDateRange(dateString)
        onChangeDate([dateRange[0].toDate(), dateRange[dateRange.length - 1].toDate()])
      }, 50) // Small delay to batch rapid changes
      return () => clearTimeout(timeoutId)
    }
    return undefined
  }, [dateString, onChangeDate, getDateRange])

  const handlePageChange = React.useCallback(
    (page: number) => {
      currentPage.current = page
      if (isInternalReset.current) return
      onSwipeEnd?.(getCurrentDate(page).toDate())
    },
    [onSwipeEnd, getCurrentDate],
  )

  const handlePressCell = React.useCallback(
    (date: Date) => {
      onPressCell?.(date)
      if (resetPageOnPressCell) calendarRef.current?.setPage(0, { animated: true })
    },
    [onPressCell, resetPageOnPressCell],
  )

  const commonProps = {
    cellHeight,
    dateRange: getDateRange(targetDate),
    mode,
    onPressEvent,
    hideHours,
    showWeekNumber,
  }

  if (mode === 'month') {
    const headerProps = {
      style: headerContainerStyle,
      headerContainerAccessibilityProps: headerContainerAccessibilityProps,
      locale: locale,
      weekStartsOn: weekStartsOn,
      headerContentStyle: headerContentStyle,
      headerCellAccessibilityProps: headerCellAccessibilityProps,
      dayHeaderStyle: dayHeaderStyle,
      dayHeaderHighlightColor: dayHeaderHighlightColor,
      weekDayHeaderHighlightColor: weekDayHeaderHighlightColor,
      showAllDayEventCell: showAllDayEventCell,
      showWeekNumber: showWeekNumber,
      weekNumberPrefix: weekNumberPrefix,
    }
    return (
      <InfinitePager
        ref={calendarRef}
        style={{ flex: 1 }}
        pageWrapperStyle={{ flex: 1 }}
        renderPage={({ index }) => (
          <React.Fragment>
            <HeaderComponentForMonthView
              {...headerProps}
              dateRange={getDateRange(getCurrentDate(index))}
            />
            <CalendarBodyForMonthView<T>
              {...commonProps}
              style={bodyContainerStyle}
              containerHeight={height}
              events={allEvents}
              eventCellStyle={eventCellStyle}
              eventCellAccessibilityProps={eventCellAccessibilityProps}
              calendarCellStyle={calendarCellStyle}
              calendarCellAccessibilityProps={calendarCellAccessibilityProps}
              calendarCellAccessibilityPropsForMonthView={
                calendarCellAccessibilityPropsForMonthView
              }
              calendarCellTextStyle={calendarCellTextStyle}
              weekStartsOn={weekStartsOn}
              hideNowIndicator={hideNowIndicator}
              showAdjacentMonths={showAdjacentMonths}
              onLongPressCell={onLongPressCell}
              onPressCell={handlePressCell}
              onPressDateHeader={onPressDateHeader}
              onPressEvent={onPressEvent}
              renderEvent={renderEvent}
              targetDate={getCurrentDate(index)}
              maxVisibleEventCount={maxVisibleEventCount}
              eventMinHeightForMonthView={eventMinHeightForMonthView}
              sortedMonthView={sortedMonthView}
              moreLabel={moreLabel}
              onPressMoreLabel={onPressMoreLabel}
              renderCustomDateForMonth={renderCustomDateForMonth}
              disableMonthEventCellPress={disableMonthEventCellPress}
              showSixWeeks={showSixWeeks}
            />
          </React.Fragment>
        )}
        onPageChange={handlePageChange}
        pageBuffer={2}
      />
    )
  }

  const headerProps = {
    ...commonProps,
    style: headerContainerStyle,
    headerContainerAccessibilityProps: headerContainerAccessibilityProps,
    locale,
    allDayEventCellStyle,
    allDayEventCellTextColor,
    allDayEvents: allDayEvents,
    allDayEventCellAccessibilityProps: allDayEventCellAccessibilityProps,
    onPressDateHeader: onPressDateHeader,
    activeDate,
    headerContentStyle: headerContentStyle,
    headerCellAccessibilityProps: headerCellAccessibilityProps,
    dayHeaderStyle: dayHeaderStyle,
    dayHeaderHighlightColor: dayHeaderHighlightColor,
    weekDayHeaderHighlightColor: weekDayHeaderHighlightColor,
    showAllDayEventCell: showAllDayEventCell,
    weekNumberPrefix: weekNumberPrefix,
  }

  if (mode === 'schedule') {
    return (
      <Schedule
        events={[...daytimeEvents, ...allDayEvents]}
        {...headerProps}
        style={bodyContainerStyle}
        containerHeight={height}
        eventCellStyle={eventCellStyle}
        calendarCellStyle={calendarCellStyle}
        calendarCellAccessibilityProps={calendarCellAccessibilityProps}
        hideNowIndicator={hideNowIndicator}
        overlapOffset={overlapOffset}
        scrollOffsetMinutes={scrollOffsetMinutes}
        ampm={ampm}
        showTime={showTime}
        onLongPressCell={onLongPressCell}
        onPressCell={onPressCell}
        onPressEvent={onPressEvent}
        onSwipeHorizontal={onSwipeHorizontal}
        renderEvent={renderEvent}
        headerComponent={headerComponent}
        headerComponentStyle={headerComponentStyle}
        hourStyle={hourStyle}
        isEventOrderingEnabled={isEventOrderingEnabled}
        showVerticalScrollIndicator={showVerticalScrollIndicator}
        itemSeparatorComponent={itemSeparatorComponent}
        scheduleMonthSeparatorStyle={scheduleMonthSeparatorStyle}
        onQuickAction={onQuickAction}
      />
    )
  }

  const renderPage = React.useCallback(
    ({ index }: { index: number }) => (
      <React.Fragment>
        <HeaderComponent {...headerProps} dateRange={getDateRange(getCurrentDate(index))} />
        <CalendarBody
          {...commonProps}
          dateRange={getDateRange(getCurrentDate(index))}
          style={bodyContainerStyle}
          containerHeight={height}
          events={daytimeEvents}
          eventCellStyle={eventCellStyle}
          eventCellAccessibilityProps={eventCellAccessibilityProps}
          eventCellTextColor={eventCellTextColor}
          calendarCellStyle={calendarCellStyle}
          calendarCellAccessibilityProps={calendarCellAccessibilityProps}
          hideNowIndicator={hideNowIndicator}
          overlapOffset={overlapOffset}
          scrollOffsetMinutes={scrollOffsetMinutes}
          ampm={ampm}
          minHour={minHour}
          maxHour={maxHour}
          showTime={showTime}
          onLongPressCell={onLongPressCell}
          onPressCell={(date) => {
            onPressCell?.(date)
            if (mode !== 'day' && resetPageOnPressCell) {
              calendarRef.current?.setPage(0, { animated: true })
            }
          }}
          onPressEvent={onPressEvent}
          renderEvent={renderEvent}
          headerComponent={headerComponent}
          headerComponentStyle={headerComponentStyle}
          hourStyle={hourStyle}
          isEventOrderingEnabled={isEventOrderingEnabled}
          showVerticalScrollIndicator={showVerticalScrollIndicator}
          scrollEnabled={verticalScrollEnabled}
          enrichedEventsByDate={enrichedEventsByDate}
          enableEnrichedEvents={enableEnrichedEvents}
          eventsAreSorted={eventsAreSorted}
          timeslots={timeslots}
          hourComponent={hourComponent}
          refreshControl={refreshControl}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onQuickAction={onQuickAction}
          onEventDrop={onEventDrop}
        />
      </React.Fragment>
    ),
    [
      commonProps,
      headerProps,
      getDateRange,
      getCurrentDate,
      bodyContainerStyle,
      height,
      daytimeEvents,
      eventCellStyle,
      eventCellAccessibilityProps,
      eventCellTextColor,
      calendarCellStyle,
      calendarCellAccessibilityProps,
      hideNowIndicator,
      overlapOffset,
      scrollOffsetMinutes,
      ampm,
      minHour,
      maxHour,
      showTime,
      onLongPressCell,
      onPressCell,
      mode,
      resetPageOnPressCell,
      onPressEvent,
      renderEvent,
      headerComponent,
      headerComponentStyle,
      hourStyle,
      isEventOrderingEnabled,
      showVerticalScrollIndicator,
      verticalScrollEnabled,
      enrichedEventsByDate,
      enableEnrichedEvents,
      eventsAreSorted,
      timeslots,
      hourComponent,
      refreshControl,
      refreshing,
      onRefresh,
      onQuickAction,
      onEventDrop,
    ],
  )

  return (
    <InfinitePager
      ref={calendarRef}
      renderPage={renderPage}
      onPageChange={handlePageChange}
      pageBuffer={2}
    />
  )
}

export const CalendarContainer = typedMemo(_CalendarContainer)
