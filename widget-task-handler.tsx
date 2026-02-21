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
      // 1. Get Settings
      const settingsJson = await AsyncStorage.getItem('ai-inbox-settings');
      let settings: any = {};
      if (settingsJson) {
        const parsed = JSON.parse(settingsJson);
        settings = parsed.state || {};
      }

      // 2. Get Tasks
      const tasksJson = await AsyncStorage.getItem('tasks-storage');
      let tasks: any[] = [];
      if (tasksJson) {
        const parsed = JSON.parse(tasksJson);
        if (parsed.state && parsed.state.tasks) {
          tasks = parsed.state.tasks;
        }
      }

      // 3. Upcoming Event
      let upcomingEvent = undefined;
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
                upcomingEvent = {
                    title: nextEvent.title,
                    time: dayjs(nextEvent.startDate).format('HH:mm'),
                };
            }
        } catch (e) {
            console.warn('Widget: Failed to fetch calendar events', e);
        }
      }

      // 4. Pending Task
      let pendingTask = undefined;
      if (tasks.length > 0) {
        const pending = tasks.filter((t: any) => !t.completed);
        if (pending.length > 0) {
             pendingTask = {
                 title: pending[0].title
             };
        }
      }

      // 5. GitHub Runs
      let githubRuns = undefined;
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
                githubRuns = {
                    count: activeRuns.length,
                    running: true
                };
            } else {
                 githubRuns = {
                    count: 0,
                    running: false
                };
            }
        } catch (e) {
             console.warn('Widget: Failed to fetch GitHub runs', e);
        }
      }

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
    } catch (error) {
       console.error('Widget update failed', error);
    }
  }
}
