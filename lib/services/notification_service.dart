import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest_all.dart' as tz;

class NotificationService {
  static FlutterLocalNotificationsPlugin? _notificationsPlugin;

  static Future<void> initialize(
      FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin) async {
    _notificationsPlugin = flutterLocalNotificationsPlugin;
    tz.initializeTimeZones();

    // Try to get device timezone, fallback to UTC
    try {
      tz.setLocalLocation(
          tz.getLocation('Asia/Kolkata')); // Default to IST for India
    } catch (e) {
      print('Could not set timezone, using UTC: $e');
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

    // Request permissions for iOS
    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );

    // Request permissions for Android 13+
    final androidPermission = await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();

    print('Notification permission granted: $androidPermission');

    // Request exact alarm permission for Android 12+
    final exactAlarmPermission = await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestExactAlarmsPermission();

    print('Exact alarm permission granted: $exactAlarmPermission');

    // Create notification channel explicitly for Android
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
    }
  }

  // Show immediate notification for testing
  static Future<void> showImmediateNotification({
    required int id,
    required String title,
    required String body,
  }) async {
    if (_notificationsPlugin == null) {
      print('Error: Notification plugin not initialized');
      return;
    }

    const AndroidNotificationDetails androidPlatformChannelSpecifics =
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

    const DarwinNotificationDetails iOSPlatformChannelSpecifics =
        DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails platformChannelSpecifics = NotificationDetails(
      android: androidPlatformChannelSpecifics,
      iOS: iOSPlatformChannelSpecifics,
    );

    try {
      await _notificationsPlugin!.show(
        id,
        title,
        body,
        platformChannelSpecifics,
      );
      print('✅ Immediate notification shown successfully');
    } catch (e) {
      print('❌ Error showing immediate notification: $e');
    }
  }

  static Future<void> scheduleNotification({
    required int id,
    required String title,
    required String body,
    required DateTime scheduledTime,
  }) async {
    if (_notificationsPlugin == null) {
      print('❌ Error: Notification plugin not initialized');
      return;
    }

    const AndroidNotificationDetails androidPlatformChannelSpecifics =
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

    const DarwinNotificationDetails iOSPlatformChannelSpecifics =
        DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails platformChannelSpecifics = NotificationDetails(
      android: androidPlatformChannelSpecifics,
      iOS: iOSPlatformChannelSpecifics,
    );

    final scheduledDate = tz.TZDateTime.from(scheduledTime, tz.local);
    final now = tz.TZDateTime.now(tz.local);
    final duration = scheduledDate.difference(now);

    print('📅 Scheduling notification $id');
    print('   Current time: $now');
    print('   Scheduled for: $scheduledDate');
    print('   Duration until: $duration');

    if (duration.isNegative) {
      print('❌ Error: Cannot schedule notification in the past!');
      return;
    }

    try {
      await _notificationsPlugin!.zonedSchedule(
        id,
        title,
        body,
        scheduledDate,
        platformChannelSpecifics,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        payload: 'builder_timer_$id',
      );

      print('✅ Notification scheduled successfully!');
    } catch (e) {
      print('❌ Error scheduling notification: $e');
      print('Stack trace: ${StackTrace.current}');
      rethrow;
    }
  }

  static Future<void> cancelNotification(int id) async {
    if (_notificationsPlugin == null) {
      print('❌ Error: Notification plugin not initialized');
      return;
    }
    await _notificationsPlugin!.cancel(id);
    print('🚫 Notification $id cancelled');
  }
}
