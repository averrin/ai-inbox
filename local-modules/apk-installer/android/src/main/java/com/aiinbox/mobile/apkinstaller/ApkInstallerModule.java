package com.aiinbox.mobile.apkinstaller;

import android.content.Intent;
import android.net.Uri;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public class ApkInstallerModule extends ReactContextBaseJavaModule {
    private static final String CHANNEL_ID = "watcher_progress_native";
    private static final String CHANNEL_NAME = "Build Progress";

    public ApkInstallerModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "ApkInstaller";
    }

    @ReactMethod
    public void updateProgress(int id, String title, String body, int progress, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            Intent intent = new Intent(context, BuildWatcherService.class);
            intent.putExtra("id", id);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            intent.putExtra("progress", progress);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("NOTIFICATION_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void cancelProgress(int id, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            Intent intent = new Intent(context, BuildWatcherService.class);
            intent.setAction("STOP");
            context.startService(intent); // Start service with STOP action to kill it
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("CANCEL_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void install(String uriString, Promise promise) {
        try {
            Uri contentUri = Uri.parse(uriString);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("INSTALL_ERROR", e.getMessage());
        }
    }
}
