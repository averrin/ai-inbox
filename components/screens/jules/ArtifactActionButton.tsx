import React from 'react';
import { Artifact } from '../../../services/jules';
import { Colors } from '../../ui/design-tokens';
import { MetadataChip } from '../../ui/MetadataChip';

interface ArtifactActionButtonProps {
    artifacts: Artifact[] | null;
    loading: boolean;
    downloading: boolean;
    progress: number | null;
    status: string | null;
    cachedPath: string | null;
    onPress: () => void;
    onFetch: () => void;
    compact?: boolean;
}

export function ArtifactActionButton({
    artifacts,
    loading,
    downloading,
    progress,
    status,
    cachedPath,
    onPress,
    onFetch,
    compact = false
}: ArtifactActionButtonProps) {
    if (artifacts && artifacts.length > 0) {
        if (downloading) {
            return (
                <MetadataChip
                    label={status || `${Math.round((progress || 0) * 100)}%`}
                    loading={true}
                    progress={progress || 0}
                    variant="default"
                    size={compact ? 'sm' : 'md'}
                    disabled={true}
                />
            );
        }

        return (
            <MetadataChip
                label={cachedPath ? "Install" : "Artifact"}
                icon={cachedPath ? "construct-outline" : "download-outline"}
                variant="default"
                size={compact ? 'sm' : 'md'}
                onPress={onPress}
            />
        );
    }

    if (loading) {
        return (
             <MetadataChip
                label="Checking..."
                loading={true}
                variant="outline"
                color={Colors.text.tertiary}
                size={compact ? 'sm' : 'md'}
            />
        );
    }

    return (
        <MetadataChip
            label="No Artifact"
            icon="alert-circle-outline"
            variant="outline"
            color={Colors.text.secondary}
            size={compact ? 'sm' : 'md'}
            onPress={onFetch}
        />
    );
}
