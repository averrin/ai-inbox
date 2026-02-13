import { View, Text } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Ionicons } from '@expo/vector-icons';
import clsx from 'clsx';

interface ServiceAuthProps {
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    isConnected: boolean;
    connectedText: string;
    onConnect: () => void;
    onDisconnect?: () => void;
    connectButtonText: string;
    disconnectButtonText?: string;
    isConnecting?: boolean;
    isDisabled?: boolean;
    children?: React.ReactNode;
    className?: string;
}

export function ServiceAuth({
    title,
    description,
    icon,
    iconColor = "#818cf8", // Default indigo-400
    isConnected,
    connectedText,
    onConnect,
    onDisconnect,
    connectButtonText,
    disconnectButtonText = "Sign Out",
    isConnecting = false,
    isDisabled = false,
    children,
    className
}: ServiceAuthProps) {
    return (
        <Card className={className}>
            <View className="mb-4">
                <View className="flex-row items-center mb-2">
                    <Ionicons name={icon} size={24} color={iconColor} />
                    <Text className="text-indigo-200 font-semibold ml-2 text-lg">{title}</Text>
                </View>
                <Text className="text-slate-400 text-sm mb-4">
                    {description}
                </Text>

                {isConnected ? (
                    <View>
                        <View className="flex-row items-center mb-4 bg-green-900/20 border border-green-500/30 p-3 rounded-xl">
                             <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
                             <View className="ml-3 flex-1">
                                 <Text className="text-green-400 font-medium">{connectedText}</Text>
                             </View>
                        </View>
                        {onDisconnect && (
                            <Button
                                title={disconnectButtonText}
                                onPress={onDisconnect}
                                variant="secondary"
                            />
                        )}
                    </View>
                ) : (
                    <View>
                        {children}
                        <Button
                            title={connectButtonText}
                            onPress={onConnect}
                            loading={isConnecting}
                            disabled={isDisabled}
                            className="mt-2"
                        />
                    </View>
                )}
            </View>
        </Card>
    );
}
