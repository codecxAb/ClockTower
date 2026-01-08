import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/builder_timer.dart';
import '../models/account.dart';
import '../services/notification_service.dart';

class BuilderProvider extends ChangeNotifier {
  List<Account> _accounts = [];
  Map<String, List<BuilderTimer>> _accountBuilders = {};
  String? _selectedAccountId;
  Timer? _updateTimer;

  BuilderProvider() {
    _initializeData();
    _startUpdateTimer();
  }

  List<Account> get accounts => _accounts;
  String? get selectedAccountId => _selectedAccountId;

  Account? get selectedAccount => _selectedAccountId != null
      ? _accounts.firstWhere((a) => a.id == _selectedAccountId,
          orElse: () => _accounts.first)
      : null;

  List<BuilderTimer> get builders {
    if (_selectedAccountId == null || selectedAccount == null) return [];
    return _accountBuilders[_selectedAccountId] ?? [];
  }

  Future<void> _initializeData() async {
    await _loadData();
    if (_accounts.isEmpty) {
      // Create default account with 2 builders
      final defaultAccount = Account(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        name: 'Main Account',
        builderIds: [1, 2],
      );
      _accounts.add(defaultAccount);
      _selectedAccountId = defaultAccount.id;

      _accountBuilders[defaultAccount.id] = [
        BuilderTimer(id: 1),
        BuilderTimer(id: 2),
      ];

      await _saveData();
    } else {
      _selectedAccountId ??= _accounts.first.id;
    }
    notifyListeners();
  }

  void selectAccount(String accountId) {
    _selectedAccountId = accountId;
    notifyListeners();
  }

  Future<void> addAccount(String name) async {
    final newAccount = Account(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      name: name,
      builderIds: [1, 2],
    );

    _accounts.add(newAccount);
    _accountBuilders[newAccount.id] = [
      BuilderTimer(id: 1),
      BuilderTimer(id: 2),
    ];

    _selectedAccountId = newAccount.id;
    await _saveData();
    notifyListeners();
  }

  Future<void> deleteAccount(String accountId) async {
    if (_accounts.length <= 1) return; // Don't delete last account

    // Cancel all timers for this account
    final builders = _accountBuilders[accountId] ?? [];
    for (var builder in builders) {
      if (builder.isActive) {
        await NotificationService.cancelNotification(
          int.parse('$accountId${builder.id}'),
        );
      }
    }

    _accounts.removeWhere((a) => a.id == accountId);
    _accountBuilders.remove(accountId);

    if (_selectedAccountId == accountId) {
      _selectedAccountId = _accounts.first.id;
    }

    await _saveData();
    notifyListeners();
  }

  Future<void> renameAccount(String accountId, String newName) async {
    final account = _accounts.firstWhere((a) => a.id == accountId);
    account.name = newName;
    await _saveData();
    notifyListeners();
  }

  Future<void> addBuilder() async {
    if (selectedAccount == null) return;

    final currentBuilders = _accountBuilders[_selectedAccountId] ?? [];
    if (currentBuilders.length >= 7) return; // Max 7 builders

    final newBuilderId = currentBuilders.isEmpty
        ? 1
        : currentBuilders.map((b) => b.id).reduce((a, b) => a > b ? a : b) + 1;

    selectedAccount!.builderIds.add(newBuilderId);
    currentBuilders.add(BuilderTimer(id: newBuilderId));

    await _saveData();
    notifyListeners();
  }

  Future<void> removeBuilder(int builderId) async {
    if (selectedAccount == null) return;

    final currentBuilders = _accountBuilders[_selectedAccountId] ?? [];
    if (currentBuilders.length <= 2) return; // Minimum 2 builders

    final builder = currentBuilders.firstWhere((b) => b.id == builderId);
    if (builder.isActive) {
      await NotificationService.cancelNotification(
        int.parse('$_selectedAccountId$builderId'),
      );
    }

    selectedAccount!.builderIds.remove(builderId);
    currentBuilders.removeWhere((b) => b.id == builderId);

    await _saveData();
    notifyListeners();
  }

  void _startUpdateTimer() {
    _updateTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      // Only update if there are active timers to improve battery efficiency
      bool hasActiveTimers = false;
      bool hasChanges = false;
      
      for (var builders in _accountBuilders.values) {
        for (var builder in builders) {
          if (builder.isActive) {
            hasActiveTimers = true;
            if (builder.isCompleted) {
              builder.isActive = false;
              hasChanges = true;
            }
          }
        }
      }
      
      // Only notify listeners when there are active timers or when state changes
      if (hasActiveTimers || hasChanges) {
        if (hasChanges) {
          _saveData();
        }
        notifyListeners();
      }
    });
  }

  Future<void> startTimer(
      int builderId, String workName, Duration duration) async {
    if (_selectedAccountId == null) return;

    final builder = builders.firstWhere((b) => b.id == builderId);
    builder.workName = workName;
    builder.startTime = DateTime.now();
    builder.endTime = DateTime.now().add(duration);
    builder.isActive = true;

    await _saveData();

    // Use combined account+builder ID for unique notifications
    final notificationId = int.parse('$_selectedAccountId$builderId');
    await NotificationService.scheduleNotification(
      id: notificationId,
      title: '${selectedAccount?.name} - Builder $builderId Complete!',
      body: 'Work "$workName" is finished',
      scheduledTime: builder.endTime!,
    );

    notifyListeners();
  }

  Future<void> cancelTimer(int builderId) async {
    if (_selectedAccountId == null) return;

    final builder = builders.firstWhere((b) => b.id == builderId);
    builder.isActive = false;
    builder.workName = '';
    builder.startTime = null;
    builder.endTime = null;

    await _saveData();

    final notificationId = int.parse('$_selectedAccountId$builderId');
    await NotificationService.cancelNotification(notificationId);

    notifyListeners();
  }

  Future<void> _saveData() async {
    final prefs = await SharedPreferences.getInstance();

    // Save accounts
    final accountsJson = _accounts.map((a) => a.toJson()).toList();
    await prefs.setString('accounts', jsonEncode(accountsJson));

    // Save builders for each account
    final buildersData = <String, dynamic>{};
    _accountBuilders.forEach((accountId, builders) {
      buildersData[accountId] = builders.map((b) => b.toJson()).toList();
    });
    await prefs.setString('accountBuilders', jsonEncode(buildersData));

    // Save selected account
    if (_selectedAccountId != null) {
      await prefs.setString('selectedAccountId', _selectedAccountId!);
    }
  }

  Future<void> _loadData() async {
    final prefs = await SharedPreferences.getInstance();

    // Load accounts
    final accountsString = prefs.getString('accounts');
    if (accountsString != null) {
      final List<dynamic> accountsJson = jsonDecode(accountsString);
      _accounts = accountsJson.map((json) => Account.fromJson(json)).toList();
    }

    // Load builders for each account
    final buildersString = prefs.getString('accountBuilders');
    if (buildersString != null) {
      final Map<String, dynamic> buildersData = jsonDecode(buildersString);
      buildersData.forEach((accountId, buildersList) {
        _accountBuilders[accountId] = (buildersList as List)
            .map((json) => BuilderTimer.fromJson(json))
            .toList();
      });
    }

    // Load selected account
    _selectedAccountId = prefs.getString('selectedAccountId');

    notifyListeners();
  }

  @override
  void dispose() {
    _updateTimer?.cancel();
    super.dispose();
  }
}
