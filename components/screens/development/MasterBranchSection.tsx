import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dashboardRunToWorkflowRun, DashboardRun } from '../../../services/dashboardService';
import { Colors } from '../../ui/design-tokens';
import { MetadataChip } from '../../ui/MetadataChip';
import { Card } from '../../ui/Card';
import { WorkflowRunItem } from './WorkflowRunItem';

interface MasterBranchSectionProps {
    runs: DashboardRun[];
    token: string;
    owner: string;
    repo: string;
    refreshTrigger?: number;
}

export function MasterBranchSection({ runs, token, owner, repo, refreshTrigger }: MasterBranchSectionProps) {
    const [expanded, setExpanded] = useState(false);

    if (!runs || runs.length === 0) return null;

    const runningCount = runs.filter(r => r.status === 'in_progress' || r.status === 'queued').length;
    const workflowRuns = runs.map(dashboardRunToWorkflowRun);

    return (
        <Card className="mb-2" padding="p-0">
            <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                className="flex-row items-center justify-between p-3"
            >
                <View className="flex-row items-center">
                    <Ionicons name="git-branch" size={20} color={Colors.text.tertiary} />
                    <Text className="text-white font-bold text-base ml-2">Master Branch</Text>
                    {runningCount > 0 && (
                        <View className="ml-2">
                            <MetadataChip
                                label={`${runningCount} RUNNING`}
                                variant="outline"
                                color={Colors.primary}
                                size="sm"
                                rounding="sm"
                            />
                        </View>
                    )}
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>

            {expanded && (
                <View className="px-3 pb-3">
                    {runs.map((dashRun, i) => (
                        <WorkflowRunItem
                            key={dashRun.runId}
                            run={workflowRuns[i]}
                            token={token}
                            owner={owner}
                            repo={repo}
                            artifactUrl={dashRun.artifactUrl}
                            refreshTrigger={refreshTrigger}
                            embedded={true}
                            compact={true}
                        />
                    ))}
                </View>
            )}
        </Card>
    );
}
