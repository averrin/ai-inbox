import React, { useState, useEffect } from 'react';
import { View, Text, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Account } from '../../../services/buxferService';
import { AppButton, CloseButton } from '../../ui/AppButton';
import { Input } from '../../ui/Input';
import { Colors } from '../../ui/design-tokens';
import { formatCurrency } from './moneyUtils';

interface SetAmountModalProps {
    visible: boolean;
    account: Account | null;
    onConfirm: (amount: number) => Promise<void>;
    onCancel: () => void;
}

export function SetAmountModal({ visible, account, onConfirm, onCancel }: SetAmountModalProps) {
    const [amountStr, setAmountStr] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) {
            setAmountStr('');
        }
    }, [visible]);

    const handleConfirm = async () => {
        if (!account || !amountStr) return;
        const newAmount = parseFloat(amountStr);
        if (isNaN(newAmount)) return;

        setSaving(true);
        try {
            await onConfirm(newAmount);
        } finally {
            setSaving(false);
        }
    };

    if (!account) return null;

    const newAmount = parseFloat(amountStr);
    const isValid = !isNaN(newAmount);
    const diff = isValid ? newAmount - account.balance : 0;
    const isIncome = diff >= 0;
    const diffColor = isIncome ? Colors.status.healthy : Colors.error;
    const diffSign = isIncome ? '+' : '';

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-end bg-black/50"
            >
                <View className="bg-background rounded-t-3xl border-t border-border px-6 pt-6 pb-10">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">Set Amount</Text>
                        <CloseButton onPress={onCancel} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View className="bg-surface rounded-xl p-4 border border-border mb-5">
                            <Text className="text-white font-medium mb-1">{account.name}</Text>
                            <Text className="text-text-tertiary text-sm mb-2">Current Balance</Text>
                            <Text className="text-2xl font-bold text-white">
                                {formatCurrency(account.balance, account.currency)}
                            </Text>
                        </View>

                        <Input
                            label="New Balance"
                            value={amountStr}
                            onChangeText={setAmountStr}
                            placeholder="0.00"
                            keyboardType="numeric"
                            autoFocus
                        />

                        {isValid && Math.abs(diff) > 0 && (
                            <View className="bg-surface/50 rounded-xl p-4 border border-border mb-6 flex-row justify-between items-center">
                                <Text className="text-text-secondary font-medium">Difference</Text>
                                <Text className="text-lg font-bold" style={{ color: diffColor }}>
                                    {diffSign}{formatCurrency(diff, account.currency)}
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    <View className="flex-row gap-3 mt-4">
                        <AppButton
                            title="Cancel"
                            variant="ghost"
                            size="lg"
                            onPress={onCancel}
                            flex
                        />
                        <AppButton
                            title="Confirm"
                            variant="primary"
                            size="lg"
                            onPress={handleConfirm}
                            loading={saving}
                            disabled={saving || !isValid}
                            flex
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
