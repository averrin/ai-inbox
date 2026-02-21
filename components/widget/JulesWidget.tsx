import React from 'react';
import { FlexWidget, TextWidget, IconWidget } from 'react-native-android-widget';

export interface JulesWidgetProps {
  upcomingEvent?: { title: string; time: string };
  pendingTask?: { title: string };
  githubRuns?: { count: number; running: boolean };
  error?: string;
}

export function JulesWidget({ upcomingEvent, pendingTask, githubRuns, error }: JulesWidgetProps) {
  if (error) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: '#00000080',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget text={`Error: ${error}`} style={{ color: '#ff4444', fontSize: 14 }} />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#00000040', // Semi-transparent black for visibility
        flexDirection: 'column',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
      }}
      clickAction="OPEN_APP"
    >
      {/* Upcoming Event */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <IconWidget icon="event" size={24} style={{ color: '#ffffff', marginRight: 16 }} />
        <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
           <TextWidget
            text={upcomingEvent ? upcomingEvent.time : "Today"}
            style={{ color: '#ffffff', fontSize: 12, opacity: 0.8 }}
          />
          <TextWidget
            text={upcomingEvent ? upcomingEvent.title : "No upcoming events"}
            style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Pending Task */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <IconWidget icon="check_box_outline_blank" size={24} style={{ color: '#ffffff', marginRight: 16 }} />
        <TextWidget
          text={pendingTask ? pendingTask.title : "No pending tasks"}
          style={{ color: '#ffffff', fontSize: 16, flex: 1 }}
          maxLines={1}
        />
      </FlexWidget>

      {/* GitHub Runs */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconWidget icon="sync" size={24} style={{ color: '#ffffff', marginRight: 16 }} />
        <TextWidget
          text={githubRuns && githubRuns.running ? `${githubRuns.count} Workflow${githubRuns.count > 1 ? 's' : ''} Running` : "All Systems Go"}
          style={{ color: '#ffffff', fontSize: 16, flex: 1 }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
