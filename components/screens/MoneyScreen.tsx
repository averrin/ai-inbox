import { View, Text, TextInput, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../store/settings';
import { useState, useEffect, useCallback } from 'react';
import { buxferService, Account, Transaction } from '../../services/buxferService';
import { Layout } from '../ui/Layout';
import { IslandHeader } from '../ui/IslandHeader';
import { MetadataChip } from '../ui/MetadataChip';
import { Colors, Palette } from '../ui/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, showError } from '../../utils/alert';
import dayjs from 'dayjs';

export default function MoneyScreen() {
    const insets = useSafeAreaInsets();
    const { buxferEmail, buxferPassword, setBuxferEmail, setBuxferPassword } = useSettingsStore();

    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeTab, setActiveTab] = useState('overview');

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
                const [accs, txs] = await Promise.all([
                    buxferService.getAccounts(currentToken),
                    buxferService.getTransactions(currentToken)
                ]);
                setAccounts(accs);
                setTransactions(txs);
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
            const [accs, txs] = await Promise.all([
                buxferService.getAccounts(t),
                buxferService.getTransactions(t)
            ]);
            setAccounts(accs);
            setTransactions(txs);
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
                    setEmailInput('');
                    setPasswordInput('');
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

    const renderTransactions = () => (
        <FlatList
            data={transactions}
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
            ListEmptyComponent={
                <Text className="text-text-tertiary italic text-center mt-10">No recent transactions.</Text>
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
                            {tx.tags && tx.tags.split(',').map(tag => (
                                <MetadataChip
                                    key={tag}
                                    label={tag.trim()}
                                    size="sm"
                                    style={{ marginRight: 2 }}
                                />
                            ))}
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

    const tabs = [
        { key: 'overview', label: 'Overview' },
        { key: 'transactions', label: 'Transactions' }
    ];

    return (
        <Layout>
            <View style={{ position: 'absolute', top: insets.top + 4, left: 16, right: 16, zIndex: 10 }}>
                <IslandHeader
                    title="Money"
                    rightActions={[
                        ...(token ? [{
                            icon: 'log-out-outline',
                            onPress: handleLogout,
                        }, {
                            icon: 'refresh-outline',
                            onPress: () => loadData(true),
                        }] : [])
                    ]}
                    tabs={token ? tabs : undefined}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </View>

            {!buxferEmail || !buxferPassword ? renderLoginForm() : (
                activeTab === 'overview' ? renderOverview() : renderTransactions()
            )}
        </Layout>
    );
}
