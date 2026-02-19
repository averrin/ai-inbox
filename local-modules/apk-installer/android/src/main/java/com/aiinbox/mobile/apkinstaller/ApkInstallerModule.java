package com.aiinbox.mobile.apkinstaller;

import android.content.Intent;
import android.net.Uri;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.os.Build;
import androidx.core.app.NotificationCompat;

import java.util.Timer;
import java.util.TimerTask;
import javax.annotation.Nullable;

public class ApkInstallerModule extends ReactContextBaseJavaModule {
    private static final String CHANNEL_ID = "watcher_progress_native";
    private static final String CHANNEL_NAME = "Build Progress";
    private Timer heartbeatTimer;

    private final BroadcastReceiver heartbeatReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.aiinbox.mobile.apkinstaller.HEARTBEAT".equals(intent.getAction())) {
                sendEvent("watcher-heartbeat", null);
            }
        }
    };

    public ApkInstallerModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public void initialize() {
        super.initialize();
        IntentFilter filter = new IntentFilter("com.aiinbox.mobile.apkinstaller.HEARTBEAT");
        if (Build.VERSION.SDK_INT >= 33) {
            getReactApplicationContext().registerReceiver(heartbeatReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getReactApplicationContext().registerReceiver(heartbeatReceiver, filter);
        }
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        try {
            getReactApplicationContext().unregisterReceiver(heartbeatReceiver);
        } catch (Exception e) {
            // ignore
        }
        stopHeartbeat();
    }

    @Override
    public String getName() {
        return "ApkInstaller";
    }

    @ReactMethod
    public void updateProgress(String id, String title, String body, String smallText, int progress, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            Intent intent = new Intent(context, BuildWatcherService.class);
            // Use hash code for notification ID
            int notificationId = id.hashCode();
            intent.putExtra("id", notificationId);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            intent.putExtra("smallText", smallText);
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
    public void cancelProgress(String id, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            Intent intent = new Intent(context, BuildWatcherService.class);
            intent.setAction("STOP");
            // Use hash code for notification ID
            int notificationId = id.hashCode();
            intent.putExtra("id", notificationId);
            context.startService(intent); // Start service with STOP action to kill specific notification
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

    @ReactMethod
    public void startHeartbeat() {
        if (heartbeatTimer != null) {
            return;
        }
        heartbeatTimer = new Timer();
        heartbeatTimer.schedule(new TimerTask() {
            @Override
            public void run() {
                sendEvent("watcher-heartbeat", null);
            }
        }, 0, 30000); // 30 seconds
    }

    @ReactMethod
    public void stopHeartbeat() {
        if (heartbeatTimer != null) {
            heartbeatTimer.cancel();
            heartbeatTimer = null;
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN built-in Event Emitter Calls.
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Required for RN built-in Event Emitter Calls.
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
        try {
            if (getReactApplicationContext().hasActiveCatalystInstance()) {
                getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(eventName, params);
            }
        } catch (Exception e) {
            // Context might be invalid if app is closing
        }
    }
}
