import { View, Text, TextInput, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore, MetadataConfig } from '../../store/settings';
import { useState, useEffect, useMemo } from 'react';
import { buxferService, Account, Transaction, Budget } from '../../services/buxferService';
import { Layout } from '../ui/Layout';
import { IslandHeader } from '../ui/IslandHeader';
import { islandBaseStyle } from '../ui/IslandBar';
import { MetadataChip } from '../ui/MetadataChip';
import { Colors } from '../ui/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, showError } from '../../utils/alert';
import dayjs from 'dayjs';
import { MoneySettingsModal } from './MoneySettingsModal';
import { LinearGradient } from 'expo-linear-gradient';
import { SpendingChart } from './SpendingChart';

export default function MoneyScreen() {
    const insets = useSafeAreaInsets();
    const { buxferEmail, buxferPassword, setBuxferEmail, setBuxferPassword, tagConfig } = useSettingsStore();

    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [activeTab, setActiveTab] = useState('overview');

    // Search & Settings State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [scrollX, setScrollX] = useState(0);

    // Login form state
    const [emailInput, setEmailInput] = useState(buxferEmail || '');
    const [passwordInput, setPasswordInput] = useState(buxferPassword || '');
    const [showPassword, setShowPassword] = useState(false);

    const performLogin = async (email = buxferEmail, password = buxferPassword) => {
        if (!email || !password) return null;
        try {
            const t = await buxferService.login(email, password);
            setToken(t);
            return t;
        } catch (e: any) {
            console.error("Login failed", e);
            if (e.message) showError("Login Error", e.message);
            return null;
        }
    };

    const loadData = async (forceLogin = false) => {
        setLoading(true);
        try {
            let currentToken = token;
            if (!currentToken || forceLogin) {
                currentToken = await performLogin();
            }

            if (currentToken) {
                const [accs, txs, bdgts] = await Promise.all([
                    buxferService.getAccounts(currentToken),
                    buxferService.getTransactions(currentToken),
                    buxferService.getBudgets(currentToken)
                ]);
                setAccounts(accs);
                setTransactions(txs);
                setBudgets(bdgts);
            }
        } catch (e: any) {
            console.error("Failed to load data", e);
            showError("Data Load Error", "Failed to load data: " + (e.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (buxferEmail && buxferPassword) {
            loadData();
        }
    }, []); // Initial load if credentials exist

    // Extract unique tags from transactions
    const uniqueTags = useMemo(() => {
        const tags = new Set<string>();
        transactions.forEach(tx => {
            if (tx.tags) {
                tx.tags.split(',').forEach(t => tags.add(t.trim()));
            }
        });
        return Array.from(tags).sort();
    }, [transactions]);

    const handleLoginSubmit = async () => {
        if (!emailInput || !passwordInput) {
            showAlert("Missing Credentials", "Please enter both email and password.");
            return;
        }
        setLoading(true);
        try {
            // Verify credentials by trying to login
            const t = await buxferService.login(emailInput, passwordInput);

            // Save if successful
            setBuxferEmail(emailInput);
            setBuxferPassword(passwordInput);
            setToken(t);

            // Load data
            const [accs, txs, bdgts] = await Promise.all([
                buxferService.getAccounts(t),
                buxferService.getTransactions(t),
                buxferService.getBudgets(t)
            ]);
            setAccounts(accs);
            setTransactions(txs);
            setBudgets(bdgts);
        } catch (e: any) {
            showError("Login Error", "Login failed: " + (e.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        showAlert("Logout", "Are you sure you want to remove your Buxfer credentials?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: () => {
                    setBuxferEmail(null);
                    setBuxferPassword(null);
                    setToken(null);
                    setAccounts([]);
                    setTransactions([]);
                    setBudgets([]);
                    setEmailInput('');
                    setPasswordInput('');
                    setShowSettings(false);
                }
            }
        ]);
    };

    const formatCurrency = (amount: number, currency: string = 'CZK') => {
        // Fallback to CZK if undefined, per user request "at least main is czk"
        return new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: currency || 'CZK',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    const renderLoginForm = () => (
        <View className="flex-1 justify-center px-6 pt-20">
            <View className="bg-surface p-6 rounded-2xl border border-border">
                <View className="items-center mb-6">
                    <View className="w-16 h-16 bg-primary/20 rounded-full items-center justify-center mb-4">
                        <Ionicons name="cash-outline" size={32} color={Colors.primary} />
                    </View>
                    <Text className="text-white text-xl font-bold">Connect Buxfer</Text>
                    <Text className="text-text-secondary text-center mt-2">
                        Enter your Buxfer credentials to sync your financial data.
                    </Text>
                </View>

                <View className="gap-4">
                    <View>
                        <Text className="text-text-secondary text-xs font-bold mb-1 ml-1 uppercase">Email</Text>
                        <TextInput
                            className="bg-background text-white p-4 rounded-xl border border-border"
                            placeholder="email@example.com"
                            placeholderTextColor={Colors.text.tertiary}
                            value={emailInput}
                            onChangeText={setEmailInput}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View>
                        <Text className="text-text-secondary text-xs font-bold mb-1 ml-1 uppercase">Password</Text>
                        <View className="flex-row items-center">
                            <TextInput
                                className="flex-1 bg-background text-white p-4 rounded-xl border border-border"
                                placeholder="Password"
                                placeholderTextColor={Colors.text.tertiary}
                                value={passwordInput}
                                onChangeText={setPasswordInput}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                className="absolute right-4"
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        className={`mt-4 p-4 rounded-xl items-center ${loading ? 'bg-primary/50' : 'bg-primary'}`}
                        onPress={handleLoginSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-base">Connect</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderOverview = () => (
        <ScrollView
            contentContainerStyle={{ paddingTop: 140, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
            refreshControl={
                <RefreshControl
                    refreshing={loading}
                    onRefresh={() => loadData(true)}
                    tintColor={Colors.primary}
                    colors={[Colors.primary]}
                    progressViewOffset={140}
                />
            }
        >
            {/* Total Balance Card */}
            <View className="bg-surface p-6 rounded-2xl border border-border mb-6 items-center">
                <Text className="text-text-secondary font-medium mb-2">Total Net Worth</Text>
                <Text
                    className="text-4xl font-bold"
                    style={{ color: totalBalance >= 0 ? Colors.status.healthy : Colors.error }}
                >
                    {formatCurrency(totalBalance)}
                </Text>
            </View>

            {/* Spending Chart */}
            <SpendingChart transactions={transactions} />

            {/* Accounts Section */}
            <View className="mb-6">
                <Text className="text-white font-bold text-lg mb-4">Accounts</Text>
                {accounts.length === 0 ? (
                    <Text className="text-text-tertiary italic">No accounts found.</Text>
                ) : (
                    accounts.map(acc => (
                        <View key={acc.id} className="bg-surface p-4 rounded-xl border border-border mb-3 flex-row justify-between items-center">
                            <View>
                                <Text className="text-white font-medium mb-1">{acc.name}</Text>
                                <MetadataChip label={acc.bank} size="sm" variant="outline" color={Colors.text.tertiary} />
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
                const txTags = tx.tags.split(',').map(t => t.trim());
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

        return (
            <FlatList
                data={filteredTransactions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingTop: 140, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={() => loadData(true)}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                        progressViewOffset={140}
                    />
                }
                ListHeaderComponent={
                    <View className="mb-4">
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
                    </View>
                }
                ListEmptyComponent={
                    <Text className="text-text-tertiary italic text-center mt-10">
                        {searchQuery || selectedTag ? "No transactions found matching your filters." : "No recent transactions."}
                    </Text>
                }
                renderItem={({ item: tx }) => (
                    <View className="bg-surface p-4 rounded-xl border border-border mb-3">
                        <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-white font-medium flex-1 mr-2" numberOfLines={2}>{tx.description}</Text>
                            <Text
                                className="font-bold"
                                style={{ color: tx.type === 'income' ? Colors.status.healthy : Colors.error }}
                            >
                                {tx.type === 'expense' ? '-' : '+'}{formatCurrency(Math.abs(tx.amount), tx.currency)}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center flex-wrap gap-y-2">
                            <View className="flex-row items-center gap-2 flex-wrap flex-1 mr-2">
                                <Text className="text-text-secondary text-xs mr-1">{dayjs(tx.date).format('MMM D')}</Text>
                                {tx.tags && tx.tags.split(',').map(tag => {
                                    const trimmedTag = tag.trim();
                                    const config = tagConfig[trimmedTag];
                                    return (
                                        <MetadataChip
                                            key={trimmedTag}
                                            label={trimmedTag}
                                            size="sm"
                                            style={{ marginRight: 2 }}
                                            icon={config?.icon}
                                            color={config?.color}
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
                    </View>
                )}
            />
        );
    };

    const renderBudgets = () => (
        <ScrollView
            contentContainerStyle={{ paddingTop: 140, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
            refreshControl={
                <RefreshControl
                    refreshing={loading}
                    onRefresh={() => loadData(true)}
                    tintColor={Colors.primary}
                    colors={[Colors.primary]}
                    progressViewOffset={140}
                />
            }
        >
            <View className="mb-6">
                <Text className="text-white font-bold text-lg mb-4">Your Budgets</Text>
                {budgets.length === 0 ? (
                    <Text className="text-text-tertiary italic">No budgets found.</Text>
                ) : (
                    budgets.map(budget => {
                        const limit = Number(budget.limit) || 0;
                        const remaining = Number(budget.remaining) || 0;
                        const spent = limit - remaining;
                        const percent = limit > 0 ? ((limit - remaining) / limit) * 100 : 0;
                        const isOver = remaining < 0;

                        return (
                            <View key={budget.id} className="bg-surface p-4 rounded-xl border border-border mb-3">
                                <View className="flex-row justify-between items-start mb-2">
                                    <View>
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

                                {budget.period && (
                                    <View className="flex-row items-center mt-1">
                                         <MetadataChip label={budget.period} size="sm" variant="outline" color={Colors.text.tertiary} />
                                    </View>
                                )}
                            </View>
                        );
                    })
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
        <Layout>
            <View style={{ position: 'absolute', top: insets.top + 4, left: 16, right: 16, zIndex: 10 }}>
                <IslandHeader
                    title="Money"
                    rightActions={[
                        ...(token ? [
                            {
                                icon: 'settings-outline',
                                onPress: () => setShowSettings(true),
                            }
                        ] : [])
                    ]}
                    tabs={token ? tabs : undefined}
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                >
                    {/* Tag Filter Panel - Only for Transactions tab */}
                    {activeTab === 'transactions' && token && uniqueTags.length > 0 && (
                         <View style={[islandBaseStyle, { marginTop: 8, paddingLeft: 4, position: 'relative', marginLeft: 4, marginRight: 4 }]}>
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
                                {uniqueTags.map(tag => {
                                    const config = tagConfig[tag];
                                    return (
                                        <MetadataChip
                                            key={tag}
                                            label={tag}
                                            variant={selectedTag === tag ? "solid" : "outline"}
                                            color={config?.color || Colors.primary}
                                            icon={config?.icon}
                                            onPress={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                        />
                                    );
                                })}
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
                </IslandHeader>
            </View>

            {!buxferEmail || !buxferPassword ? renderLoginForm() : (
                <>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'transactions' && renderTransactions()}
                    {activeTab === 'budgets' && renderBudgets()}
                </>
            )}

            <MoneySettingsModal
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                onLogout={handleLogout}
                email={buxferEmail}
            />
        </Layout>
    );
}
