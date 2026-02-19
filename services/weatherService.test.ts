import { getWeatherForecast } from './weatherService';
import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test';

// Mock fetch
const originalFetch = global.fetch;

describe('getWeatherForecast', () => {
    beforeAll(() => {
        global.fetch = mock((url) => {
             return Promise.resolve({
                 ok: true,
                 json: () => Promise.resolve({
                     daily: {
                         time: ["2024-01-01"],
                         temperature_2m_max: [20],
                         temperature_2m_min: [10],
                         weather_code: [1]
                     },
                     hourly: {
                         time: [
                             "2024-01-01T00:00",
                             "2024-01-01T01:00",
                             "2024-01-01T02:00"
                         ],
                         temperature_2m: [15.5, 14.2, 13.0],
                         weather_code: [1, 2, 3]
                     }
                 })
             });
        }) as any;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it('should parse hourly weather data', async () => {
        const result = await getWeatherForecast(0, 0, new Date('2024-01-01'), new Date('2024-01-01'));

        expect(result['2024-01-01']).toBeDefined();
        const dayData = result['2024-01-01'];
        expect(dayData.maxTemp).toBe(20);

        // Verify hourly data structure
        // Note: The interface update is not yet applied, so TS might complain if I were compiling,
        // but bun run handles JS loose typing.
        // However, I expect this to fail or be undefined until implemented.
        expect(dayData.hourly).toBeDefined();
        expect(Object.keys(dayData.hourly!).length).toBeGreaterThan(0);

        expect(dayData.hourly![0]).toEqual({
            temp: 15.5,
            weatherCode: 1,
            icon: 'partly-sunny-outline', // check mapping
            label: 'Mainly Clear'
        });

        expect(dayData.hourly![1]).toEqual({
            temp: 14.2,
            weatherCode: 2,
            icon: 'partly-sunny-outline',
            label: 'Partly Cloudy'
        });
    });
});
