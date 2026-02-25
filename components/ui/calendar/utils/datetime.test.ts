import { weekDaysCount } from './datetime'

describe('weekDaysCount', () => {
  it('should return 1 when start and end are the same day', () => {
    expect(weekDaysCount(0, 0)).toBe(1) // Sunday to Sunday
    expect(weekDaysCount(3, 3)).toBe(1) // Wednesday to Wednesday
    expect(weekDaysCount(6, 6)).toBe(1) // Saturday to Saturday
  })

  it('should return correct count for normal week (end > start)', () => {
    expect(weekDaysCount(1, 5)).toBe(5) // Mon to Fri: Mon, Tue, Wed, Thu, Fri
    expect(weekDaysCount(0, 6)).toBe(7) // Sun to Sat: Sun, Mon, Tue, Wed, Thu, Fri, Sat
    expect(weekDaysCount(2, 4)).toBe(3) // Tue to Thu: Tue, Wed, Thu
  })

  it('should return correct count for reverse week (end < start)', () => {
    expect(weekDaysCount(6, 1)).toBe(3) // Sat to Mon: Sat, Sun, Mon
    expect(weekDaysCount(5, 0)).toBe(3) // Fri to Sun: Fri, Sat, Sun
    expect(weekDaysCount(4, 2)).toBe(6) // Thu to Tue: Thu, Fri, Sat, Sun, Mon, Tue
  })

  it('should handle edge cases and full week range', () => {
    expect(weekDaysCount(0, 6)).toBe(7) // Full week starting Sun
    expect(weekDaysCount(1, 0)).toBe(7) // Full week starting Mon
    expect(weekDaysCount(6, 5)).toBe(7) // Full week starting Sat
  })
})
