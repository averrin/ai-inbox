import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayStatusLevel } from '../utils/difficultyUtils';

interface DateRulerProps {
    date: Date;
    onDateChange: (date: Date) => void;
    onSettingsPress?: () => void;
    // Programmatic navigation callbacks (use these for smooth animations)
    onNext?: () => void;
    onPrev?: () => void;
    onToday?: () => void;
    // Day status markers (keyed by date string YYYY-MM-DD)
    dayStatuses?: Record<string, DayStatusLevel>;
    onSync?: () => void;
    isSyncing?: boolean;
}

const ITEM_WIDTH = 56; // Width (48)n+ Margin (4*2)
const VISIBLE_RANGE_DAYS = 180; // Render +/- 180 days

// Status color helper
const getStatusColor = (status: DayStatusLevel) => {
    switch (status) {
        case 'healthy': return '#22c55e'; // Green
        case 'moderate': return '#eab308'; // Yellow
        case 'busy': return '#f97316'; // Orange
        case 'overloaded': return '#ef4444'; // Red
        default: return '#22c55e';
    }
};

interface DateItemData {
    date: Date;
    dayjs: dayjs.Dayjs;
    dateStr: string; // YYYY-MM-DD
    dayName: string; // ddd
    dayNum: string; // D
    month: string; // MMM
    isWeekend: boolean;
}

interface DateRulerItemProps {
    item: DateItemData;
    isSelected: boolean;
    isToday: boolean;
    onPress: (date: Date) => void;
    status?: DayStatusLevel;
}

