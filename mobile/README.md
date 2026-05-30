# Inventory — Mobile (Flutter)

Native Android + iOS app for the inventory system. Like the web app, it talks
only to the shared **inventory-api** (`../supabase/api`), never to Supabase
directly.

## Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (3.24+)
- For iOS: Xcode + CocoaPods on macOS
- For Android: Android Studio + SDK (or just `sdkmanager`)
- The inventory-api running (see `../supabase/api`)

## First-time setup

Flutter expects the platform folders (`android/`, `ios/`, etc.) to live alongside
`pubspec.yaml`. They aren't checked in — generate them once with:

```bash
cd mobile

flutter create --project-name inventory_mobile \
               --org com.example.inventory \
               --platforms=android,ios \
               .

flutter pub get
```

Then copy `.env.example` to `.env` and set `API_URL` to where the API runs:

- Android emulator → `http://10.0.2.2:4000`
- iOS simulator / desktop / web → `http://localhost:4000`
- Physical device → `http://<your-computer-LAN-ip>:4000`

## Running

```bash
flutter run                 # picks any attached device
flutter run -d chrome       # web preview
flutter run -d <device-id>  # specific emulator/device
```

## Features

Mirrors the web app:

- Email/password auth through the API (secure-storage session, auto-refresh)
- Bottom-nav shell with role-based tabs
- **Home** dashboard — stat cards, low-stock + storage-location sections, searchable inventory
- **Locations** — list + detail (items stored in each)
- **Item detail** — where it is, activity log (who took what, when), take/return stock, admin delete
- **Items** (admin) — add (location required) + remove
- **Users** (admin) — list, change roles, add/delete accounts
- **Settings** — profile, light/dark/system theme, sign out

## Project layout

```
mobile/lib/
├── main.dart                 Entrypoint — theme + auth gate
├── models.dart               Item, Location, StockLevel, Movement, Profile
├── repository.dart           InventoryRepository + UsersRepository
├── widgets.dart              StatusChip, StatCard, SectionCard
├── config/
│   ├── api_client.dart       API client (auth, tokens, role)
│   ├── theme.dart            Light/dark themes (pink accent)
│   └── theme_controller.dart Persisted ThemeMode
└── features/
    ├── auth/                 login_screen, signup_screen
    ├── shell/                main_shell (bottom nav)
    ├── dashboard/            dashboard_screen
    ├── locations/            locations_screen, location_detail_screen
    ├── items/                items_admin_screen, item_detail_screen
    ├── users/                users_screen
    └── settings/             settings_screen
```
