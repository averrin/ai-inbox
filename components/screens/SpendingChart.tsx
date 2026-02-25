import React, { useMemo } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '../ui/design-tokens';
import dayjs from 'dayjs';
import { Transaction } from '../../services/buxferService';

interface SpendingChartProps {
    transactions: Transaction[];
    previousMonthTransactions?: Transaction[];
}

export function SpendingChart({ transactions, previousMonthTransactions = [] }: SpendingChartProps) {
    const { width } = useWindowDimensions();

    const { chartData, prevChartData, maxVal } = useMemo(() => {
        const processTransactions = (txs: Transaction[], monthStart: dayjs.Dayjs) => {
            const expenses = txs.filter(tx =>
                tx.type === 'expense' &&
                dayjs(tx.date).isSame(monthStart, 'month')
            );

            const dailySpending: Record<string, number> = {};
            const daysInMonth = monthStart.daysInMonth();

            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = monthStart.date(i).format('YYYY-MM-DD');
                dailySpending[dateStr] = 0;
            }

            expenses.forEach(tx => {
                const dateStr = dayjs(tx.date).format('YYYY-MM-DD');
                if (dailySpending[dateStr] !== undefined) {
                    dailySpending[dateStr] += Math.abs(tx.amount);
                }
            });

            let cumulative = 0;
            return Object.entries(dailySpending).sort((a, b) => a[0].localeCompare(b[0])).map(([date, amount]) => {
                cumulative += amount;
                const d = dayjs(date);
                const showLabel = d.date() === 1 || d.date() % 5 === 0;

                return {
                    value: cumulative,
                    label: showLabel ? d.format('D') : '',
                    labelTextStyle: { color: Colors.text.tertiary, fontSize: 10 },
                };
            });
        };

        const currentMonth = dayjs().startOf('month');
        const prevMonth = dayjs().subtract(1, 'month').startOf('month');

        const data = processTransactions(transactions, currentMonth);
        const prevData = processTransactions(previousMonthTransactions, prevMonth);

        const maxCurrent = Math.max(...data.map(d => d.value), 100);
        const maxPrev = Math.max(...prevData.map(d => d.value), 100);
        const max = Math.max(maxCurrent, maxPrev);

        return { chartData: data, prevChartData: prevData, maxVal: max };
    }, [transactions, previousMonthTransactions]);

    // Calculate dynamic spacing to fit the screen
    // container width = width - 32 (padding 16*2) - 32 (internal padding) ~ width - 64
    // We have chartData.length points (days in month, e.g., 30 or 31)
    // spacing * (points - 1) = available width
    const availableWidth = width - 80; // Approximate available width inside the card
    const points = Math.max(chartData.length, prevChartData.length);
    const spacing = availableWidth / (points || 1);

    return (
        <View className="bg-surface p-4 rounded-xl border border-border mb-6">
            <Text className="text-white font-bold text-lg mb-4">Cumulative Spending</Text>
            <View style={{ overflow: 'hidden' }}>
                <LineChart
                    data={chartData}
                    data2={prevChartData}
                    color={Colors.primary}
                    color2={Colors.text.tertiary}
                    thickness={3}
                    thickness2={2}
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
                    dataPointsColor2={Colors.text.tertiary}
                    dataPointsRadius={3}
                    textColor={Colors.text.secondary}
                    textShiftY={-8}
                    textFontSize={10}
                    hideDataPoints={true} // Hide points for cleaner cumulative line
                    hideDataPoints2={true}
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
