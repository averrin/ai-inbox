import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';


interface ScheduleEventProps {
    event: any;
    touchableOpacityProps: any;
    timeFormat: string;
}

// Helper function to get difficulty color based on value (0-5+)
const getDifficultyColor = (difficulty: number): string => {
    if (difficulty === 0) return '#64748b'; // slate-500 for 0

    // Map difficulty 1-5 to traffic-light style colors
    const difficultyColors = [
        '#22c55e', // green-500 (difficulty 1)
        '#eab308', // yellow-500 (difficulty 2)
        '#f97316', // orange-500 (difficulty 3)
        '#dc2626', // red-600 (difficulty 4)
        '#b91c1c', // red-700 (difficulty 5+)
    ];

    // Cap at index 4 (difficulty 5 color) for any value >= 5
    const index = Math.min(Math.max(difficulty - 1, 0), 4);
    return difficultyColors[index];
};

export const ScheduleEvent = ({ event: evt, touchableOpacityProps, timeFormat }: ScheduleEventProps) => {
    // Fix for "key prop being spread" error is handled by caller or ignored here if we spread all props
    // touchableOpacityProps includes key, style, onPress, etc.
    const { key, ...restProps } = touchableOpacityProps;
    const timeFormatStr = timeFormat === '24h' ? 'HH:mm' : 'h:mm A';
    const rangeOverlapCount = (evt as any).rangeOverlapCount || 0;
    const leftMargin = 4 + (rangeOverlapCount * 8);

    if (evt.type === 'marker') {
        const color = evt.color || (evt.originalEvent.alarm ? '#ef4444' : '#f59e0b');

        return (
            <TouchableOpacity
                key={key}
                {...restProps}
                style={[
                    restProps.style,
                    {
                        padding: 0,
                        height: 24, // Fixed height for marker
                        marginTop: -12, // Center on time (this might need adjustment depending on base offset)
                        overflow: 'visible',
                        zIndex: 20, // Above events,
                        backgroundColor: 'transparent',
                        elevation: 0,
                        shadowOpacity: 0,
                        shadowColor: 'transparent',
                        borderWidth: 0,
                        marginLeft: leftMargin,
                    }
                ]}
            >
                <View className="flex-row items-center w-full">
                    {/* Text Label */}
                    <View
                        className="bg-slate-900/90 rounded px-2 py-0.5 border shadow-sm"
                        style={{ borderColor: color, opacity: 0.9, backgroundColor: "#0f172a" }}
                    >
                        <Text
                            className="text-[10px] font-bold"
                            style={{ color }}
                            numberOfLines={1}
                        >
                            {dayjs(evt.start).format(timeFormatStr)} {evt.title}
                        </Text>
                    </View>

                    {/* Horizontal Line */}
                    <View
                        style={{
                            flex: 1,
                            height: 1,
                            backgroundColor: color,
                            borderStyle: 'dashed',
                            marginLeft: 0,
                            opacity: 0.5
                        }}
                    />
                </View>
            </TouchableOpacity>
        );
    }

    const duration = dayjs(evt.end).diff(dayjs(evt.start), 'minute');
    const isCompact = duration <= 30;

    return (
        <TouchableOpacity key={key} {...restProps} style={[restProps.style, {
            marginLeft: leftMargin,
        }]}>
            <View className={`flex-row items-center ${isCompact ? 'gap-2' : ''}`}>
                <Text className="text-white font-semibold text-xs" numberOfLines={1}>
                    {evt.title}
                </Text>
                {isCompact && (
                    <Text className="text-white/80 text-[10px]" numberOfLines={1}>
                        {dayjs(evt.start).format(timeFormatStr)} - {dayjs(evt.end).format(timeFormatStr)}
                    </Text>
                )}
            </View>

            {!isCompact && (
                <Text className="text-white/80 text-[10px]" numberOfLines={1}>
                    {dayjs(evt.start).format(timeFormatStr)} - {dayjs(evt.end).format(timeFormatStr)}
                </Text>
            )}

            <View className="absolute top-1 right-1 flex-row gap-1 items-center">
                {evt.movable && (
                    <View className="bg-emerald-500/80 px-1 py-0.5 rounded">
                        <Ionicons name="move" size={10} color="white" />
                    </View>
                )}
                {evt.isSkippable && (
                    <View className="bg-rose-500/80 px-1 py-0.5 rounded">
                        <Ionicons name="return-up-forward" size={10} color="white" />
                    </View>
                )}
                {evt.difficulty !== undefined && (
                    <View
                        className="px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: getDifficultyColor(evt.difficulty) + 'CC' }} // CC adds 80% opacity
                    >
                        <Text className="text-white text-[8px] font-bold">
                            {evt.difficulty}
                        </Text>
                    </View>
                )}
                {evt.typeTag && (
                    <View className="bg-black/30 px-1.5 py-0.5 rounded">
                        <Text className="text-white text-[8px] font-bold uppercase tracking-wider">
                            {evt.typeTag}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};
