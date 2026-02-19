import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useWeatherStore } from '../store/weatherStore';
import { formatHour } from './ui/calendar/utils/datetime';

interface Props {
    hour: number;
    ampm: boolean;
    date: Date;
}

export function WeatherHourGuide({ hour, ampm, date }: Props) {
    const weatherData = useWeatherStore((s) => s.weatherData);
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const dayWeather = weatherData[dateStr];

    // Find the hourly data for this hour
    const hourlyWeather = dayWeather?.hourly?.find(h => {
        const hTime = dayjs(h.time);
        return hTime.hour() === hour;
    });

    return (
        <View className="flex-1 items-center justify-center py-1">
            <Text className="text-slate-500 text-[10px] font-bold">
                {formatHour(hour, ampm)}
            </Text>
            {hourlyWeather && (
                <View className="mt-1 items-center">
                    <Ionicons name={hourlyWeather.icon as any} size={14} color="#94a3b8" />
                    <Text className="text-slate-600 text-[8px]">
                        {Math.round(hourlyWeather.temp)}°
                    </Text>
                </View>
            )}
        </View>
    );
}
