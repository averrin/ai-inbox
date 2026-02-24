import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../ui/design-tokens';

interface BuxferLoginFormProps {
    loading: boolean;
    emailInput: string;
    passwordInput: string;
    setEmailInput: (email: string) => void;
    setPasswordInput: (password: string) => void;
    showPassword: boolean;
    setShowPassword: (show: boolean) => void;
    handleLoginSubmit: () => void;
}

export function BuxferLoginForm({
    loading,
    emailInput,
    passwordInput,
    setEmailInput,
    setPasswordInput,
    showPassword,
    setShowPassword,
    handleLoginSubmit
}: BuxferLoginFormProps) {
    return (
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
}
