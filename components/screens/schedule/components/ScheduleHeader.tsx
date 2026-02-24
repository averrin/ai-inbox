import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Colors, Palette } from '../../../ui/design-tokens';
import { DayStatusMarker } from '../../../DayStatusMarker';
import { aggregateDayStats, calculateDayStatus } from '../../../../utils/difficultyUtils';

interface ScheduleHeaderProps {
    headerProps: any;
    events: any[];
    focusRanges: any[];
    lunchDifficulties: Record<string, number>;
    weatherData: Record<string, any>;
    moods: Record<string, any>;
    isAssistantLoading: boolean;
    showAdditionalCalendars: boolean;
    onMoodPress: (date: Date) => void;
    onWeatherPress: () => void;
    onGenerateSuggestions: () => void;
    onToggleAdditionalCalendars: () => void;
    onShowSummary: (data: { breakdown: any, status: any, date: Date }) => void;
}

export const ScheduleHeader = ({
    headerProps,
    events,
    focusRanges,
    lunchDifficulties,
    weatherData,
    moods,
    isAssistantLoading,
    showAdditionalCalendars,
    onMoodPress,
    onWeatherPress,
    onGenerateSuggestions,
    onToggleAdditionalCalendars,
    onShowSummary
}: ScheduleHeaderProps) => {
    // headerProps.dateRange is an array of dayjs objects for the current view (page)
    const pageDate = headerProps.dateRange[0];
    const pageDay = dayjs(pageDate);
    const dayStr = pageDay.format('YYYY-MM-DD');

    // Calculate score for this pageDate
    const dailyEvents = events.filter(e =>
        dayjs(e.start).isSame(pageDay, 'day') &&
        e.type !== 'marker'
    );

    // Calculate Day Stats using helper
    const dayStats = aggregateDayStats(dailyEvents);

    // Add Lunch Difficulty penalties
    const lunchPenalty = lunchDifficulties[dayStr] || 0;
    if (lunchPenalty > 0) {
        dayStats.totalScore += lunchPenalty;
        dayStats.penalties.push({ reason: 'Lunch Issues', points: lunchPenalty, count: 1 });
    }

    // Calculate Focus Range Bonus
    const dailyFocus = focusRanges.filter(f =>
        dayjs(f.start).isSame(pageDay, 'day')
    );
    if (dailyFocus.length > 0) {
        dayStats.totalScore += dailyFocus.length;
        dayStats.penalties.push({ reason: 'Focus Range Bonus', points: dailyFocus.length, count: dailyFocus.length });
    }

    const status = calculateDayStatus(dayStats.totalScore, dayStats.deepWorkMinutes / 60);

    const hours = Math.floor(dayStats.deepWorkMinutes / 60);
    const mins = dayStats.deepWorkMinutes % 60;
    const deepWorkStr = `${hours}h ${mins}m`;

    const weather = weatherData[dayStr];

    // Mood Logic
    const moodEntry = moods[dayStr];
    const moodColors = [Colors.error, Colors.busy, Colors.warning, Palette[7], Colors.success];
    const moodColor = moodEntry ? moodColors[moodEntry.mood - 1] : undefined;

    // All Day Events for this day
    const dailyAllDayEvents = (headerProps.allDayEvents || []).filter((e: any) =>
        e.type !== 'zone' && // Filter out the grid zone markers from header
        dayjs(pageDate).isBetween(dayjs(e.start), dayjs(e.end), 'day', '[]')
    );

    return (
        <View className="bg-background border-b border-border">
            <View className="px-4 py-2 flex-row justify-between items-center">
                {/* Left: Mood Tracker and Weather */}
                <View className="flex-row items-center gap-4">
                    <TouchableOpacity
                        onPress={() => onMoodPress(pageDate.toDate())}
                        className="flex-row items-center"
                    >
                        {moodEntry ? (
                            <View className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: moodColor }} />
                        ) : (
                            <Ionicons name="add-circle-outline" size={20} color="#475569" />
                        )}
                    </TouchableOpacity>

                    {weather && (
                        <TouchableOpacity
                            onPress={onWeatherPress}
                            className="flex-row items-center gap-1"
                        >
                            <Ionicons name={weather.icon as any} size={16} color={Colors.text.tertiary} />
                            <Text className="text-text-tertiary text-xs font-semibold">
                                {Math.round(weather.maxTemp)}°C
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Right: Stats (Clickable for details) */}
                <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                        onPress={onGenerateSuggestions}
                        className={`p-1.5 rounded-full ${isAssistantLoading ? 'bg-primary/20' : 'bg-transparent'}`}
                        disabled={isAssistantLoading}
                    >
                         {isAssistantLoading ? (
                             <ActivityIndicator size="small" color={Colors.primary} />
                         ) : (
                             <Ionicons name="sparkles" size={18} color={Colors.text.tertiary} />
                         )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onToggleAdditionalCalendars}
                        className={`p-1.5 rounded-full ${!showAdditionalCalendars ? 'opacity-50' : 'bg-primary/10'}`}
                    >
                         <Ionicons name={showAdditionalCalendars ? "layers" : "layers-outline"} size={18} color={showAdditionalCalendars ? Colors.primary : Colors.text.tertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => onShowSummary({ breakdown: dayStats, status, date: pageDate.toDate() })}
                        className="flex-row items-center gap-4"
                    >
                        <View className="flex-row items-center gap-2">
                            <DayStatusMarker status={status} />
                            {dayStats.deepWorkMinutes > 0 && (
                                <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-wider">
                                    Deep Work: <Text className="text-success text-sm">{deepWorkStr}</Text>
                                </Text>
                            )}
                        </View>

                        <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-wider">
                            Day Score: <Text className="text-primary text-sm">{Math.round(dayStats.totalScore)}</Text>
                        </Text>

                        <Ionicons name="information-circle-outline" size={16} color={Colors.secondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* All Day Events Row */}
            {dailyAllDayEvents.length > 0 && (
                <View className="px-4 pb-2 flex-row flex-wrap gap-1.5">
                    {dailyAllDayEvents.map((evt: any, idx: number) => (
                        <TouchableOpacity
                            key={`${idx}-${evt.title}`}
                            onPress={() => headerProps.onPressEvent?.(evt)}
                            className="px-2 py-0.5 rounded-md flex-row items-center gap-1 border border-white/10"
                            style={{ backgroundColor: evt.color || '#4f46e5', opacity: 0.9 }}
                        >
                            <Ionicons name="calendar-outline" size={10} color="white" />
                            <Text className="text-white text-[10px] font-bold" numberOfLines={1}>
                                {evt.title}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};
