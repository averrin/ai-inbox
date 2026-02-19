import { create } from 'zustand';
import { WeatherData } from '../services/weatherService';

interface WeatherState {
    weatherData: Record<string, WeatherData>;
    setWeatherData: (data: Record<string, WeatherData>) => void;
    updateWeatherData: (data: Record<string, WeatherData>) => void;
}

export const useWeatherStore = create<WeatherState>((set) => ({
    weatherData: {},
    setWeatherData: (data) => set({ weatherData: data }),
    updateWeatherData: (data) => set((state) => ({
        weatherData: { ...state.weatherData, ...data }
    })),
}));
