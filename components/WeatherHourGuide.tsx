import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useWeatherStore } from '../store/weatherStore';
import { formatHour } from './ui/calendar/utils/datetime';
import { Colors, Typography } from './ui/design-tokens';

interface Props {
    hour: number;
    ampm: boolean;
    date: Date;
}

const PRECIPITATION_ICONS = new Set([
    'water-outline',
    'rainy-outline',
    'snow-outline',
    'thunderstorm-outline'
]);

export function WeatherHourGuide({ hour, ampm, date }: Props) {
    const weatherData = useWeatherStore((s) => s.weatherData);
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const dayWeather = weatherData[dateStr];

    // Find the hourly data for this hour
    const hourlyWeather = dayWeather?.hourly?.find(h => {
        const hTime = dayjs(h.time);
        return hTime.hour() === hour;
    });

    const isPrecipitation = hourlyWeather && PRECIPITATION_ICONS.has(hourlyWeather.icon);
    const iconColor = isPrecipitation ? Colors.info : Colors.text.tertiary;

    return (
        <View className="flex-1 items-center justify-center py-1">
            <Text className="text-secondary font-bold" style={{ fontSize: Typography.sizes.xs }}>
                {formatHour(hour, ampm)}
            </Text>
            {hourlyWeather && (
                <View className="mt-1 items-center">
                    <Ionicons name={hourlyWeather.icon as any} size={14} color={iconColor} />
                    <Text className="text-text-tertiary" style={{ fontSize: Typography.sizes.xxs }}>
                        {Math.round(hourlyWeather.temp)}°
                    </Text>
                </View>
            )}
        </View>
    );
}
