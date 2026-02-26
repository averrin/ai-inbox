import React, { useState } from 'react';
import { TasksSettings } from './TasksSettings';
import { TagPropertySettings } from './TagPropertySettings';
import { BaseScreen } from '../screens/BaseScreen';

export function TasksTagsMainSettings({ onBack }: { onBack?: () => void }) {
    const [activeTab, setActiveTab] = useState<'tasks' | 'tags'>('tasks');

    const tabs = [
        { key: 'tasks', label: 'Integration' },
        { key: 'tags', label: 'Tags & Props' },
    ];

    return (
        <BaseScreen
            title="Tasks & Tags"
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as 'tasks' | 'tags')}
            showBackButton={!!onBack}
            onBack={onBack}
        >
            {activeTab === 'tasks' ? (
                <TasksSettings isEmbedded={true} />
            ) : (
                <TagPropertySettings isEmbedded={true} />
            )}
        </BaseScreen>
    );
}
