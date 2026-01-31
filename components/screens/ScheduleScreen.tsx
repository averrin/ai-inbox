import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as BigCalendar } from 'react-native-big-calendar';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settings';
import { getCalendarEvents, ensureCalendarPermissions } from '../../services/calendarService';
import { CalendarSelector } from '../CalendarSelector';
import * as Calendar from 'expo-calendar';
import { useFocusEffect } from '@react-navigation/native';

import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';

export default function ScheduleScreen() {
    const { visibleCalendarIds } = useSettingsStore();
    const { height } = useWindowDimensions();
    const [events, setEvents] = useState<any[]>([]);
    const [date, setDate] = useState(new Date());
    const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
    const [showSettings, setShowSettings] = useState(false);
    const [viewMode, setViewMode] = useState<'day' | '3days' | 'week'>('day');

    // Calculate initial scroll position to center the current time
    const initialScrollOffset = useMemo(() => {
        const now = dayjs();
        const totalMinutes = now.hour() * 60 + now.minute();
        const cellHeight = 50; // Default cell height in BigCalendar
        const viewportHeight = height - 100;
        const minutesVisible = (viewportHeight / cellHeight) * 60;
        return Math.max(0, totalMinutes - (minutesVisible / 2));
    }, [height]);

    const scrollOffset = useRef(initialScrollOffset);

    const changeDate = (newDate: Date) => {
        if (newDate > date) {
            setDirection('forward');
        } else {
            setDirection('backward');
        }
        setDate(newDate);
    };

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = event.nativeEvent.contentOffset.y;
        const minutes = (y / 50) * 60;
        scrollOffset.current = minutes;
    };

    const fetchEvents = async () => {
        if (visibleCalendarIds.length === 0) {
            setEvents([]);
            return;
        }

        const start = dayjs(date).startOf('week').subtract(1, 'week').toDate();
        const end = dayjs(date).endOf('week').add(1, 'week').toDate();

        try {
            const nativeEvents = await getCalendarEvents(visibleCalendarIds, start, end);
            
            // Map native events to BigCalendar format
            const mappedEvents = nativeEvents.map(evt => ({
                title: evt.title,
                start: new Date(evt.startDate),
                end: new Date(evt.endDate),
                color: evt.calendarId ? 'rgba(79, 70, 229, 0.8)' : undefined,
            }));
            
            setEvents(mappedEvents);
        } catch (e) {
            console.error("Error fetching events", e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchEvents();
        }, [visibleCalendarIds, date])
    );

    return (
        <View className="flex-1 bg-slate-950">
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="flex-row justify-between items-center px-4 py-3 border-b border-slate-800 bg-slate-900">
                    <Text className="text-white text-xl font-bold">Schedule</Text>
                    <View className="flex-row gap-3">
                         <TouchableOpacity onPress={() => changeDate(new Date())}>
                            <Ionicons name="today-outline" size={24} color="#818cf8" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowSettings(true)}>
                            <Ionicons name="options-outline" size={24} color="#818cf8" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Calendar View */}
                {visibleCalendarIds.length === 0 ? (
                    <View className="flex-1 justify-center items-center p-6">
                        <Ionicons name="calendar-outline" size={64} color="#334155" />
                        <Text className="text-slate-400 text-center mt-4">
                            No calendars selected.
                        </Text>
                        <TouchableOpacity 
                            onPress={() => setShowSettings(true)}
                            className="mt-4 bg-indigo-600 px-6 py-3 rounded-full"
                        >
                            <Text className="text-white font-semibold">Select Calendars</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View className="flex-1 overflow-hidden">
                        <Animated.View 
                            key={date.toISOString()}
                            entering={direction === 'forward' ? SlideInRight : SlideInLeft}
                            exiting={direction === 'forward' ? SlideOutLeft : SlideOutRight}
                            className="flex-1"
                        >
                            {/* @ts-ignore - onScroll is monkey-patched */}
                            <BigCalendar 
                                events={events} 
                                height={height - 100}
                                date={date}
                                mode={viewMode}
                                onSwipeEnd={(d) => changeDate(d)}
                                scrollOffsetMinutes={scrollOffset.current}
                                onScroll={handleScroll}
                                theme={{
                                    palette: {
                                        primary: {
                                            main: '#818cf8',
                                            contrastText: '#fff',
                                        },
                                        gray: {
                                            100: '#334155',
                                            200: '#1e293b',
                                            300: '#94a3b8',
                                            500: '#cbd5e1', 
                                            800: '#f8fafc',
                                        },
                                    },
                                    typography: {
                                        xs: {
                                            fontSize: 14,
                                            fontWeight: '500', 
                                        },
                                        sm: {
                                            fontSize: 16,
                                            fontWeight: '600',
                                        },
                                        xl: {
                                            fontSize: 26,
                                            fontWeight: 'bold',
                                        },
                                    }
                                }}
                                eventCellStyle={(event) => ({
                                    backgroundColor: event.color || '#4f46e5',
                                    borderRadius: 4,
                                    opacity: 0.9
                                })}
                                calendarCellStyle={{ borderColor: '#334155', backgroundColor: '#0f172a' }}
                                headerContainerStyle={{ backgroundColor: '#1e293b', paddingTop: 10, paddingBottom: 10 }}
                                bodyContainerStyle={{ backgroundColor: '#0f172a' }}
                            />
                        </Animated.View>
                    </View>
                )}

                {/* Settings Modal */}
                <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
                    <View className="flex-1 bg-slate-950">
                        <SafeAreaView className="flex-1">
                            <View className="flex-row justify-between items-center px-4 py-4 border-b border-slate-800">
                                <Text className="text-white text-lg font-bold">Schedule Settings</Text>
                                <TouchableOpacity onPress={() => setShowSettings(false)}>
                                    <Text className="text-indigo-400 font-medium">Done</Text>
                                </TouchableOpacity>
                            </View>
                            <View className="p-4 flex-1">
                                <CalendarSelector onClose={() => setShowSettings(false)} />
                            </View>
                        </SafeAreaView>
                    </View>
                </Modal>
            </SafeAreaView>
        </View>
    );
}
