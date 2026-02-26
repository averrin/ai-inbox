import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, firebaseDb } from './firebase';
import { useWeatherStore } from '../store/weatherStore';

export interface HourlyWeatherData {
    time: string; // ISO string
    temp: number;
    weatherCode: number;
    icon: string;
    label: string;
}

export interface WeatherData {
    date: string; // YYYY-MM-DD
    minTemp: number;
    maxTemp: number;
    weatherCode: number;
    icon: string; // Ionicons name
    label: string;
    hourly: HourlyWeatherData[];
}

// WMO Weather interpretation codes (WW)
// https://open-meteo.com/en/docs
export const getWeatherDetails = (code: number): { icon: string; label: string } => {
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

let weatherUnsubscribe: (() => void) | null = null;

function subscribeToWeather(uid: string) {
    unsubscribeFromWeather();

    const docRef = doc(firebaseDb, `users/${uid}/weather/forecast`);
    weatherUnsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            const raw = snapshot.data();
            const data = raw?.data as Record<string, WeatherData> | undefined;
            if (data) {
                // Normalize data to ensure valid icons/labels
                const normalizedData: Record<string, WeatherData> = {};
                Object.entries(data).forEach(([date, dayData]) => {
                    const details = getWeatherDetails(dayData.weatherCode);
                    normalizedData[date] = {
                        ...dayData,
                        icon: details.icon,
                        label: details.label,
                        hourly: (dayData.hourly || []).map(h => {
                            const hDetails = getWeatherDetails(h.weatherCode);
                            return {
                                ...h,
                                icon: hDetails.icon,
                                label: hDetails.label
                            };
                        })
                    };
                });
                useWeatherStore.getState().setWeatherData(normalizedData);
                console.log('[WeatherService] Weather data updated and normalized from Firestore');
            }
        }
    }, (error) => {
        console.warn('[WeatherService] Firestore listen error:', error);
    });
}

function unsubscribeFromWeather() {
    if (weatherUnsubscribe) {
        weatherUnsubscribe();
        weatherUnsubscribe = null;
    }
}

// Auto-manage subscription based on auth state
onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
        console.log('[WeatherService] User authenticated, subscribing to weather...');
        subscribeToWeather(user.uid);
    } else {
        console.log('[WeatherService] User logged out, unsubscribing from weather.');
        unsubscribeFromWeather();
        useWeatherStore.getState().setWeatherData({});
    }
});
