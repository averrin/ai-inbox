import dayjs from 'dayjs';

export interface WeatherData {
    date: string; // YYYY-MM-DD
    minTemp: number;
    maxTemp: number;
    weatherCode: number;
    icon: string; // Ionicons name
    label: string;
}

// WMO Weather interpretation codes (WW)
// https://open-meteo.com/en/docs
const getWeatherDetails = (code: number): { icon: string; label: string } => {
    switch (code) {
        case 0: return { icon: 'sunny-outline', label: 'Clear' };
        case 1: return { icon: 'partly-sunny-outline', label: 'Mainly Clear' };
        case 2: return { icon: 'partly-sunny-outline', label: 'Partly Cloudy' };
        case 3: return { icon: 'cloudy-outline', label: 'Overcast' };
        case 45: return { icon: 'cloud-outline', label: 'Fog' };
        case 48: return { icon: 'cloud-outline', label: 'Depositing Rime Fog' };
        case 51: return { icon: 'water-outline', label: 'Light Drizzle' };
        case 53: return { icon: 'water-outline', label: 'Drizzle' };
        case 55: return { icon: 'water-outline', label: 'Heavy Drizzle' };
        case 61: return { icon: 'rainy-outline', label: 'Light Rain' };
        case 63: return { icon: 'rainy-outline', label: 'Rain' };
        case 65: return { icon: 'rainy-outline', label: 'Heavy Rain' };
        case 66: return { icon: 'snow-outline', label: 'Freezing Rain' };
        case 67: return { icon: 'snow-outline', label: 'Heavy Freezing Rain' };
        case 71: return { icon: 'snow-outline', label: 'Light Snow' };
        case 73: return { icon: 'snow-outline', label: 'Snow' };
        case 75: return { icon: 'snow-outline', label: 'Heavy Snow' };
        case 77: return { icon: 'snow-outline', label: 'Snow Grains' };
        case 80: return { icon: 'rainy-outline', label: 'Light Showers' };
        case 81: return { icon: 'rainy-outline', label: 'Showers' };
        case 82: return { icon: 'rainy-outline', label: 'Heavy Showers' };
        case 85: return { icon: 'snow-outline', label: 'Snow Showers' };
        case 86: return { icon: 'snow-outline', label: 'Heavy Snow Showers' };
        case 95: return { icon: 'thunderstorm-outline', label: 'Thunderstorm' };
        case 96: return { icon: 'thunderstorm-outline', label: 'Thunderstorm' };
        case 99: return { icon: 'thunderstorm-outline', label: 'Thunderstorm' };
        default: return { icon: 'help-circle-outline', label: 'Unknown' };
    }
}

export const getWeatherIcon = (code: number) => getWeatherDetails(code).icon;

export async function getWeatherForecast(
    lat: number,
    lon: number,
    startDate: string | Date,
    endDate: string | Date
): Promise<Record<string, WeatherData>> {
    const startStr = dayjs(startDate).format('YYYY-MM-DD');
    const endStr = dayjs(endDate).format('YYYY-MM-DD');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${startStr}&end_date=${endStr}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Weather API Error: ${response.statusText}`);
        }
        const data = await response.json();

        // OpenMeteo returns column-oriented data
        const result: Record<string, WeatherData> = {};

        if (!data.daily || !data.daily.time) {
            return result;
        }

        data.daily.time.forEach((time: string, index: number) => {
            const code = data.daily.weather_code[index];
            const { icon, label } = getWeatherDetails(code);

            result[time] = {
                date: time,
                minTemp: data.daily.temperature_2m_min[index],
                maxTemp: data.daily.temperature_2m_max[index],
                weatherCode: code,
                icon,
                label
            };
        });

        return result;

    } catch (error) {
        console.error('Failed to fetch weather:', error);
        return {};
    }
}
