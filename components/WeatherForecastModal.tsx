import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { WeatherData } from '../services/weatherService';

interface Props {
    visible: boolean;
    onClose: () => void;
    weatherData: Record<string, WeatherData>;
    currentDate: Date;
}

export function WeatherForecastModal({ visible, onClose, weatherData, currentDate }: Props) {
    // Calculate the range to display: Selected Day + 6 days
    const startDate = dayjs(currentDate);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = startDate.add(i, 'day');
        const dateStr = d.format('YYYY-MM-DD');
        return {
            date: d,
            dateStr,
            data: weatherData[dateStr]
        };
    });

    return (
        <Modal visible={visible} transparent animationType="fade">
            <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}
                activeOpacity={1}
                onPress={onClose}
            >
                <View
                    className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden max-h-[70%]"
                    onStartShouldSetResponder={() => true}
                >
                    <View className="p-4 border-b border-slate-800 flex-row items-center justify-between">
                        <View>
                            <Text className="text-white text-lg font-bold">Weather Forecast</Text>
                            <Text className="text-slate-400 text-xs">{startDate.format('MMM D')} - {startDate.add(6, 'day').format('MMM D, YYYY')}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-800 rounded-full">
                            <Ionicons name="close" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-4">
                        {weekDays.map((day, index) => {
                            const isToday = dayjs().isSame(day.date, 'day');
                            const isCurrentView = dayjs(currentDate).isSame(day.date, 'day');
                            const weather = day.data;

                            return (
                                <View
                                    key={day.dateStr}
                                    className={`flex-row items-center justify-between py-3 border-b border-slate-800/50 ${isToday ? 'bg-indigo-500/10 -mx-4 px-4' : ''}`}
                                >
                                    <View className="flex-row items-center gap-4 flex-1">
                                        <View className="w-12">
                                            <Text className={`text-sm font-bold ${isToday ? 'text-indigo-400' : 'text-slate-300'}`}>
                                                {day.date.format('ddd')}
                                            </Text>
                                            <Text className="text-xs text-slate-500">
                                                {day.date.format('MMM D')}
                                            </Text>
                                        </View>

                                        {weather ? (
                                            <View className="flex-row items-center gap-3">
                                                <Ionicons name={weather.icon as any} size={24} color={isToday ? '#818cf8' : '#94a3b8'} />
                                                <View>
                                                    <Text className="text-slate-200 text-sm font-medium">{weather.label}</Text>
                                                </View>
                                            </View>
                                        ) : (
                                            <Text className="text-slate-600 italic text-xs">No data</Text>
                                        )}
                                    </View>

                                    {weather && (
                                        <View className="flex-row items-center gap-3">
                                            <View className="items-end">
                                                <Text className="text-white font-bold text-sm">
                                                    {Math.round(weather.maxTemp)}°C
                                                </Text>
                                                <Text className="text-slate-500 text-xs">
                                                    High
                                                </Text>
                                            </View>
                                            <View className="w-[1px] h-6 bg-slate-800" />
                                            <View className="items-end">
                                                <Text className="text-slate-300 font-bold text-sm">
                                                    {Math.round(weather.minTemp)}°C
                                                </Text>
                                                <Text className="text-slate-500 text-xs">
                                                    Low
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}
