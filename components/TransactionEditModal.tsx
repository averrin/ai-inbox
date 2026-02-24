import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, KeyboardAvoidingView, Platform,
    ScrollView
} from 'react-native';
import { Transaction } from '../services/buxferService';
import { TagEditor } from './ui/TagEditor';
import { AppButton, CloseButton } from './ui/AppButton';
import { Colors } from './ui/design-tokens';
import dayjs from 'dayjs';

interface TransactionEditModalProps {
    visible: boolean;
    transaction: Transaction | null;
    availableTags: string[];
    onSave: (transaction: Transaction, tags: string[]) => Promise<void>;
    onCancel: () => void;
    currency?: string;
}

export function TransactionEditModal({
    visible,
    transaction,
    availableTags,
    onSave,
    onCancel,
    currency,
}: TransactionEditModalProps) {
    const [tags, setTags] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible && transaction) {
            const txTags = transaction.tags
                ? transaction.tags.split(',').map(t => t.trim()).filter(Boolean)
                : [];
            setTags(txTags);
        }
    }, [visible, transaction]);

    const handleAddTag = (tag: string) => {
        const clean = tag.trim().replace(/^#/, '');
        if (clean && !tags.includes(clean)) {
            setTags(prev => [...prev, clean]);
        }
    };

    const handleRemoveTag = (index: number) => {
        setTags(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!transaction) return;
        setSaving(true);
        try {
            await onSave(transaction, tags);
        } finally {
            setSaving(false);
        }
    };

    if (!transaction) return null;

    let amountColor = Colors.text.secondary;
    let amountSign = '';
    if (transaction.type === 'income') {
        amountColor = Colors.status.healthy;
        amountSign = '+';
    } else if (transaction.type === 'expense') {
        amountColor = Colors.error;
        amountSign = '-';
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-end bg-black/50"
            >
                <View className="bg-background rounded-t-3xl border-t border-border px-6 pt-6 pb-10">
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">Edit Transaction</Text>
                        <CloseButton onPress={onCancel} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {/* Transaction summary */}
                        <View className="bg-surface rounded-xl p-4 border border-border mb-5">
                            <Text className="text-white font-medium mb-1" numberOfLines={2}>
                                {transaction.description}
                            </Text>
                            <View className="flex-row justify-between items-center mt-1">
                                <Text className="text-text-tertiary text-xs">
                                    {dayjs(transaction.date).format('MMM D, YYYY')}
                                    {transaction.accountName ? ` · ${transaction.accountName}` : ''}
                                </Text>
                                <Text className="font-bold text-sm" style={{ color: amountColor }}>
                                    {amountSign}{Math.abs(transaction.amount).toFixed(2)} {currency || transaction.currency || 'CZK'}
                                </Text>
                            </View>
                        </View>

                        {/* Tag editor */}
                        <View className="mb-6">
                            <TagEditor
                                label="Tags"
                                tags={tags}
                                onAddTag={handleAddTag}
                                onRemoveTag={handleRemoveTag}
                                availableTags={availableTags}
                            />
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View className="flex-row gap-3">
                        <AppButton
                            title="Cancel"
                            variant="ghost"
                            size="lg"
                            onPress={onCancel}
                            flex
                        />
                        <AppButton
                            title="Save"
                            variant="primary"
                            size="lg"
                            onPress={handleSave}
                            loading={saving}
                            disabled={saving}
                            flex
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
