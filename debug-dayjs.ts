import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import isBetween from 'dayjs/plugin/isBetween'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(duration)
dayjs.extend(isBetween)
dayjs.extend(isoWeek)

const date = dayjs('2026-02-20') // Friday
console.log('Date:', date.format('YYYY-MM-DD (dddd)'))
console.log('date.day():', date.day())
console.log('date.isoWeekday():', date.isoWeekday())

const sun = dayjs('2026-02-22') // Sunday
console.log('Sun.day():', sun.day())
console.log('Sun.isoWeekday():', sun.isoWeekday())

const sat = dayjs('2026-02-21') // Saturday
console.log('Sat.day():', sat.day())
console.log('Sat.isoWeekday():', sat.isoWeekday())
