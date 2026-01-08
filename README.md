# Clock Tower ⏰

A multi-account builder timer app for Clash of Clans with local notifications and a modern glassmorphism dark theme.

## Features

- 🏗️ **Multi-Account Support** - Manage multiple Clash of Clans accounts
- ⚡ **Dynamic Builder Management** - Add 2-7 builders per account
- 🔔 **Local Notifications** - Get notified when timers complete (even when app is closed)
- 🎨 **Glassmorphism UI** - Modern dark theme with glass effect
- 💾 **Data Persistence** - All timers and accounts are saved locally
- 📱 **Compact Design** - Minimal and space-efficient interface

## Screenshots

<p align="center">
  <img src="homePage.png" alt="Clock Tower Home Screen" width="300"/>
</p>

## Download

### Android

Download the latest APK from the [Releases](https://github.com/codecxAb/Clocktower/releases) page.

**Direct Download:** [Clock Tower v1.0.0 APK](https://github.com/codecxAb/Clocktower/releases/download/v1.0/clocktower-v1.0.0.apk)

## Installation

1. Download the APK file
2. Enable "Install from Unknown Sources" in your Android settings
3. Open the APK file and install
4. Grant notification permissions when prompted

## Usage

### Account Management

- **Add Account:** Tap the "+" button in the top-right corner
- **Switch Accounts:** Tap any account card in the horizontal list
- **Rename/Delete:** Long-press an account card

### Builder Management

- **Start Timer:** Tap "START TIMER" on any idle builder
- **Add Builder:** Tap "ADD BUILDER" (max 7 per account)
- **Remove Builder:** Tap the X icon on idle builders (min 2 per account)
- **Cancel Timer:** Tap "CANCEL TIMER" on active timers

### Notifications

- Receive notifications when builder timers complete
- Notifications work even when the app is closed
- Each builder has a unique notification

## Technical Details

### Built With

- **Flutter** 3.38.5
- **Dart** 3.10.4
- **flutter_local_notifications** - Local notification support
- **shared_preferences** - Data persistence
- **provider** - State management
- **timezone** - Timezone handling

### Requirements

- Android 6.0 (API 23) or higher
- ~50MB storage space

## Development

### Prerequisites

- Flutter SDK 3.x
- Android SDK
- Dart 3.x

### Setup

```bash
# Clone the repository
git clone https://github.com/codecxAb/Clocktower.git
cd Clocktower

# Install dependencies
flutter pub get

# Run the app
flutter run
```

### Build Release APK

```bash
flutter build apk --release
```

## Version History

### v1.0 (January 8, 2026)

- Initial release
- Multi-account support
- Dynamic builder management (2-7 per account)
- Local notifications
- Glassmorphism dark theme
- Data persistence

## License

This project is open source and available for personal use.

## Support

For issues or feature requests, please open an issue on [GitHub](https://github.com/codecxAb/Clocktower/issues).

---

Made with ❤️ for Clash of Clans players
