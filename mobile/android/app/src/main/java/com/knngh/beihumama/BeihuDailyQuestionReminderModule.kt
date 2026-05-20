package com.knngh.beihumama

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

private const val DAILY_QUESTION_CHANNEL_ID = "beihu_daily_question"
private const val DAILY_QUESTION_CHANNEL_NAME = "每日 AI 小问题"
private const val EXTRA_TITLE = "beihu_daily_question_title"
private const val EXTRA_BODY = "beihu_daily_question_body"
private const val EXTRA_QUESTION = "beihu_daily_question"
private const val EXTRA_REQUEST_ID = "beihu_daily_question_request_id"

class BeihuDailyQuestionReminderModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "BeihuDailyQuestionReminder"

  @ReactMethod
  fun scheduleDailyQuestionReminders(items: ReadableArray, promise: Promise) {
    val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    ensureNotificationChannel(reactContext)

    for (index in 0 until items.size()) {
      val item = items.getMap(index)
      val requestId = item.getString("requestId") ?: continue
      val title = item.getString("title") ?: continue
      val body = item.getString("body") ?: continue
      val question = item.getString("question") ?: continue
      val timestampMs = item.getDouble("timestampMs").toLong()
      if (timestampMs <= System.currentTimeMillis()) {
        continue
      }

      val intent = Intent(reactContext, BeihuDailyQuestionReminderReceiver::class.java).apply {
        putExtra(EXTRA_REQUEST_ID, requestId)
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_BODY, body)
        putExtra(EXTRA_QUESTION, question)
      }
      val pendingIntent = PendingIntent.getBroadcast(
        reactContext,
        requestCodeFor(requestId),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestampMs, pendingIntent)
      } else {
        alarmManager.set(AlarmManager.RTC_WAKEUP, timestampMs, pendingIntent)
      }
    }

    promise.resolve(items.size())
  }

  @ReactMethod
  fun consumePendingDailyQuestion(promise: Promise) {
    val intent = currentActivity?.intent
    val question = intent?.getStringExtra(EXTRA_QUESTION)
    intent?.removeExtra(EXTRA_QUESTION)
    promise.resolve(question)
  }
}

class BeihuDailyQuestionReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    ensureNotificationChannel(context)

    val title = intent.getStringExtra(EXTRA_TITLE) ?: "今天可以问 AI 的一件小事"
    val body = intent.getStringExtra(EXTRA_BODY) ?: return
    val question = intent.getStringExtra(EXTRA_QUESTION) ?: body
    val requestId = intent.getStringExtra(EXTRA_REQUEST_ID) ?: question
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra(EXTRA_QUESTION, question)
    } ?: return
    val contentIntent = PendingIntent.getActivity(
      context,
      requestCodeFor(requestId),
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, DAILY_QUESTION_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setContentIntent(contentIntent)
      .setAutoCancel(true)
      .build()

    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.notify(requestCodeFor(requestId), notification)
  }
}

private fun ensureNotificationChannel(context: Context) {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
    return
  }

  val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  val channel = NotificationChannel(
    DAILY_QUESTION_CHANNEL_ID,
    DAILY_QUESTION_CHANNEL_NAME,
    NotificationManager.IMPORTANCE_DEFAULT,
  )
  manager.createNotificationChannel(channel)
}

private fun requestCodeFor(requestId: String): Int {
  return requestId.hashCode() and Int.MAX_VALUE
}
