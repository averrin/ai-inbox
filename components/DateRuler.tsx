import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import dayjs from 'dayjs';
import { DayStatusLevel } from '../utils/difficultyUtils';
import { Colors, Sizes } from './ui/design-tokens';

interface DateRulerProps {
    date: Date;
    onDateChange: (date: Date) => void;
    // Day status markers (keyed by date string YYYY-MM-DD)
    dayStatuses?: Record<string, DayStatusLevel>;
}

const ITEM_WIDTH = Sizes.dateRulerItemWidth; // Width (48)n+ Margin (4*2)
const VISIBLE_RANGE_DAYS = 180; // Render +/- 180 days

// Status color helper
const getStatusColor = (status: DayStatusLevel) => {
    switch (status) {
        case 'healthy': return Colors.status.healthy;
        case 'moderate': return Colors.status.moderate;
        case 'busy': return Colors.status.busy;
        case 'overloaded': return Colors.status.overloaded;
        default: return Colors.status.healthy;
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
    const backgroundColor = isSelected ? 'bg-primary' : isWeekend ? 'bg-surface-highlight' : 'bg-surface';
    const markerColor = status ? getStatusColor(status) : null;

    const handlePress = useCallback(() => {
        onPress(item.date);
    }, [item, onPress]);

    return (
        <TouchableOpacity
            onPress={handlePress}
            className={`items-center justify-center w-12 h-14 rounded-xl ${backgroundColor} mx-1`}
        >
            <Text className={`text-xs ${isSelected ? 'text-white' : 'text-text-tertiary'}`}>
                {dayName}
            </Text>
            <Text className={`text-lg font-bold ${isSelected ? 'text-white' : isToday ? 'text-primary' : 'text-text-primary'
                }`}>
                {dayNum}
            </Text>
            <Text className={`text-xs ${isSelected ? 'text-white' : 'text-text-tertiary'}`}>
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

export const DateRuler: React.FC<DateRulerProps> = ({ date, onDateChange, dayStatuses }) => {
    const flatListRef = useRef<FlatList>(null);

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
                onPress={onDateChange}
                status={status}
            />
        );
    }, [selectedDateStr, todayDateStr, dayStatuses, onDateChange]);

    return (
        <View className="border-b border-border pb-4" style={{ backgroundColor: Colors.transparent }}>
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
