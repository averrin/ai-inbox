import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useForecastStore } from '../store/forecastStore';
import { generateDayForecast } from '../services/forecastService';

interface ForecastSectionProps {
    date: Date;
}

export function ForecastSection({ date }: ForecastSectionProps) {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const { getForecast, setForecast } = useForecastStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const forecastData = getForecast(dateStr);

    const handleGenerate = async (force: boolean = false) => {
        if (!force && forecastData) return;

        setLoading(true);
        setError(null);
        try {
            const text = await generateDayForecast(date);
            setForecast(dateStr, text);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!forecastData && !loading && !error) {
            handleGenerate();
        }
    }, [dateStr]);

    if (loading) {
        return (
            <View className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 mb-6 items-center justify-center py-8">
                <ActivityIndicator color="#6366f1" />
                <Text className="text-slate-400 mt-2 text-sm">Generating AI Forecast...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View className="bg-red-900/10 p-4 rounded-2xl border border-red-900/20 mb-6">
                <View className="flex-row items-center mb-1">
                    <Ionicons name="warning-outline" size={16} color="#ef4444" />
                    <Text className="text-red-400 ml-2 font-bold text-xs uppercase tracking-wider">Forecast Error</Text>
                </View>
                <Text className="text-red-200/80 text-sm mb-2">{error}</Text>
                <TouchableOpacity onPress={() => handleGenerate(true)} className="bg-red-900/30 self-start px-3 py-1.5 rounded-lg border border-red-900/40">
                    <Text className="text-red-200 font-bold text-xs">Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!forecastData) return null;

    return (
        <View className="bg-indigo-900/20 p-4 rounded-2xl border border-indigo-500/20 mb-6">
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-row items-center">
                    <View className="bg-indigo-500 p-1 rounded-md mr-2">
                        <Ionicons name="sparkles" size={12} color="white" />
                    </View>
                    <Text className="text-indigo-300 font-bold text-xs uppercase tracking-wider">Day Forecast</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => handleGenerate(true)}
                    className="p-1"
                >
                    <Ionicons name="refresh" size={16} color="#818cf8" />
                </TouchableOpacity>
            </View>
            <Text className="text-white italic text-base leading-snug">
                "{forecastData.forecast}"
            </Text>
        </View>
    );
}
