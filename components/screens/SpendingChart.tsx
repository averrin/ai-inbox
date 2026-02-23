import React, { useMemo } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '../ui/design-tokens';
import dayjs from 'dayjs';
import { Transaction } from '../../services/buxferService';

interface SpendingChartProps {
    transactions: Transaction[];
}

export function SpendingChart({ transactions }: SpendingChartProps) {
    const { width } = useWindowDimensions();

    const chartData = useMemo(() => {
        // Filter for expenses in the current month
        const currentMonth = dayjs().startOf('month');

        const expenses = transactions.filter(tx =>
            tx.type === 'expense' &&
            dayjs(tx.date).isSame(currentMonth, 'month')
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
                dataPointText: amount > 0 ? Math.round(amount).toString() : '',
            };
        });
    }, [transactions]);

    const maxVal = Math.max(...chartData.map(d => d.value), 100); // Minimum scale

    return (
        <View className="bg-surface p-4 rounded-xl border border-border mb-6">
            <Text className="text-white font-bold text-lg mb-4">Monthly Spending</Text>
            <View style={{ overflow: 'hidden' }}>
                <LineChart
                    data={chartData}
                    color={Colors.primary}
                    thickness={3}
                    curved
                    hideRules
                    hideYAxisText
                    xAxisThickness={0}
                    yAxisThickness={0}
                    noOfSections={4}
                    maxValue={maxVal * 1.2}
                    width={width - 80}
                    height={180}
                    isAnimated
                    dataPointsColor={Colors.primary}
                    dataPointsRadius={4}
                    textColor={Colors.text.secondary}
                    textShiftY={-8}
                    textFontSize={10}
                    hideDataPoints={false} // Show points so we can see daily values
                    startFillColor={Colors.primary}
                    endFillColor={Colors.primary}
                    startOpacity={0.2}
                    endOpacity={0.0}
                    areaChart
                />
            </View>
        </View>
    );
}
