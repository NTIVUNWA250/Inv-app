# Inventory — Mobile (Flutter)

Native Android + iOS app for the inventory system, sharing the same Supabase backend as the web app.

## Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (3.24+)
- For iOS: Xcode + CocoaPods on macOS
- For Android: Android Studio + SDK (or just `sdkmanager`)

## First-time setup

Flutter expects the platform folders (`android/`, `ios/`, etc.) to live alongside `pubspec.yaml`. They aren't checked in — generate them once with:

```bash
cd mobile

# Generate android/, ios/, linux/, macos/, windows/, web/ folders + native runner
# without overwriting our existing lib/ or pubspec.yaml
flutter create --project-name inventory_mobile \
               --org com.example.inventory \
               --platforms=android,ios \
               .

flutter pub get
```

Then copy `.env.example` to `.env` and fill in your Supabase project URL + anon key.

## Running

```bash
flutter run                 # picks any attached device
flutter run -d chrome       # web preview (optional)
flutter run -d <device-id>  # specific emulator/device
```

## Project layout

```
mobile/
├── pubspec.yaml            Dependencies
├── .env.example            Supabase URL + anon key template
└── lib/
    ├── main.dart           Entrypoint — initializes Supabase + routes auth
    ├── config/
    │   └── supabase.dart   Supabase client init
    ├── features/
    │   └── auth/
    │       ├── login_screen.dart
    │       └── signup_screen.dart
    └── screens/
        └── home_screen.dart Placeholder dashboard
```

Add new features under `lib/features/<feature_name>/` to keep the tree tidy.
