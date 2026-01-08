import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest_all.dart' as tz;

class NotificationService {
  static FlutterLocalNotificationsPlugin? _notificationsPlugin;

  static Future<void> initialize(
      FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin) async {
    _notificationsPlugin = flutterLocalNotificationsPlugin;
    tz.initializeTimeZones();

    // Set timezone
    try {
      tz.setLocalLocation(tz.getLocation('Asia/Kolkata'));
      print('✅ Timezone set to Asia/Kolkata');
    } catch (e) {
      print('⚠️ Using default timezone: $e');
    }

    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings initializationSettingsDarwin =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings initializationSettings =
        InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsDarwin,
    );

    await flutterLocalNotificationsPlugin.initialize(
      initializationSettings,
    );

    // Create notification channel for Android
    final androidImplementation =
        flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    if (androidImplementation != null) {
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'builder_timer_channel',
        'Builder Timers',
        description: 'Notifications for builder timer completions',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );

      await androidImplementation.createNotificationChannel(channel);
      print('✅ Notification channel created');

      // Request permissions
      final notificationPermission =
          await androidImplementation.requestNotificationsPermission();
      print('Notification permission: $notificationPermission');

      final exactAlarmPermission =
          await androidImplementation.requestExactAlarmsPermission();
      print('Exact alarm permission: $exactAlarmPermission');
    }

    // Request permissions for iOS
    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );
  }

  static Future<void> showImmediateNotification({
    required int id,
    required String title,
    required String body,
  }) async {
    if (_notificationsPlugin == null) {
      print('❌ Notification plugin not initialized');
      return;
    }

    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'builder_timer_channel',
      'Builder Timers',
      channelDescription: 'Notifications for builder timer completions',
      importance: Importance.max,
      priority: Priority.high,
      showWhen: true,
      playSound: true,
      enableVibration: true,
    );

    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    try {
      await _notificationsPlugin!.show(id, title, body, details);
      print('✅ Immediate notification shown');
    } catch (e) {
      print('❌ Error showing notification: $e');
    }
  }

  static Future<void> scheduleNotification({
    required int id,
    required String title,
    required String body,
    required DateTime scheduledTime,
  }) async {
    if (_notificationsPlugin == null) {
      print('❌ Notification plugin not initialized');
      return;
    }

    // Convert to TZDateTime
    final tz.TZDateTime scheduledDate = tz.TZDateTime.from(
      scheduledTime,
      tz.local,
    );

    final now = tz.TZDateTime.now(tz.local);
    final difference = scheduledDate.difference(now);

    print('📅 Scheduling notification:');
    print('   ID: $id');
    print('   Current: $now');
    print('   Scheduled: $scheduledDate');
    print('   In: ${difference.inSeconds} seconds');

    if (difference.isNegative) {
      print('❌ Cannot schedule in the past!');
      return;
    }

    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'builder_timer_channel',
      'Builder Timers',
      channelDescription: 'Notifications for builder timer completions',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
      showWhen: true,
    );

    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    try {
      await _notificationsPlugin!.zonedSchedule(
        id,
        title,
        body,
        scheduledDate,
        details,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
      );
      print('✅ Notification scheduled successfully!');
    } catch (e, stackTrace) {
      print('❌ Error scheduling notification: $e');
      print('Stack trace: $stackTrace');
      // Don't rethrow, just log
    }
  }

  static Future<void> cancelNotification(int id) async {
    if (_notificationsPlugin == null) {
      print('❌ Notification plugin not initialized');
      return;
    }
    try {
      await _notificationsPlugin!.cancel(id);
      print('🚫 Notification $id cancelled');
    } catch (e) {
      print('❌ Error cancelling notification: $e');
    }
  }
}