const DateRulerItem = React.memo(({ item, isSelected, isToday, onPress, status }: DateRulerItemProps) => {
    const { isWeekend, dayName, dayNum, month } = item;
    const backgroundColor = isSelected ? 'bg-indigo-600' : isWeekend ? 'bg-slate-700' : 'bg-slate-800';
    const markerColor = status ? getStatusColor(status) : null;

    const handlePress = useCallback(() => {
        onPress(item.date);
    }, [item, onPress]);

    return (
        <TouchableOpacity
            onPress={handlePress}
            className={`items-center justify-center w-12 h-14 rounded-xl ${backgroundColor} mx-1`}
        >
            <Text className={`text-xs ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                {dayName}
            </Text>
            <Text className={`text-lg font-bold ${isSelected ? 'text-white' : isToday ? 'text-indigo-400' : 'text-slate-200'
                }`}>
                {dayNum}
            </Text>
            <Text className={`text-xs ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                {month}
            </Text>
            {markerColor && (
                <View
                    style={{ backgroundColor: markerColor }}
                    className="w-[0.3rem] h-6 left-[0.3rem] rounded-full absolute bottom-1.4"
                />
            )}
        </TouchableOpacity>
    );
});

export const DateRuler: React.FC<DateRulerProps> = ({ date, onDateChange, onSettingsPress, onNext, onPrev, onToday, dayStatuses, onSync, isSyncing }) => {
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
    const skipNextScrollAnimation = useRef(false);

    // We keep a "base date" to generate the list. 
    // We only regenerate the list if the user navigates too far from the base date.
    const [baseDate, setBaseDate] = useState(date);

    // Generate dates around the base date
    const dates = useMemo(() => {
        const result: DateItemData[] = [];
        const start = dayjs(baseDate).subtract(VISIBLE_RANGE_DAYS, 'day');
        // Total items = 2 * VISIBLE_RANGE_DAYS + 1
        for (let i = 0; i <= VISIBLE_RANGE_DAYS * 2; i++) {
            const d = start.add(i, 'day');
            result.push({
                date: d.toDate(),
                dayjs: d,
                dateStr: d.format('YYYY-MM-DD'),
                dayName: d.format('ddd'),
                dayNum: d.format('D'),
                month: d.format('MMM'),
                isWeekend: d.day() === 6 || d.day() === 0,
            });
        }
        return result;
    }, [baseDate]);

    // Scroll to center logic
    const scrollToCenter = (index: number, animated: boolean) => {
        if (index >= 0 && index < dates.length) {
            flatListRef.current?.scrollToOffset({
                offset: (index - 4.5) * ITEM_WIDTH,
                animated
            });
        }
    };

    const selectedDateStr = useMemo(() => dayjs(date).format('YYYY-MM-DD'), [date]);

    useEffect(() => {
        // Find index explicitly to ensure robustness
        const index = dates.findIndex(d => d.dateStr === selectedDateStr);

        if (index === -1) {
            // Date is out of currently generated range, regenerate centered on new date
            skipNextScrollAnimation.current = true;
            setBaseDate(date);
        } else {
            // Check if we are close to the edge
            if (index < 30 || index > dates.length - 30) {
                skipNextScrollAnimation.current = true;
                setBaseDate(date);
            } else {
                const animated = !skipNextScrollAnimation.current;
                scrollToCenter(index, animated);
                skipNextScrollAnimation.current = false;
            }
        }
    }, [selectedDateStr, dates]); // Trigger on day change or list regeneration

    const handleNextDay = () => {
        if (onNext) {
            onNext();
        } else {
            const nextDate = dayjs(date).add(1, 'day').toDate();
            onDateChange(nextDate);
        }
    };

    const handlePrevDay = () => {
        if (onPrev) {
            onPrev();
        } else {
            const prevDate = dayjs(date).subtract(1, 'day').toDate();
            onDateChange(prevDate);
        }
    };

    const handleTodayPress = () => {
        scrollToCenter(dates.findIndex(d => d.dayjs.isSame(dayjs(), 'day')), true);
        if (onToday) {
            onToday();
        } else {
            onDateChange(new Date());
        }
    };

    const handleDatePress = useCallback((newDate: Date) => {
        onDateChange(newDate);
    }, [onDateChange, dates]);

    const todayDateStr = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

    const renderItem = useCallback(({ item }: { item: DateItemData }) => {
        const isSelected = item.dateStr === selectedDateStr;
        const isToday = item.dateStr === todayDateStr;
        const status = dayStatuses?.[item.dateStr];

        return (
            <DateRulerItem
                item={item}
                isSelected={isSelected}
                isToday={isToday}
                onPress={handleDatePress}
                status={status}
            />
        );
    }, [selectedDateStr, todayDateStr, dayStatuses, handleDatePress]);

    return (
        <View className="bg-slate-900 border-b border-slate-800 pb-4" style={{ paddingTop: insets.top }}>
            {/* Header with Month/Year and Buttons */}
            <View className="flex-row justify-between items-center px-4 py-2">
                <View className="flex-row items-center gap-2">
                    <Text className="text-white text-lg font-bold">
                        {dayjs(date).format('MMMM YYYY')}
                    </Text>
                    {onSync && (
                         <TouchableOpacity 
                            onPress={onSync} 
                            disabled={isSyncing}
                            className={`p-1 rounded-full ${isSyncing ? 'opacity-50' : 'active:bg-slate-800'}`}
                        >
                            <Ionicons 
                                name={isSyncing ? "refresh" : "sync-outline"} 
                                size={18} 
                                color="#94a3b8" 
                                style={isSyncing ? { transform: [{ rotate: '45deg' }] } : {}} // Basic visual, rotation would need Reanimated
                            />
                        </TouchableOpacity>
                    )}
                </View>
                <View className="flex-row gap-2">
                    <TouchableOpacity onPress={handlePrevDay} className="p-2 bg-slate-800 rounded-full">
                        <Ionicons name="chevron-back" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleTodayPress} className="p-2 bg-slate-800 rounded-full">
                        <Ionicons name="today" size={20} color="#818cf8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleNextDay} className="p-2 bg-slate-800 rounded-full">
                        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                    {onSettingsPress && (
                        <TouchableOpacity onPress={onSettingsPress} className="p-2 bg-slate-800 rounded-full ml-2">
                            <Ionicons name="options-outline" size={20} color="#818cf8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Scrollable Date Strip */}
            <View className="mt-2" onLayout={(e) => setScreenWidth(e.nativeEvent.layout.width)}>
                <FlatList
                    ref={flatListRef}
                    data={dates}
                    renderItem={renderItem}
                    extraData={date} // Critical: trigger re-render of items when selected date changes
                    keyExtractor={(item) => item.dateStr}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    getItemLayout={(data, index) => (
                        { length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index }
                    )}
                    windowSize={5}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    removeClippedSubviews={true}
                    contentContainerStyle={{ paddingHorizontal: (screenWidth - ITEM_WIDTH) / 2 }}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        // purely for structure, tailwind does the rest
    }
});
