import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useForecastStore } from '../store/forecastStore';
import { generateDayForecast, buildDayForecastPrompt } from '../services/forecastService';
import { MarkdownView } from './ui/MarkdownView';
import { JulesLoader } from './ui/JulesLoader';
import { Colors } from './ui/design-tokens';

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
            const forecast = await generateDayForecast(date);
            setForecast(dateStr, forecast);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        try {
            const prompt = await buildDayForecastPrompt(date);
            await Clipboard.setStringAsync(prompt);
            Toast.show({
                type: 'success',
                text1: 'Prompt context built and copied',
                visibilityTime: 2000,
            });
        } catch (e) {
            console.error('[ForecastSection] Failed to build prompt:', e);
            Toast.show({
                type: 'error',
                text1: 'Failed to build prompt context',
            });
        }
    };

    useEffect(() => {
        if (!forecastData && !loading && !error) {
            handleGenerate();
        }
    }, [dateStr]);

    if (loading) {
        return (
            <View className="bg-surface/50 p-4 rounded-2xl border border-border/50 mb-6 items-center justify-center py-8">
                <JulesLoader size="medium" message="Generating AI Forecast..." />
            </View>
        );
    }

    if (error) {
        return (
            <View className="bg-surface-highlight p-4 rounded-2xl border border-border mb-6">
                <View className="flex-row items-center mb-1">
                    <Ionicons name="warning-outline" size={16} color={Colors.error} />
                    <Text className="text-error ml-2 font-bold text-xs uppercase tracking-wider">Forecast Error</Text>
                </View>
                <Text className="text-error text-sm mb-2">{error}</Text>
                <TouchableOpacity onPress={() => handleGenerate(true)} className="bg-surface-highlight self-start px-3 py-1.5 rounded-lg border border-border">
                    <Text className="text-error font-bold text-xs">Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!forecastData) return null;

    return (
        <View className="bg-surface-highlight p-4 rounded-2xl border border-primary mb-6">
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-row items-center">
                    <View className="bg-primary p-1 rounded-md mr-2">
                        <Ionicons name="sparkles" size={12} color="white" />
                    </View>
                    <Text className="text-text-secondary font-bold text-xs uppercase tracking-wider">Day Forecast</Text>
                </View>
                <View className="flex-row items-center gap-1">
                    <TouchableOpacity
                        onPress={handleCopy}
                        className="p-1"
                    >
                        <Ionicons name="copy-outline" size={16} color="#818cf8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleGenerate(true)}
                        className="p-1"
                    >
                        <Ionicons name="refresh" size={16} color="#818cf8" />
                    </TouchableOpacity>
                </View>
            </View>
            <MarkdownView
                text={forecastData.forecast}
                baseFontSize={16}
                baseColor="white"
                style={{ marginTop: 4, fontStyle: 'italic' }}
            />
        </View>
    );
}
