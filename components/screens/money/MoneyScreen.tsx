import { View, Text, TextInput, TouchableOpacity, ScrollView, RefreshControl, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../../store/settings';
import { useMoneyStore } from '../../../store/moneyStore';
import { useState, useMemo } from 'react';
import { Account, Transaction, Budget, editTransaction, addTransaction } from '../../../services/buxferService';
import { useBuxferStore } from '../../../store/buxferStore';
import '../../../services/buxferService';
import { BaseScreen } from '../BaseScreen';
import { islandBaseStyle } from '../../ui/IslandBar';
import { MetadataChip } from '../../ui/MetadataChip';
import { Colors } from '../../ui/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { showError } from '../../../utils/alert';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { SpendingChart } from '../SpendingChart';
import { TransactionEditModal } from './TransactionEditModal';
import { BudgetItem } from './BudgetItem';
import { TransactionItem } from './TransactionItem';
import { formatCurrency } from './moneyUtils';
import { SetAmountModal } from './SetAmountModal';
import { AppButton } from '../../ui/AppButton';



export default function MoneyScreen() {
    const insets = useSafeAreaInsets();
    const { buxferEmail, buxferPassword, tagConfig } = useSettingsStore();
    const { previousMonthTransactions, previousMonthId, setPreviousMonthTransactions } = useMoneyStore();

    const { accounts, transactions, budgets, loading } = useBuxferStore();
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [setAmountAccount, setSetAmountAccount] = useState<Account | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const MONEY_TAB_KEYS = ['overview', 'transactions', 'budgets'];

    // Search & Settings State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [scrollX, setScrollX] = useState(0);


    // Extract unique tags from transactions
    const uniqueTags = useMemo(() => {
        const counts: Record<string, number> = {};
        transactions.forEach(tx => {
            if (tx.tags) {
                tx.tags.split(',').forEach((t: string) => {
                    const tag = t.trim();
                    if (tag) {
                        counts[tag] = (counts[tag] || 0) + 1;
                    }
                });
            }
        });
        return Object.keys(counts).sort((a, b) => {
            const diff = counts[b] - counts[a];
            if (diff !== 0) return diff;
            return a.localeCompare(b);
        });
    }, [transactions]);




    const getTxCurrency = (tx: Transaction): string => {
        if (tx.currency) return tx.currency;
        const acc = accounts.find(a => String(a.id) === String(tx.accountId));
        return acc?.currency || 'CZK';
    };

    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    const monthlyStats = useMemo(() => {
        const now = dayjs();
        let income = 0;
        let expense = 0;

        transactions.forEach(tx => {
            if (dayjs(tx.date).isSame(now, 'month')) {
                if (tx.type === 'income') {
                    income += Math.abs(tx.amount);
                } else if (tx.type === 'expense') {
                    expense += Math.abs(tx.amount);
                }
            }
        });
        return { income, expense };
    }, [transactions]);


    const renderOverview = () => (
        <ScrollView
            contentContainerStyle={{ paddingTop: 80, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
            refreshControl={
                <RefreshControl
                    refreshing={loading}
                    onRefresh={() => {}}
                    tintColor={Colors.primary}
                    colors={[Colors.primary]}
                    progressViewOffset={140}
                />
            }
        >
            {/* Total Balance Card */}
            <View className="bg-surface p-6 rounded-2xl border border-border mb-6">
                <View className="items-center mb-4">
                    <Text className="text-text-secondary font-medium mb-2">Total Net Worth</Text>
                    <Text
                        className="text-4xl font-bold"
                        style={{ color: totalBalance >= 0 ? Colors.status.healthy : Colors.error }}
                    >
                        {formatCurrency(totalBalance)}
                    </Text>
                </View>

                {/* Monthly Summary */}
                <View className="flex-row justify-between border-t border-border pt-4">
                    <View className="items-center flex-1 border-r border-border">
                        <Text className="text-text-tertiary text-xs uppercase mb-1">Income</Text>
                        <Text className="text-lg font-bold" style={{ color: Colors.status.healthy }}>
                            +{formatCurrency(monthlyStats.income)}
                        </Text>
                    </View>
                    <View className="items-center flex-1">
                        <Text className="text-text-tertiary text-xs uppercase mb-1">Expenses</Text>
                        <Text className="text-lg font-bold" style={{ color: Colors.error }}>
                            -{formatCurrency(monthlyStats.expense)}
                        </Text>
                    </View>
                </View>
            </View>

            <SpendingChart transactions={transactions} previousMonthTransactions={previousMonthTransactions} />

            {/* Accounts Section */}
            <View className="mb-6 flex-col gap-2">
                <Text className="text-white font-bold text-lg">Accounts</Text>
                {accounts.length === 0 ? (
                    <Text className="text-text-tertiary italic">No accounts found.</Text>
                ) : (
                    accounts.map(acc => (
                        <View key={acc.id} className="bg-surface p-4 rounded-xl border border-border flex-row justify-between items-center">
                            <View>
                                <Text className="text-white font-medium mb-1">{acc.name}</Text>
                                <View className="flex-row items-center gap-2">
                                    <MetadataChip label={acc.bank} size="sm" variant="outline" color={Colors.text.tertiary} />
                                    {acc.bank === 'Other' && (
                                        <AppButton
                                            title="Set Amount"
                                            size="xs"
                                            variant="secondary"
                                            onPress={() => setSetAmountAccount(acc)}
                                        />
                                    )}
                                </View>
                            </View>
                            <Text
                                className="font-bold"
                                style={{ color: acc.balance >= 0 ? Colors.status.healthy : Colors.error }}
                            >
                                {formatCurrency(acc.balance, acc.currency)}
                            </Text>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );

    const renderTransactions = () => {
        const filteredTransactions = transactions.filter(tx => {
            // Tag filtering
            if (selectedTag) {
                if (!tx.tags) return false;
                const txTags = tx.tags.split(',').map((t: string) => t.trim());
                if (!txTags.includes(selectedTag)) return false;
            }

            // Search query filtering
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                tx.description.toLowerCase().includes(q) ||
                (tx.tags && tx.tags.toLowerCase().includes(q)) ||
                (tx.accountName && tx.accountName.toLowerCase().includes(q)) ||
                tx.amount.toString().includes(q)
            );
        });

        const filteredBalance = filteredTransactions.reduce((acc, tx) => {
            if (tx.type === 'income') return acc + Math.abs(tx.amount);
            if (tx.type === 'expense') return acc - Math.abs(tx.amount);
            // Transfers are ignored in balance calculation
            return acc;
        }, 0);

        return (
            <FlatList
                data={filteredTransactions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingTop: 120, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={() => {}}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                        progressViewOffset={140}
                    />
                }
                ListHeaderComponent={
                    <View className="mb-4 flex-col gap-2">
                        <View className="bg-surface p-3 rounded-xl border border-border flex-row items-center">
                            <Ionicons name="search" size={20} color={Colors.text.tertiary} style={{ marginRight: 8 }} />
                            <TextInput
                                className="flex-1 text-white text-base"
                                placeholder="Search transactions..."
                                placeholderTextColor={Colors.text.tertiary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={20} color={Colors.text.tertiary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <View className="flex-row justify-between items-center  bg-surface p-4 rounded-xl border border-border">
                            <Text className="text-text-secondary text-sm font-medium">Shown Balance</Text>
                            <Text
                                className="text-xl font-bold"
                                style={{ color: filteredBalance >= 0 ? Colors.status.healthy : Colors.error }}
                            >
                                {formatCurrency(filteredBalance)}
                            </Text>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <Text className="text-text-tertiary italic text-center mt-10">
                        {searchQuery || selectedTag ? "No transactions found matching your filters." : "No recent transactions."}
                    </Text>
                }
                renderItem={({ item: tx }) => (
                    <TransactionItem
                        tx={tx}
                        onLongPress={setEditingTx}
                        formatCurrency={formatCurrency}
                        getTxCurrency={getTxCurrency}
                    />
                )}
            />
        );
    };

    const handleEditSave = async (tx: Transaction, tags: string[]) => {
        try {
            await editTransaction(tx.id, { tags: tags.join(',') });
            setEditingTx(null);
        } catch (e: any) {
            showError('Edit Error', e.message || 'Failed to update transaction.');
        }
    };

    const handleSetAmountConfirm = async (newAmount: number) => {
        if (!setAmountAccount) return;

        const diff = newAmount - setAmountAccount.balance;
        if (Math.abs(diff) < 0.01) {
            setSetAmountAccount(null);
            return;
        }

        try {
            await addTransaction({
                description: 'Balance Adjustment',
                amount: Math.abs(diff),
                accountId: setAmountAccount.id,
                date: dayjs().format('YYYY-MM-DD'),
                type: diff > 0 ? 'income' : 'expense',
                status: 'cleared',
            });
            setSetAmountAccount(null);
        } catch (e: any) {
            showError('Update Error', e.message || 'Failed to update account balance.');
        }
    };

    const renderBudgets = () => (
        <ScrollView
            contentContainerStyle={{ paddingTop: 80, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
            refreshControl={
                <RefreshControl
                    refreshing={loading}
                    onRefresh={() => {}}
                    tintColor={Colors.primary}
                    colors={[Colors.primary]}
                    progressViewOffset={140}
                />
            }
        >
            <View className="mb-6 flex-col gap-2">
                <Text className="text-white font-bold text-lg">Your Budgets</Text>
                {budgets.length === 0 ? (
                    <Text className="text-text-tertiary italic">No budgets found.</Text>
                ) : (
                    budgets.map(budget => (
                        <BudgetItem
                            key={budget.id}
                            budget={budget}
                            transactions={transactions}
                            formatCurrency={formatCurrency}
                            tagConfig={tagConfig}
                            onLongPressTransaction={setEditingTx}
                            getTxCurrency={getTxCurrency}
                        />
                    ))
                )}
            </View>
        </ScrollView>
    );

    const tabs = [
        { key: 'overview', label: 'Overview' },
        { key: 'transactions', label: 'Transactions' },
        { key: 'budgets', label: 'Budgets' }
    ];

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        // Reset search/filters when changing tabs
        setSearchQuery('');
    };


    return (
        <BaseScreen
            title="Money"
            tabs={(buxferEmail && buxferPassword) ? tabs : undefined}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            headerChildren={activeTab === 'transactions' && buxferEmail && buxferPassword && uniqueTags.length > 0 && (
                <View style={[islandBaseStyle, { marginTop: 8, paddingLeft: 4, position: 'relative', marginLeft: 6, marginRight: 6 }]}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingLeft: 12, paddingRight: 32, paddingVertical: 4 }}
                        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
                        scrollEventThrottle={16}
                    >
                        <MetadataChip
                            label="All"
                            variant={selectedTag === null ? "solid" : "outline"}
                            color={Colors.status.healthy}
                            onPress={() => setSelectedTag(null)}
                        />
                        {uniqueTags.map(tag => (
                            <MetadataChip
                                key={tag}
                                type="tag"
                                name={tag}
                                variant={selectedTag === tag ? "solid" : "outline"}
                                onPress={() => setSelectedTag(tag === selectedTag ? null : tag)}
                            />
                        ))}
                    </ScrollView>

                    {/* Left Gradient Fade */}
                    {scrollX > 10 && (
                        <LinearGradient
                            colors={['rgba(30, 41, 59, 1)', 'rgba(30, 41, 59, 0)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, borderTopLeftRadius: 30, borderBottomLeftRadius: 30 }}
                            pointerEvents="none"
                        />
                    )}

                    {/* Right Gradient Fade */}
                    <LinearGradient
                        colors={['rgba(30, 41, 59, 0)', 'rgba(30, 41, 59, 1)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, borderTopRightRadius: 30, borderBottomRightRadius: 30 }}
                        pointerEvents="none"
                    />
                </View>
            )}
        >
            {!buxferEmail || !buxferPassword ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="wallet-outline" size={64} color="#475569" />
                    <Text className="text-text-tertiary mt-4 text-center">Buxfer Not Configured</Text>
                    <Text className="text-secondary text-sm mt-1 text-center">Please set your Buxfer credentials in Settings.</Text>
                </View>
            ) : (
                <>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'transactions' && renderTransactions()}
                    {activeTab === 'budgets' && renderBudgets()}
                </>
            )}

            <TransactionEditModal
                visible={!!editingTx}
                transaction={editingTx}
                availableTags={uniqueTags}
                onSave={handleEditSave}
                onCancel={() => setEditingTx(null)}
                currency={editingTx ? getTxCurrency(editingTx) : undefined}
            />

            <SetAmountModal
                visible={!!setAmountAccount}
                account={setAmountAccount}
                onConfirm={handleSetAmountConfirm}
                onCancel={() => setSetAmountAccount(null)}
            />
        </BaseScreen>
    );
}
