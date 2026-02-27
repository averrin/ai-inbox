import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { CoolifyDeployment, CoolifyDeploymentsData, isActiveDeployment } from '../../../services/coolifyService';
import { Colors } from '../../ui/design-tokens';
import { Card } from '../../ui/Card';
import { MetadataChip } from '../../ui/MetadataChip';

interface CoolifyDeploymentItemProps {
    deployment: CoolifyDeployment;
}

function CoolifyDeploymentItem({ deployment }: CoolifyDeploymentItemProps) {
    const isActive = isActiveDeployment(deployment.status);
    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let animation: Animated.CompositeAnimation | null = null;
        if (isActive) {
            animation = Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            );
            animation.start();
        } else {
            spinValue.setValue(0);
        }
        return () => { if (animation) animation.stop(); };
    }, [isActive]);

    const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    const getStatusInfo = () => {
        switch (deployment.status) {
            case 'running':
            case 'in_progress': return { color: '#60a5fa', icon: 'sync' as const };
            case 'queued': return { color: Colors.text.tertiary, icon: 'time-outline' as const };
            case 'finished': return { color: '#4ade80', icon: 'checkmark-circle' as const };
            case 'error': return { color: '#f87171', icon: 'close-circle' as const };
            case 'cancelled': return { color: '#fb923c', icon: 'stop-circle-outline' as const };
            default: return { color: Colors.text.tertiary, icon: 'help-circle-outline' as const };
        }
    };

    const { color, icon } = getStatusInfo();
    const appName = deployment.applicationName || 'Unknown App';
    const serverName = deployment.serverName || '';
    const commitMsg = deployment.commitMessage || '';
    const createdAt = deployment.createdAt ? dayjs(deployment.createdAt).fromNow() : '';

    const handlePress = () => {
        if (deployment.deploymentUrl) {
            Linking.openURL(deployment.deploymentUrl);
        }
    };

    return (
        <View className="mt-3 pt-3 border-t border-border/60">
            <View className="flex-row items-center justify-between mb-1">
                <TouchableOpacity
                    onPress={handlePress}
                    disabled={!deployment.deploymentUrl}
                    className="flex-row items-center flex-1"
                >
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Ionicons name={icon} size={20} color={color} />
                    </Animated.View>
                    <View className="ml-3 flex-1">
                        <Text className="text-white font-bold text-sm flex-1" numberOfLines={1}>{appName}</Text>
                        <Text className="text-secondary text-[10px]">
                            {createdAt}{serverName ? ` • ${serverName}` : ''}
                        </Text>
                        {commitMsg ? (
                            <Text className="text-text-tertiary text-[10px] font-mono mt-0.5" numberOfLines={1}>{commitMsg}</Text>
                        ) : null}
                    </View>
                </TouchableOpacity>

                <View className="ml-2">
                    <MetadataChip
                        label={deployment.status.toUpperCase()}
                        variant="outline"
                        color={color}
                        size="sm"
                        rounding="sm"
                    />
                </View>
            </View>
        </View>
    );
}

interface CoolifyDeploymentsSectionProps {
    data: CoolifyDeploymentsData;
}

export function CoolifyDeploymentsSection({ data }: CoolifyDeploymentsSectionProps) {
    const [expanded, setExpanded] = useState(false);

    const deployments = Object.values(data.deployments || {});
    if (deployments.length === 0) return null;

    // Sort: active first, then by createdAt desc
    deployments.sort((a, b) => {
        const aActive = isActiveDeployment(a.status) ? 1 : 0;
        const bActive = isActiveDeployment(b.status) ? 1 : 0;
        if (bActive !== aActive) return bActive - aActive;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    const activeCount = deployments.filter(d => isActiveDeployment(d.status)).length;

    return (
        <Card className="mb-2" padding="p-0">
            <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                className="flex-row items-center justify-between p-3"
            >
                <View className="flex-row items-center">
                    <Ionicons name="rocket-outline" size={20} color={Colors.text.tertiary} />
                    <Text className="text-white font-bold text-base ml-2">Coolify Deploys</Text>
                    {activeCount > 0 && (
                        <View className="ml-2">
                            <MetadataChip
                                label={`${activeCount} RUNNING`}
                                variant="outline"
                                color={Colors.primary}
                                size="sm"
                                rounding="sm"
                            />
                        </View>
                    )}
                </View>
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.text.tertiary}
                />
            </TouchableOpacity>

            {expanded && (
                <View className="px-3 pb-3">
                    {deployments.map(d => (
                        <CoolifyDeploymentItem key={d.deploymentUuid} deployment={d} />
                    ))}
                </View>
            )}
        </Card>
    );
}
