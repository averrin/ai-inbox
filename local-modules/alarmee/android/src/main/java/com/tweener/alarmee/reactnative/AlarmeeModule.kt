package com.tweener.alarmee.reactnative

import android.app.NotificationManager
import android.content.Context
import android.graphics.Color
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.tweener.alarmee.AlarmeeService
import com.tweener.alarmee.createAlarmeeService
import com.tweener.alarmee.AlarmeeAndroidPlatformConfiguration
import com.tweener.alarmee.AlarmeeNotificationChannel
import com.tweener.alarmee.Alarmee
import com.tweener.alarmee.AndroidNotificationConfiguration
import com.tweener.alarmee.AndroidNotificationPriority
import com.tweener.alarmee.IosNotificationConfiguration
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.time.ExperimentalTime

class AlarmeeModule : Module() {
  private lateinit var alarmeeService: AlarmeeService

  @OptIn(ExperimentalTime::class)
  override fun definition() = ModuleDefinition {
    Name("AlarmeeModule")

    OnCreate {
      val context = appContext.reactContext ?: throw Exception("Context not found")

      // Get the default app icon
      val iconResId = context.applicationInfo.icon

      // Define configuration
      val config = AlarmeeAndroidPlatformConfiguration(
          notificationIconResId = iconResId,
          useExactScheduling = true,
          notificationChannels = listOf(
              AlarmeeNotificationChannel(
                  id = "reminders-alarm",
                  name = "Reminders (Alarm)",
                  importance = NotificationManager.IMPORTANCE_HIGH
                  // soundFilename not specified, defaults?
              )
          )
      )

      alarmeeService = createAlarmeeService()
      alarmeeService.initialize(platformConfiguration = config)
    }

    Function("scheduleAlarm") { title: String, message: String, timestamp: Double, id: String ->
      try {
          val instant = Instant.fromEpochMilliseconds(timestamp.toLong())
          val dateTime = instant.toLocalDateTime(TimeZone.currentSystemDefault())

          val alarmee = Alarmee(
              uuid = id,
              notificationTitle = title,
              notificationBody = message,
              scheduledDateTime = dateTime,
              androidNotificationConfiguration = AndroidNotificationConfiguration(
                  priority = AndroidNotificationPriority.HIGH,
                  channelId = "reminders-alarm"
              ),
              iosNotificationConfiguration = IosNotificationConfiguration()
          )

          alarmeeService.local.schedule(alarmee)
          return@Function true
      } catch (e: Exception) {
          e.printStackTrace()
          return@Function false
      }
    }

    Function("cancelAlarm") { id: String ->
      try {
          alarmeeService.local.cancel(uuid = id)
          return@Function true
      } catch (e: Exception) {
          e.printStackTrace()
          return@Function false
      }
    }

    Function("cancelAllAlarms") {
      try {
          alarmeeService.local.cancelAll()
          return@Function true
      } catch (e: Exception) {
          e.printStackTrace()
          return@Function false
      }
    }
  }
}
