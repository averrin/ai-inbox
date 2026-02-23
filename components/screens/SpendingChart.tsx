import React, { useMemo } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { Colors } from '../ui/design-tokens';
import dayjs from 'dayjs';
import { Transaction } from '../../services/buxferService';
import { LinearGradient } from 'expo-linear-gradient';

interface SpendingChartProps {
    transactions: Transaction[];
}

export function SpendingChart({ transactions }: SpendingChartProps) {
    const { width } = useWindowDimensions();

    const chartData = useMemo(() => {
        // Filter for expenses in the current month
        const currentMonth = dayjs().startOf('month');
        const endOfMonth = dayjs().endOf('month');

        const expenses = transactions.filter(tx =>
            tx.type === 'expense' &&
            dayjs(tx.date).isAfter(currentMonth) &&
            dayjs(tx.date).isBefore(endOfMonth.add(1, 'day')) // Include today
        );

        // Aggregate by day
        const dailySpending: Record<string, number> = {};
        // Initialize all days of the month with 0
        const daysInMonth = currentMonth.daysInMonth();
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = currentMonth.date(i).format('YYYY-MM-DD');
            dailySpending[dateStr] = 0;
        }

        expenses.forEach(tx => {
            const dateStr = dayjs(tx.date).format('YYYY-MM-DD');
            if (dailySpending[dateStr] !== undefined) {
                dailySpending[dateStr] += Math.abs(tx.amount);
            }
        });

        // Convert to chart data format
        return Object.entries(dailySpending).map(([date, amount]) => {
            const d = dayjs(date);
            return {
                value: amount,
                label: d.date() % 5 === 0 || d.date() === 1 ? d.format('D') : '', // Label every 5th day
                labelTextStyle: { color: Colors.text.tertiary, fontSize: 10 },
                frontColor: Colors.primary,
                topLabelComponent: () => (
                    amount > 0 ? <Text style={{ color: Colors.text.secondary, fontSize: 9, marginBottom: 2 }}>{Math.round(amount)}</Text> : null
                ),
            };
        });
    }, [transactions]);

    const maxVal = Math.max(...chartData.map(d => d.value), 100); // Minimum scale to avoid flat line on 0

    return (
        <View className="bg-surface p-4 rounded-xl border border-border mb-6">
            <Text className="text-white font-bold text-lg mb-4">Monthly Spending</Text>
            <View style={{ overflow: 'hidden' }}>
                <BarChart
                    data={chartData}
                    barWidth={6}
                    spacing={4}
                    roundedTop
                    roundedBottom
                    hideRules
                    xAxisThickness={0}
                    yAxisThickness={0}
                    yAxisTextStyle={{ color: Colors.text.tertiary, fontSize: 10 }}
                    noOfSections={4}
                    maxValue={maxVal * 1.2} // Add some headroom
                    width={width - 80} // Adjust for padding
                    height={180}
                    isAnimated
                />
            </View>
        </View>
    );
}
