package com.aiinbox.mobile.apkinstaller;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.Handler;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.util.HashSet;
import java.util.Set;

public class BuildWatcherService extends Service {
    public static final String CHANNEL_ID = "watcher_progress_native_service";
    public static final String CHANNEL_NAME = "Build Watcher Service";
    public static final String HEARTBEAT_ACTION = "com.aiinbox.mobile.apkinstaller.HEARTBEAT";

    // Heartbeat
    private Handler heartbeatHandler = new Handler();
    private Runnable heartbeatRunnable = new Runnable() {
        @Override
        public void run() {
            Intent intent = new Intent(HEARTBEAT_ACTION);
            intent.setPackage(getPackageName());
            sendBroadcast(intent);
            heartbeatHandler.postDelayed(this, 30000); // 30 seconds
        }
    };
    
    // Track active notification IDs
    private Set<Integer> activeNotificationIds = new HashSet<>();
    private int currentForegroundId = -1;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BuildWatcherService::Lock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }
        } catch (Exception e) {
            // Log failure but don't crash the service
            System.err.println("BuildWatcherService: Failed to acquire WakeLock: " + e.getMessage());
        }

        createNotificationChannel();
        startHeartbeat();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        stopHeartbeat();
    }

    private void startHeartbeat() {
        stopHeartbeat(); // ensure no duplicates
        heartbeatHandler.post(heartbeatRunnable);
    }

    private void stopHeartbeat() {
        heartbeatHandler.removeCallbacks(heartbeatRunnable);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            String smallText = intent.getStringExtra("smallText");
            String chipText = intent.getStringExtra("chipText");
            int progress = intent.getIntExtra("progress", -1);
            int id = intent.getIntExtra("id", -1);
            String action = intent.getAction();

            if (id == -1) return START_NOT_STICKY;

            if ("STOP".equals(action)) {
                handleStop(id);
            } else {
                if (title != null) {
                    handleUpdate(id, title, body, smallText, chipText, progress);
                }
            }
        }
        return START_NOT_STICKY;
    }

    private void handleUpdate(int id, String title, String body, String smallText, String chipText, int progress) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        Notification notification = buildNotification(title, body, smallText, chipText, progress);
        
        activeNotificationIds.add(id);

        // If we don't have a foreground ID, or this is the first one, make it foreground
        if (currentForegroundId == -1) {
            currentForegroundId = id;
            startForeground(id, notification);
        } else if (currentForegroundId == id) {
            // Update the existing foreground notification
            startForeground(id, notification);
        } else {
            // It's another notification, just notify manager
            notificationManager.notify(id, notification);
        }
    }

    private void handleStop(int id) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        
        // Remove from active set
        activeNotificationIds.remove(id);
        
        // Cancel this specific notification
        notificationManager.cancel(id);

        if (currentForegroundId == id) {
            // We are stopping the foreground notification
            if (activeNotificationIds.isEmpty()) {
                // No more active notifications, stop service
                stopForeground(true);
                stopSelf();
                currentForegroundId = -1;
            } else {
                // There are others. We can't promote them yet as we don't have their content.
                // Service becomes background but stays alive briefly.
                // This is acceptable risk for the short time between updates.
                stopForeground(true);
                currentForegroundId = -1;
            }
        }
    }

    private Notification buildNotification(String title, String body, String smallText, String chipText, int progress) {
        int iconId = getApplicationContext().getResources().getIdentifier("ic_launcher", "mipmap", getPackageName());
        if (iconId == 0) {
             iconId = getApplicationInfo().icon;
        }

        // Use platform Notification.Builder for API 35+ to access new features (Live Updates)
        if (Build.VERSION.SDK_INT >= 35) {
             Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                     .setSmallIcon(iconId)
                     .setContentTitle(title)
                     .setContentText(smallText != null ? smallText : body) // Collapsed text
                     .setStyle(new Notification.BigTextStyle().bigText(body)) // Expanded text
                     .setOngoing(true)
                     .setOnlyAlertOnce(true)
                     .setCategory(Notification.CATEGORY_PROGRESS)
                     .setVisibility(Notification.VISIBILITY_PUBLIC)
                     .setShowWhen(false)
                     .setAutoCancel(false);

             try {
                 if (chipText != null && !chipText.isEmpty()) {
                     builder.getClass().getMethod("setShortCriticalText", CharSequence.class).invoke(builder, chipText);
                 }
                 builder.getClass().getMethod("setRequestPromotedOngoing", boolean.class).invoke(builder, true);
             } catch (Exception e) {
                 // Ignore reflection errors
             }

             if (progress >= 0) {
                 builder.setProgress(100, progress, false);
                 if (smallText != null) {
                     builder.setSubText(smallText);
                 }
             }
             return builder.build();
        }

        // Fallback for older versions
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(iconId)
                .setContentTitle(title)
                .setContentText(smallText != null ? smallText : body) // Collapsed text
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body)) // Expanded text
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setAutoCancel(false);

        if (progress >= 0) {
            builder.setProgress(100, progress, false);
            // Progress bar hides contentText, so use subText to keep it visible
            if (smallText != null) {
                builder.setSubText(smallText);
            }
        }
        
        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            // Ensure channel exists with LOW importance for silent updates
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Background service for watching builds");
            notificationManager.createNotificationChannel(channel);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
