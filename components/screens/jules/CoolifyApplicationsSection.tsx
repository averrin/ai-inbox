import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CoolifyApplication, CoolifyApplicationsData, isAppRunning, coolifyAppsService } from '../../../services/coolifyService';
import { Colors } from '../../ui/design-tokens';
import { Card } from '../../ui/Card';
import { MetadataChip } from '../../ui/MetadataChip';
import { showError } from '../../../utils/alert';

interface AppItemProps {
    app: CoolifyApplication;
}

function CoolifyAppItem({ app }: AppItemProps) {
    const [busy, setBusy] = useState<'start' | 'stop' | 'restart' | null>(null);
    const running = isAppRunning(app.status);

    const getStatusInfo = () => {
        if (running) return { color: '#4ade80', icon: 'radio-button-on' as const };
        if (app.status === 'exited' || app.status === 'stopped') return { color: '#f87171', icon: 'radio-button-off' as const };
        if (app.status === 'starting' || app.status === 'restarting') return { color: '#60a5fa', icon: 'sync' as const };
        return { color: Colors.text.tertiary, icon: 'help-circle-outline' as const };
    };

    const { color, icon } = getStatusInfo();

    const handleControl = async (action: 'start' | 'stop' | 'restart') => {
        setBusy(action);
        try {
            await coolifyAppsService.sendCommand(action, app.uuid);
        } catch (e: any) {
            showError('Coolify Error', e.message || 'Command failed');
        } finally {
            setBusy(null);
        }
    };

    const openUrl = () => {
        if (app.fqdn) {
            const url = app.fqdn.startsWith('http') ? app.fqdn : `https://${app.fqdn}`;
            Linking.openURL(url);
        }
    };

    const openLogsUrl = () => {
        if (app.projectUuid && app.environmentUuid) {
            const url = `https://coolify.averr.in/project/${app.projectUuid}/environment/${app.environmentUuid}/application/${app.uuid}/logs`;
            Linking.openURL(url);
        }
    };

    return (
        <View className="mt-3 pt-3 border-t border-border/60">
            <View className="flex-row items-center justify-between">
                <TouchableOpacity
                    onPress={openUrl}
                    disabled={!app.fqdn}
                    className="flex-row items-center flex-1 mr-2"
                >
                    <Ionicons name={icon} size={16} color={color} />
                    <View className="ml-2 flex-1">
                        <Text className="text-white font-bold text-sm" numberOfLines={1}>{app.name}</Text>
                        {app.fqdn ? (
                            <Text className="text-text-tertiary text-[10px]" numberOfLines={1}>{app.fqdn}</Text>
                        ) : app.gitBranch ? (
                            <Text className="text-text-tertiary text-[10px]">{app.gitBranch}</Text>
                        ) : null}
                    </View>
                </TouchableOpacity>

                <View className="flex-row items-center gap-1">
                    {app.projectUuid && app.environmentUuid && (
                        <ControlButton
                            icon="document-text"
                            color={Colors.text.tertiary}
                            loading={false}
                            disabled={false}
                            onPress={openLogsUrl}
                        />
                    )}
                    {running ? (
                        <>
                            <ControlButton
                                icon="refresh"
                                color="#60a5fa"
                                loading={busy === 'restart'}
                                disabled={!!busy}
                                onPress={() => handleControl('restart')}
                            />
                            <ControlButton
                                icon="stop"
                                color="#f87171"
                                loading={busy === 'stop'}
                                disabled={!!busy}
                                onPress={() => handleControl('stop')}
                            />
                        </>
                    ) : (
                        <ControlButton
                            icon="play"
                            color="#4ade80"
                            loading={busy === 'start'}
                            disabled={!!busy}
                            onPress={() => handleControl('start')}
                        />
                    )}
                </View>
            </View>
        </View>
    );
}

interface ControlButtonProps {
    icon: string;
    color: string;
    loading: boolean;
    disabled: boolean;
    onPress: () => void;
}

function ControlButton({ icon, color, loading, disabled, onPress }: ControlButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            className="w-7 h-7 rounded-lg items-center justify-center"
            style={{ backgroundColor: `${color}22` }}
        >
            {loading ? (
                <ActivityIndicator size="small" color={color} />
            ) : (
                <Ionicons name={icon as any} size={14} color={color} />
            )}
        </TouchableOpacity>
    );
}

interface CoolifyApplicationsSectionProps {
    data: CoolifyApplicationsData;
}

export function CoolifyApplicationsSection({ data }: CoolifyApplicationsSectionProps) {
    const [expanded, setExpanded] = useState(false);

    const apps = Object.values(data.applications || {});
    if (apps.length === 0) return null;

    apps.sort((a, b) => {
        const aRun = isAppRunning(a.status) ? 1 : 0;
        const bRun = isAppRunning(b.status) ? 1 : 0;
        if (bRun !== aRun) return bRun - aRun;
        return a.name.localeCompare(b.name);
    });

    const runningCount = apps.filter(a => isAppRunning(a.status)).length;

    return (
        <Card className="mb-2" padding="p-0">
            <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                className="flex-row items-center justify-between p-3"
            >
                <View className="flex-row items-center">
                    <Ionicons name="server-outline" size={20} color={Colors.text.tertiary} />
                    <Text className="text-white font-bold text-base ml-2">Coolify Apps</Text>
                    {runningCount > 0 && (
                        <View className="ml-2">
                            <MetadataChip
                                label={`${runningCount} UP`}
                                variant="outline"
                                color="#4ade80"
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
                    {apps.map(app => (
                        <CoolifyAppItem key={app.uuid} app={app} />
                    ))}
                </View>
            )}
        </Card>
    );
}
