import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widget-task-handler';
import { AppRegistry } from 'react-native';
import { watcherService } from './services/watcherService';

const WatcherHeadlessTask = async () => {
    try {
        await watcherService.checkRuns();
    } catch (e) {
        console.error('[WatcherHeadlessTask] Error:', e);
    }
};

AppRegistry.registerHeadlessTask('WatcherHeadlessTask', () => WatcherHeadlessTask);

registerWidgetTaskHandler(widgetTaskHandler);
import "expo-router/entry";
