import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { JulesSession, WorkflowRun, fetchPullRequest, mergePullRequest, sendMessageToSession } from '../../../services/jules';
import { showAlert, showError } from '../../../utils/alert';
import { Colors } from '../../ui/design-tokens';
import { MetadataChip } from '../../ui/MetadataChip';
import { Card } from '../../ui/Card';
import { WorkflowRunItem } from './WorkflowRunItem';
import { SessionActionMenu } from './SessionActionMenu';
import { MessageDialog } from '../../ui/MessageDialog';

interface JulesSessionItemProps {
    session: JulesSession;
    matchedRun: WorkflowRun | null;
    ghToken?: string;
    defaultOwner?: string;
    defaultRepo?: string;
    onDelete?: () => void;
    onRefresh?: () => void;
    julesGoogleApiKey?: string;
    refreshTrigger?: number;
}

export function JulesSessionItem({ session, matchedRun, ghToken, defaultOwner, defaultRepo, onDelete, onRefresh, julesGoogleApiKey, refreshTrigger }: JulesSessionItemProps) {
    const [isMerging, setIsMerging] = useState(false);
    const [prInactive, setPrInactive] = useState(false);
    const [mergeable, setMergeable] = useState<boolean | null>(null);
    const [isMerged, setIsMerged] = useState(false);
    const [isClosed, setIsClosed] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [messageVisible, setMessageVisible] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);

    const spinValue = useRef(new Animated.Value(0)).current;

    const metadata = session.githubMetadata;
    const owner = metadata?.owner || defaultOwner;
    const repo = metadata?.repo || defaultRepo;
    const prNumber = metadata?.pullRequestNumber;

    // We use matchedRun if available, otherwise just basic status
    const ghRun = matchedRun;

    useEffect(() => {
        const isActive = session.state === 'IN_PROGRESS' || session.state === 'PLANNING' || session.state === 'QUEUED';
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

        return () => {
            if (animation) animation.stop();
        };
    }, [session.state]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    useEffect(() => {
        if (ghToken && owner && repo && prNumber) {
            fetchPullRequest(ghToken, owner, repo, prNumber)
                .then(pr => {
                    const merged = pr.merged || pr.state === 'merged';
                    const closed = pr.state === 'closed';
                    setIsMerged(merged);
                    setIsClosed(closed && !merged);
                    setPrInactive(merged || closed);
                    setMergeable(pr.mergeable);
                })
                .catch(err => console.error("Fetch PR detail error:", err));
        }
    }, [ghToken, owner, repo, prNumber, refreshTrigger]);

    const handleMerge = async () => {
        if (!ghToken || !owner || !repo || !prNumber) return;

        try {
            setIsMerging(true);
            await mergePullRequest(ghToken, owner, repo, prNumber);
            showAlert("Success", "Pull Request merged successfully");
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error(e);
            showError("Error", "Failed to merge Pull Request");
        } finally {
            setIsMerging(false);
        }
    };

    const handleDelete = () => {
        showAlert(
            "Delete Session",
            "Are you sure you want to delete this session? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: onDelete }
            ]
        );
    };

    const handleSendMessage = async (message: string) => {
        if (!julesGoogleApiKey) return;
        setSendingMessage(true);
        try {
            await sendMessageToSession(julesGoogleApiKey, session.name, message);
            setMessageVisible(false);
            showAlert("Success", "Message sent to session");
        } catch (e: any) {
            console.error("Failed to send message", e);
            showError("Error", e.message || "Failed to send message");
        } finally {
            setSendingMessage(false);
        }
    };

    const getStatusIcon = (state: string) => {
        switch (state) {
            case 'COMPLETED': return { icon: 'checkmark-circle', color: '#4ade80' };
            case 'FAILED': return { icon: 'close-circle', color: '#f87171' };
            case 'IN_PROGRESS':
            case 'PLANNING': return { icon: 'sync', color: '#60a5fa' };
            case 'AWAITING_PLAN_APPROVAL':
            case 'AWAITING_USER_FEEDBACK': return { icon: 'alert-circle', color: '#facc15' };
            case 'QUEUED': return { icon: 'time-outline', color: Colors.text.tertiary };
            case 'PAUSED': return { icon: 'pause-circle-outline', color: Colors.text.tertiary };
            default: return { icon: 'help-circle-outline', color: Colors.text.tertiary };
        }
    };

    const getGhStatusColor = (run: WorkflowRun) => {
        if (run.status === 'in_progress') return '#60a5fa';
        if (run.conclusion === 'success') return '#4ade80';
        if (run.conclusion === 'failure') return '#f87171';
        return Colors.text.tertiary;
    };

    const statusObj = getStatusIcon(session.state);
    const webUrl = session.url;
    const prUrl = session.outputs?.find(o => o.pullRequest)?.pullRequest?.url;

    const stripeColors: string[] = [];
    const stripeLocations: number[] = [];
    if (prInactive) {
        const step = 0.02;
        for (let i = 0; i < 200; i++) {
            const isColor = i % 2 === 1;
            const c = isColor ? 'rgba(148, 163, 184, 0.12)' : Colors.transparent;
            stripeColors.push(c, c);
            stripeLocations.push(i * step, (i + 1) * step);
        }
    }

    const menuActions = [
        {
            label: "Delete Session",
            icon: "trash-outline",
            color: "#f87171",
            onPress: handleDelete,
            disabled: !onDelete || !(session.state === 'COMPLETED' || session.state === 'FAILED' || prInactive)
        }
    ];

    return (
        <Card
            className={`mb-1 ${prInactive ? 'opacity-50' : ''}`}
            padding="p-3"
            background={prInactive ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <LinearGradient
                        colors={stripeColors as any}
                        locations={stripeLocations as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </View>
            ) : undefined}
        >
            <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center flex-1">
                    <TouchableOpacity onPress={() => Linking.openURL(ghRun?.html_url || webUrl)}>
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Ionicons name={statusObj.icon as any} size={24} color={statusObj.color} />
                        </Animated.View>
                    </TouchableOpacity>
                    <View className="ml-3 flex-1">
                        <View className="flex-row items-center">
                            <Text className="text-white font-bold text-base flex-1" numberOfLines={1}>{session.title || session.id}</Text>
                        </View>
                        <Text className="text-text-tertiary text-xs" numberOfLines={1}>
                            {dayjs(session.createTime).fromNow()} • {session.state}
                        </Text>
                    </View>
                </View>
                <View className="flex-col items-center gap-1">
                    {ghRun && (
                        <MetadataChip
                            label={ghRun.status}
                            icon={ghRun.conclusion === 'success' ? "logo-github" : "alert-circle"}
                            variant="outline"
                            color={getGhStatusColor(ghRun)}
                            size="sm"
                            rounding="sm"
                        />
                    )}
                </View>
            </View>

            <View className="flex-row gap-1">
                <TouchableOpacity
                    onPress={() => Linking.openURL(webUrl)}
                    className="flex-1 bg-surface-highlight py-2 rounded-lg flex-row items-center justify-center"
                >
                    <Ionicons name="globe-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-semibold ml-2">Web</Text>
                </TouchableOpacity>

                {prUrl && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL(prUrl)}
                        className="flex-1 bg-surface-highlight py-2 rounded-lg flex-row items-center justify-center"
                    >
                        <Ionicons name="git-pull-request-outline" size={14} color="white" />
                        <Text className="text-white text-xs font-semibold ml-2">PR #{prNumber}</Text>
                    </TouchableOpacity>
                )}

                {prNumber && (
                    <TouchableOpacity
                        onPress={(!isMerged && !isClosed && mergeable !== false) ? handleMerge : undefined}
                        disabled={isMerging || isMerged || isClosed || mergeable === false}
                        className={`flex-1 py-2 rounded-lg flex-row items-center justify-center ${isMerged ? 'bg-purple-500' :
                            isClosed ? 'bg-surface-highlight' :
                                mergeable === false ? 'bg-surface-highlight border border-error/50' :
                                    'bg-success'
                            }`}
                    >
                        {isMerging ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Ionicons
                                    name={isMerged ? "git-merge" : isClosed ? "close-circle" : mergeable === false ? "alert-circle-outline" : "git-merge-outline"}
                                    size={14}
                                    color={mergeable === false ? "#f87171" : "white"}
                                />
                                <Text className={`text-xs font-semibold ml-2 ${mergeable === false ? 'text-error' : 'text-white'}`}>
                                    {isMerged ? "Merged" : isClosed ? "Closed" : mergeable === false ? "Conflict" : "Merge"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={() => setMessageVisible(true)}
                    className="flex-1 bg-surface-highlight py-2 rounded-lg flex-row items-center justify-center"
                >
                    <Ionicons name="chatbox-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-semibold ml-2">Msg</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setMenuVisible(true)}
                    className="bg-surface-highlight py-2 px-3 rounded-lg flex-row items-center justify-center"
                >
                    <Ionicons name="ellipsis-horizontal" size={16} color="white" />
                </TouchableOpacity>
            </View>

            {ghRun && ghToken && owner && repo && (
                <WorkflowRunItem
                    run={ghRun}
                    token={ghToken}
                    owner={owner}
                    repo={repo}
                    refreshTrigger={refreshTrigger}
                    embedded={true}
                    initialExpanded={false}
                />
            )}

            <SessionActionMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                actions={menuActions}
            />

            <MessageDialog
                visible={messageVisible}
                onClose={() => setMessageVisible(false)}
                onSend={handleSendMessage}
                sending={sendingMessage}
                title="Send Message to Session"
            />
        </Card>
    );
}
