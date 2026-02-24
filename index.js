import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widget-task-handler';
import { AppRegistry } from 'react-native';
import { watcherService } from './services/watcherService';

// Register the background task for watcher service
const WatcherHeadlessTask = async (taskData) => {
    // console.log('WatcherHeadlessTask running');
    await watcherService.init(); // Ensure initialized (and hydrated) if fresh context
    await watcherService.checkRuns();
};
AppRegistry.registerHeadlessTask('WatcherHeadlessTask', () => WatcherHeadlessTask);

registerWidgetTaskHandler(widgetTaskHandler);
import "expo-router/entry";
