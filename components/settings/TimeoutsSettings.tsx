import { View, Text } from 'react-native';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { useSettingsStore } from '../../store/settings';

export function TimeoutsSettings() {
    const {
        syncDebounceTime, setSyncDebounceTime,
        firestoreWriteTimeout, setFirestoreWriteTimeout,
        firestorePullTimeout, setFirestorePullTimeout,
        watcherCheckInterval, setWatcherCheckInterval,
        watcherMinInterval, setWatcherMinInterval,
        watcherEstDuration, setWatcherEstDuration,
        oauthRedirectDelay, setOauthRedirectDelay,
        remoteApplyLockTimeout, setRemoteApplyLockTimeout
    } = useSettingsStore();

    const updateNumber = (text: string, setter: (val: number) => void) => {
        const num = parseInt(text, 10);
        if (!isNaN(num)) {
            setter(num);
        } else if (text === '') {
             setter(0);
        }
    };

    return (
        <Card>
            <View className="mb-4">
                <Text className="text-text-secondary mb-2 font-semibold">Timeouts & Intervals (Advanced)</Text>

                <Input
                    label="Sync Debounce (ms)"
                    value={syncDebounceTime.toString()}
                    onChangeText={(t) => updateNumber(t, setSyncDebounceTime)}
                    keyboardType="numeric"
                    placeholder="2000"
                />

                <Input
                    label="Firestore Write Timeout (ms)"
                    value={firestoreWriteTimeout.toString()}
                    onChangeText={(t) => updateNumber(t, setFirestoreWriteTimeout)}
                    keyboardType="numeric"
                    placeholder="10000"
                />

                <Input
                    label="Firestore Pull Timeout (ms)"
                    value={firestorePullTimeout.toString()}
                    onChangeText={(t) => updateNumber(t, setFirestorePullTimeout)}
                    keyboardType="numeric"
                    placeholder="10000"
                />

                <Input
                    label="Watcher Check Interval (ms)"
                    value={watcherCheckInterval.toString()}
                    onChangeText={(t) => updateNumber(t, setWatcherCheckInterval)}
                    keyboardType="numeric"
                    placeholder="30000"
                />

                <Input
                    label="Watcher Min Interval (sec)"
                    value={watcherMinInterval.toString()}
                    onChangeText={(t) => updateNumber(t, setWatcherMinInterval)}
                    keyboardType="numeric"
                    placeholder="900"
                />

                <Input
                    label="Watcher Est Duration (ms)"
                    value={watcherEstDuration.toString()}
                    onChangeText={(t) => updateNumber(t, setWatcherEstDuration)}
                    keyboardType="numeric"
                    placeholder="300000"
                />

                <Input
                    label="OAuth Redirect Delay (ms)"
                    value={oauthRedirectDelay.toString()}
                    onChangeText={(t) => updateNumber(t, setOauthRedirectDelay)}
                    keyboardType="numeric"
                    placeholder="2000"
                />

                <Input
                    label="Remote Apply Lock Timeout (ms)"
                    value={remoteApplyLockTimeout.toString()}
                    onChangeText={(t) => updateNumber(t, setRemoteApplyLockTimeout)}
                    keyboardType="numeric"
                    placeholder="50"
                />
            </View>
        </Card>
    );
}
