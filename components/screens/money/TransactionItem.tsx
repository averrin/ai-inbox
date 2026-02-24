import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../../../services/buxferService';
import { MetadataChip } from '../../ui/MetadataChip';
import { Colors } from '../../ui/design-tokens';
import { getTransactionStyle } from './moneyUtils';

interface TransactionItemProps {
    tx: Transaction;
    onLongPress?: (tx: Transaction) => void;
    formatCurrency: (amount: number, currency?: string) => string;
    getTxCurrency: (tx: Transaction) => string;
    isBudgetMode?: boolean;
}

export function TransactionItem({ tx, onLongPress, formatCurrency, getTxCurrency, isBudgetMode = false }: TransactionItemProps) {
    const { color, prefix } = getTransactionStyle(tx.type);

    if (isBudgetMode) {
        return (
            <TouchableOpacity
                className="px-4 py-3"
                style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}
                onLongPress={() => onLongPress?.(tx)}
                delayLongPress={400}
                activeOpacity={0.7}
            >
                <View className="flex-row justify-between items-start">
                    <Text className="text-white text-sm flex-1 mr-3" numberOfLines={2}>
                        {tx.description}
                    </Text>
                    <Text
                        className="text-sm font-semibold"
                        style={{ color }}
                    >
                        {prefix}{formatCurrency(Math.abs(tx.amount), getTxCurrency(tx))}
                    </Text>
                </View>
                <Text className="text-text-tertiary text-xs mt-1">
                    {dayjs(tx.date).format('MMM D, YYYY')}
                </Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            className="bg-surface p-4 rounded-xl border border-border mb-3"
            onLongPress={() => onLongPress?.(tx)}
            delayLongPress={400}
            activeOpacity={1}
        >
            <View className="flex-row justify-between items-start mb-2">
                <Text className="text-white font-medium flex-1 mr-2" numberOfLines={2}>{tx.description}</Text>
                <Text
                    className="font-bold"
                    style={{ color }}
                >
                    {prefix}{formatCurrency(Math.abs(tx.amount), getTxCurrency(tx))}
                </Text>
            </View>

            <View className="flex-row justify-between items-center flex-wrap gap-y-2">
                <View className="flex-row items-center gap-2 flex-wrap flex-1 mr-2">
                    <Text className="text-text-secondary text-xs mr-1">{dayjs(tx.date).format('MMM D')}</Text>
                    {tx.tags && tx.tags.split(',').map(tag => {
                        const trimmedTag = tag.trim();
                        return (
                            <MetadataChip
                                key={trimmedTag}
                                type="tag"
                                name={trimmedTag}
                                size="sm"
                                style={{ marginRight: 2 }}
                            />
                        );
                    })}
                </View>
                <MetadataChip
                    label={tx.accountName}
                    size="sm"
                    variant="outline"
                    icon="wallet-outline"
                    color={Colors.text.tertiary}
                />
            </View>
        </TouchableOpacity>
    );
}
