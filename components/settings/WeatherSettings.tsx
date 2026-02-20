import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, Switch } from 'react-native';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { useSettingsStore } from '../../store/settings';
import { Ionicons } from '@expo/vector-icons';
import { updateUserLocation } from '../../utils/locationUtils';
import { Colors } from '../ui/design-tokens';

interface SearchResult {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string; // State/Region
}

export function WeatherSettings() {
    const { weatherLocation, setWeatherLocation, useCurrentLocation, setUseCurrentLocation } = useSettingsStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Simple debounce implementation
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 3) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=5&language=en&format=json`
                );
                const data = await response.json();
                if (data.results) {
                    setResults(data.results);
                } else {
                    setResults([]);
                }
            } catch (err) {
                console.error("Geocoding error:", err);
                setError("Failed to search location.");
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelect = (location: SearchResult) => {
        setWeatherLocation({
            lat: location.latitude,
            lon: location.longitude,
            city: location.name
        });
        setSearchQuery(''); // Clear search on select
        setResults([]);
    };

    const toggleCurrentLocation = async (value: boolean) => {
        setUseCurrentLocation(value);
        if (value) {
            setLoading(true);
            try {
                await updateUserLocation();
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <Card>
            <View className="mb-6">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-indigo-200 font-semibold">Location Source</Text>
                    <View className="flex-row items-center gap-2">
                        <Text className="text-slate-400 text-xs">
                            {useCurrentLocation ? 'Using GPS' : 'Manual Selection'}
                        </Text>
                        <Switch
                            value={useCurrentLocation}
                            onValueChange={toggleCurrentLocation}
                            trackColor={{ false: Colors.surfaceHighlight, true: '#818cf8' }}
                            thumbColor={Colors.text.primary}
                        />
                    </View>
                </View>

                <Text className="text-indigo-200 mb-2 font-semibold">Current Selection</Text>
                <View className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex-row items-center gap-3">
                    <View className="bg-indigo-500/20 p-2 rounded-full">
                        <Ionicons name="location" size={20} color="#818cf8" />
                    </View>
                    <View>
                        <Text className="text-white font-medium">
                            {weatherLocation.city || 'Unknown Location'}
                        </Text>
                        <Text className="text-slate-400 text-xs">
                            {weatherLocation.lat.toFixed(4)}, {weatherLocation.lon.toFixed(4)}
                        </Text>
                    </View>
                </View>
            </View>

            {!useCurrentLocation && (
                <View className="mb-4">
                    <Text className="text-indigo-200 mb-2 font-semibold">Search City</Text>
                    <Input
                        label=""
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="e.g. San Francisco, London..."
                    />
                </View>
            )}

            {loading && (
                <View className="py-4">
                    <ActivityIndicator color="#818cf8" />
                </View>
            )}

            {error && (
                <Text className="text-red-400 text-sm mb-4">{error}</Text>
            )}

            {!useCurrentLocation && results.length > 0 && (
                <View className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                    {results.map((item, index) => (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => handleSelect(item)}
                            className={`p-3 flex-row items-center justify-between ${
                                index < results.length - 1 ? 'border-b border-slate-700' : ''
                            }`}
                        >
                            <View className="flex-1">
                                <Text className="text-white font-medium">{item.name}</Text>
                                <Text className="text-slate-400 text-xs">
                                    {[item.admin1, item.country].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                            <Ionicons name="add-circle-outline" size={20} color="#818cf8" />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </Card>
    );
}
