import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import dayjs from 'dayjs';
import { JulesWidget } from './components/widget/JulesWidget';
import { fetchWorkflowRuns } from './services/jules';

const WIDGET_NAME = 'JulesWidget';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;

  if (widgetInfo.widgetName === WIDGET_NAME) {
    try {
      console.log('JulesWidget: Starting task handler');

      // 1. Get Settings & Tasks
      const [settingsJson, tasksJson] = await Promise.all([
        AsyncStorage.getItem('ai-inbox-settings'),
        AsyncStorage.getItem('tasks-storage'),
      ]);

      let settings: any = {};
      if (settingsJson) {
        const parsed = JSON.parse(settingsJson);
        settings = parsed.state || {};
      }
      console.log('JulesWidget: Settings loaded', settings ? 'Yes' : 'No');

      let tasks: any[] = [];
      if (tasksJson) {
        const parsed = JSON.parse(tasksJson);
        if (parsed.state && parsed.state.tasks) {
          tasks = parsed.state.tasks;
        }
      }
      console.log('JulesWidget: Tasks loaded', tasks.length);

      // 2. Pending Task (Sync)
      let pendingTask = undefined;
      if (tasks.length > 0) {
        const pending = tasks.filter((t: any) => !t.completed);
        if (pending.length > 0) {
             pendingTask = {
                 title: pending[0].title
             };
        }
      }

      // 3. Upcoming Event and GitHub Runs
      const [upcomingEvent, githubRuns] = await Promise.all([
        (async () => {
          if (settings.visibleCalendarIds && settings.visibleCalendarIds.length > 0) {
            try {
                const now = new Date();
                const tomorrow = new Date();
                tomorrow.setDate(now.getDate() + 1);

                const events = await Calendar.getEventsAsync(settings.visibleCalendarIds, {
                    startDate: now,
                    endDate: tomorrow,
                });

                const sortedEvents = events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
                const futureEvents = sortedEvents.filter(e => new Date(e.endDate).getTime() > now.getTime());

                if (futureEvents.length > 0) {
                    const nextEvent = futureEvents[0];
                    return {
                        title: nextEvent.title,
                        time: dayjs(nextEvent.startDate).format('HH:mm'),
                    };
                }
            } catch (e) {
                console.warn('Widget: Failed to fetch calendar events', e);
            }
          }
          return undefined;
        })(),
        (async () => {
          if (settings.julesApiKey && settings.julesOwner && settings.julesRepo) {
            try {
                const runs = await fetchWorkflowRuns(
                    settings.julesApiKey,
                    settings.julesOwner,
                    settings.julesRepo,
                    undefined,
                    10
                );

                const activeRuns = runs.filter((r: any) => r.status === 'in_progress' || r.status === 'queued');
                if (activeRuns.length > 0) {
                    return {
                        count: activeRuns.length,
                        running: true
                    };
                } else {
                     return {
                        count: 0,
                        running: false
                    };
                }
            } catch (e) {
                 console.warn('Widget: Failed to fetch GitHub runs', e);
            }
          }
          return undefined;
        })()
      ]);

      console.log('JulesWidget: Update Requesting');
      requestWidgetUpdate({
        androidWidgetId: widgetInfo.widgetId,
        renderWidget: () => (
          <JulesWidget
            upcomingEvent={upcomingEvent}
            pendingTask={pendingTask}
            githubRuns={githubRuns}
          />
        ),
        widgetName: widgetInfo.widgetName,
      });
      console.log('JulesWidget: Update Requested');
    } catch (error: any) {
       console.error('Widget update failed', error);
       // Ensure something is visible even on error
       requestWidgetUpdate({
        androidWidgetId: widgetInfo.widgetId,
        renderWidget: () => (
            <JulesWidget error={error.message || 'Unknown error'} />
        ),
        widgetName: widgetInfo.widgetName,
      });
    }
  }
}
