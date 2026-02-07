import * as Calendar from 'expo-calendar';
console.log('Calendar keys:', Object.keys(Calendar));
console.log('Frequency:', Calendar.Frequency);
if (Calendar.Frequency) {
  console.log('Frequency.DAILY:', Calendar.Frequency.DAILY);
}
