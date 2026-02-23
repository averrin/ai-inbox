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

    const { chartData, maxVal } = useMemo(() => {
        // Filter for expenses in the current month
        const currentMonth = dayjs().startOf('month');

        const expenses = transactions.filter(tx =>
            tx.type === 'expense' &&
            dayjs(tx.date).isSame(currentMonth, 'month')
        );

        // Initialize daily spending map
        const dailySpending: Record<string, number> = {};
        const daysInMonth = currentMonth.daysInMonth();

        // Initialize all days of the month with 0
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = currentMonth.date(i).format('YYYY-MM-DD');
            dailySpending[dateStr] = 0;
        }

        // Aggregate daily expenses
        expenses.forEach(tx => {
            const dateStr = dayjs(tx.date).format('YYYY-MM-DD');
            if (dailySpending[dateStr] !== undefined) {
                dailySpending[dateStr] += Math.abs(tx.amount);
            }
        });

        // Compute cumulative sum and format for chart
        let cumulative = 0;
        const data = Object.entries(dailySpending).sort((a, b) => a[0].localeCompare(b[0])).map(([date, amount]) => {
            cumulative += amount;
            const d = dayjs(date);

            // Only show labels for every ~5 days to avoid clutter
            const showLabel = d.date() === 1 || d.date() % 5 === 0;

            return {
                value: cumulative,
                label: showLabel ? d.format('D') : '',
                labelTextStyle: { color: Colors.text.tertiary, fontSize: 10 },
                // Only show data point text for significant jumps or specific intervals if needed
                // For cumulative, maybe just the value?
                // dataPointText: cumulative > 0 ? Math.round(cumulative).toString() : '',
            };
        });

        const max = Math.max(...data.map(d => d.value), 100);

        return { chartData: data, maxVal: max };
    }, [transactions]);

    // Calculate dynamic spacing to fit the screen
    // container width = width - 32 (padding 16*2) - 32 (internal padding) ~ width - 64
    // We have chartData.length points (days in month, e.g., 30 or 31)
    // spacing * (points - 1) = available width
    const availableWidth = width - 80; // Approximate available width inside the card
    const spacing = availableWidth / (chartData.length || 1);

    return (
        <View className="bg-surface p-4 rounded-xl border border-border mb-6">
            <Text className="text-white font-bold text-lg mb-4">Cumulative Spending</Text>
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
                    maxValue={maxVal * 1.1}
                    width={availableWidth}
                    height={180}
                    spacing={spacing}
                    initialSpacing={0}
                    endSpacing={0}
                    isAnimated
                    dataPointsColor={Colors.primary}
                    dataPointsRadius={3}
                    textColor={Colors.text.secondary}
                    textShiftY={-8}
                    textFontSize={10}
                    hideDataPoints={true} // Hide points for cleaner cumulative line
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
