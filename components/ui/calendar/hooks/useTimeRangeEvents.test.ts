// @ts-ignore
import { renderHook } from '@testing-library/react-hooks'
import dayjs from 'dayjs'
import { useTimeRangeEvents } from './useTimeRangeEvents'
import { useEventTypesStore } from '../../../../store/eventTypes'

// Mock the store
jest.mock('../../../../store/eventTypes')

describe('useTimeRangeEvents', () => {
    const mockDateRange = [
        dayjs('2024-01-01'), // Monday
        dayjs('2024-01-02'), // Tuesday
        dayjs('2024-01-03'), // Wednesday
    ]

    beforeEach(() => {
        // Reset mock
        (useEventTypesStore as unknown as jest.Mock).mockReturnValue({
            ranges: []
        })
    })

    it('should return empty array when no ranges are defined', () => {
        const { result } = renderHook(() => useTimeRangeEvents(mockDateRange))
        expect(result.current).toEqual([])
    })

    it('should generate events for active days', () => {
        (useEventTypesStore as unknown as jest.Mock).mockReturnValue({
            ranges: [
                {
                    id: '1',
                    title: 'Gym',
                    start: { hour: 7, minute: 0 },
                    end: { hour: 8, minute: 0 },
                    days: [1, 3], // Monday and Wednesday
                    color: 'blue',
                    isEnabled: true,
                }
            ]
        })

        const { result } = renderHook(() => useTimeRangeEvents(mockDateRange))

        // Should match Mon and Wed
        expect(result.current).toHaveLength(2)

        // Check Monday event
        const monEvent = result.current.find((e: any) => dayjs(e.start).date() === 1)
        expect(monEvent).toBeDefined()
        expect(dayjs(monEvent!.start).hour()).toBe(7)
        expect(dayjs(monEvent!.end).hour()).toBe(8)
        expect(monEvent!.title).toBe('Gym')

        // Check Wednesday event
        const wedEvent = result.current.find((e: any) => dayjs(e.start).date() === 3)
        expect(wedEvent).toBeDefined()

        // No Tuesday event
        const tueEvent = result.current.find((e: any) => dayjs(e.start).date() === 2)
        expect(tueEvent).toBeUndefined()
    })

    it('should ignore disabled ranges', () => {
        (useEventTypesStore as unknown as jest.Mock).mockReturnValue({
            ranges: [
                {
                    id: '1',
                    title: 'Gym',
                    start: { hour: 7, minute: 0 },
                    end: { hour: 8, minute: 0 },
                    days: [1], // Monday
                    color: 'blue',
                    isEnabled: false,
                }
            ]
        })

        const { result } = renderHook(() => useTimeRangeEvents(mockDateRange))
        expect(result.current).toHaveLength(0)
    })
})
