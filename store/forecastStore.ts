import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DayForecast {
    forecast: string;
    timestamp: number;
}

interface ForecastState {
    forecasts: Record<string, DayForecast>;
    setForecast: (date: string, forecast: string) => void;
    getForecast: (date: string) => DayForecast | undefined;
}

export const useForecastStore = create<ForecastState>()(
    persist(
        (set, get) => ({
            forecasts: {},
            setForecast: (date, forecast) => set((state) => ({
                forecasts: {
                    ...state.forecasts,
                    [date]: {
                        forecast,
                        timestamp: Date.now()
                    }
                }
            })),
            getForecast: (date) => get().forecasts[date],
        }),
        {
            name: 'ai-inbox-forecasts',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
