package com.aiinbox.mobile.apkinstaller;

import android.content.Intent;
import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import androidx.annotation.Nullable;

public class WatcherHeadlessTaskService extends HeadlessJsTaskService {
    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        return new HeadlessJsTaskConfig(
            "WatcherHeadlessTask",
            null,
            600000, // Timeout for the task (10 minutes)
            true // Allowed in foreground (so it runs even if app is open)
        );
    }
}
