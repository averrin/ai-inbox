import React from 'react';
import { MetadataChip } from '../../ui/MetadataChip';

interface ArtifactActionButtonProps {
    artifactUrl: string | null;
    downloading: boolean;
    progress: number | null;
    status: string | null;
    cachedPath: string | null;
    onPress: () => void;
    compact?: boolean;
}

export function ArtifactActionButton({
    artifactUrl,
    downloading,
    progress,
    status,
    cachedPath,
    onPress,
    compact = false
}: ArtifactActionButtonProps) {
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

    if (!artifactUrl) return null;

    return (
        <MetadataChip
            label={cachedPath ? 'Install' : 'Download'}
            icon={cachedPath ? 'construct-outline' : 'download-outline'}
            variant="default"
            size={compact ? 'sm' : 'md'}
            onPress={onPress}
        />
    );
}
