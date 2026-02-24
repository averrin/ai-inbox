import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Colors } from '../../ui/design-tokens';
import { Budget, Transaction } from '../../../services/buxferService';
import { TransactionItem } from './TransactionItem';

interface BudgetItemProps {
    budget: Budget;
    transactions: Transaction[];
    formatCurrency: (amount: number, currency?: string) => string;
    tagConfig: Record<string, any>;
    onLongPressTransaction?: (tx: Transaction) => void;
    getTxCurrency: (tx: Transaction) => string;
}


export function BudgetItem({ budget, transactions, formatCurrency, tagConfig, onLongPressTransaction, getTxCurrency }: BudgetItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const limit = Number(budget.limit) || 0;
    const spent = Number(budget.spent) || 0;
    const percent = limit > 0 ? (spent / limit) * 100 : 0;
    const remaining = limit - spent;
    const isOver = remaining < 0;

    // Filter transactions matching this budget's name as a tag
    const matchedTransactions = useMemo(() => {
        const budgetTag = budget.name.toLowerCase();
        return transactions.filter(tx => {
            if (!tx.tags) return false;
            return tx.tags.split(',').some(t => t.trim().toLowerCase() === budgetTag);
        });
    }, [budget.name, transactions]);

    return (
        <View className="bg-surface rounded-xl border border-border overflow-hidden">
            {/* Header row — tappable */}
            <TouchableOpacity
                onPress={() => setIsExpanded(prev => !prev)}
                activeOpacity={0.7}
                className="p-4"
            >
                <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1 mr-2">
                        <Text className="text-white font-medium text-lg">{budget.name}</Text>
                        <Text className="text-text-tertiary text-xs">{budget.currentPeriod}</Text>
                    </View>
                    <View className="items-end">
                        <Text
                            className="font-bold text-lg"
                            style={{ color: remaining >= 0 ? Colors.status.healthy : Colors.error }}
                        >
                            {formatCurrency(remaining)}
                        </Text>
                        <Text className="text-text-tertiary text-xs">remaining of {formatCurrency(limit)}</Text>
                    </View>
                </View>

                {/* Progress Bar */}
                <View className="h-2 bg-background rounded-full overflow-hidden mt-2 mb-2">
                    <View
                        className="h-full rounded-full"
                        style={{
                            width: `${Math.min(Math.max(percent, 0), 100)}%`,
                            backgroundColor: isOver ? Colors.error : (percent > 80 ? Colors.warning : Colors.status.healthy)
                        }}
                    />
                </View>

                {/* Expand toggle hint */}
                <View className="flex-row items-center justify-between mt-1">
                    <Text className="text-text-tertiary text-xs">
                        {matchedTransactions.length} transaction{matchedTransactions.length !== 1 ? 's' : ''}
                    </Text>
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={Colors.text.tertiary}
                    />
                </View>
            </TouchableOpacity>

            {/* Expanded transaction list */}
            {isExpanded && (
                <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                    {matchedTransactions.length === 0 ? (
                        <View className="px-4 py-6 items-center">
                            <Ionicons name="receipt-outline" size={24} color={Colors.text.tertiary} style={{ marginBottom: 8 }} />
                            <Text className="text-text-tertiary text-sm italic">No transactions found for this budget</Text>
                        </View>
                    ) : (
                        matchedTransactions.map(tx => (
                            <TransactionItem
                                key={tx.id}
                                tx={tx}
                                onLongPress={onLongPressTransaction}
                                formatCurrency={formatCurrency}
                                getTxCurrency={getTxCurrency}
                                isBudgetMode={true}
                            />
                        ))
                    )}
                </View>
            )}
        </View>
    );
}
