# Building & Running the Mobile App — APK + IPA (no store publishing)

A step-by-step model for producing installable builds of the Flutter app and
running it on a simulator/emulator — **without** publishing to Google Play or the
App Store. Covers Linux (this machine) and macOS (the Mac mini).

> Companion docs: environment/API split is in [`ENVIRONMENTS.md`](./ENVIRONMENTS.md).

---

## 0. Project facts (used throughout)

| Thing | Value |
|---|---|
| Flutter | 3.44.0 (stable) |
| App module | `mobile/` (`inventory_mobile`, version `0.1.0+1`) |
| Android applicationId | `com.example.inventory.inventory_mobile` |
| iOS bundle id | `com.example.inventory.inventoryMobile` |
| Android release signing | **debug keystore** (no custom keystore needed) |
| iOS signing | Automatic, **no team set yet** (add a free Apple ID in Xcode) |
| Android AVD (Linux) | `pixel_inventory` |
| API (prod / test) | host `:4000` / `:4001` |

**Toolchain paths (Linux box — not on PATH):**
```bash
export PATH=$HOME/flutter/bin:$HOME/Android/Sdk/platform-tools:$PATH
export ANDROID_HOME=$HOME/Android/Sdk ANDROID_SDK_ROOT=$HOME/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
```

---

## 1. Pick which API the build talks to

The app reads the API URL from a compile-time flag (falls back to the bundled
`.env`, then `http://10.0.2.2:4000`):

```bash
--dart-define=API_URL=<url>
```

**Choosing the URL depends on where the build RUNS vs. where the API runs:**

| Build runs on… | API runs on… | Use this API_URL |
|---|---|---|
| Android emulator (same machine as API) | same machine | `http://10.0.2.2:4000` (emulator alias for host) |
| Android emulator + `adb reverse tcp:4000` | same machine | `http://localhost:4000` |
| **Mac mini** simulator/emulator | **Linux box** | `http://192.168.1.86:4000` (LAN) or `http://100.121.91.106:4000` (Tailscale) |
| Real phone | Linux box on same wifi | `http://192.168.1.86:4000` |

Use `:4001` instead of `:4000` for the **test** environment. The API binds all
interfaces, so it's reachable from the Mac mini over LAN/Tailscale.

---

## 2. Android — build an installable APK (no publishing)

Because the release build is signed with the debug keystore, `flutter build apk
--release` already produces a **sideloadable** APK — no keystore setup required.

### On Linux (this machine)
```bash
cd ~/Desktop/vux\ projects/Inventory-app/mobile
export PATH=$HOME/flutter/bin:$HOME/Android/Sdk/platform-tools:$PATH
export ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

flutter build apk --release --dart-define=API_URL=http://192.168.1.86:4000
```
Output:
```
build/app/outputs/flutter-apk/app-release.apk
```
Smaller, per-architecture APKs instead of one fat APK:
```bash
flutter build apk --release --split-per-abi --dart-define=API_URL=...
# -> app-armeabi-v7a-release.apk, app-arm64-v8a-release.apk, app-x86_64-release.apk
```

### On macOS (Mac mini)
Identical command (PATHs differ — wherever you installed Flutter/Android SDK):
```bash
cd ~/Inventory-app/mobile
flutter build apk --release --dart-define=API_URL=http://192.168.1.86:4000
```

### Install the APK (no store)
```bash
# onto a connected device / running emulator:
adb install -r build/app/outputs/flutter-apk/app-release.apk

# or copy the .apk file to a phone and open it (enable "install unknown apps").
```

---

## 3. iOS — build an IPA / app (Mac only, no publishing)

iOS builds require **Xcode on a Mac** — this cannot be done on Linux.
There are two no-publish paths; pick by what you need.

### Path A — Simulator build (no Apple account, no signing)
Best for just *seeing* the app on the Mac mini. Produces a `.app` for the
simulator (cannot be installed on a real iPhone, cannot be an `.ipa`):
```bash
cd ~/Inventory-app/mobile
flutter build ios --simulator --debug \
  --dart-define=API_URL=http://192.168.1.86:4000
# -> build/ios/iphonesimulator/Runner.app
```
(Or skip the build and just `flutter run` on a simulator — see §5.)

### Path B — Development IPA (free Apple ID, installs on YOUR devices, not the store)
A real `.ipa` you can sideload to registered devices for 7 days (free personal
team) — without ever publishing.

1. One-time signing setup in Xcode:
   ```bash
   open ios/Runner.xcworkspace
   ```
   - Select the **Runner** target → **Signing & Capabilities**.
   - Tick **Automatically manage signing**.
   - **Team** → add/sign in with your free Apple ID (Personal Team).
   - (If the bundle id `com.example.inventory.inventoryMobile` is taken, change it
     to something unique like `com.<you>.inventoryMobile`.)

2. Build the IPA with the development export method (NOT app-store):
   ```bash
   flutter build ipa --export-method development \
     --dart-define=API_URL=http://192.168.1.86:4000
   # -> build/ios/ipa/inventory_mobile.ipa
   ```
   > `--export-method ad-hoc` also works for a wider set of pre-registered devices.
   > `--export-method app-store` is the one we are deliberately NOT using.

3. Install the IPA on a registered iPhone (no store):
   - **Xcode** → Window → Devices & Simulators → drag the `.ipa` onto the device, or
   - `xcrun devicectl device install app --device <id> build/ios/ipa/*.ipa`, or
   - Apple Configurator.

---

## 4. Get the project onto the Mac mini

The code lives on the Linux box. Pick one:

```bash
# Option A — git (preferred, if pushed to a remote):
git clone <your-repo-url> ~/Inventory-app

# Option B — copy directly over Tailscale/LAN from the Linux box:
rsync -av --exclude node_modules --exclude build \
  ~/Desktop/vux\ projects/Inventory-app/  oreste@100.121.91.106:~/Inventory-app/
```

Then on the Mac mini, one-time toolchain:
```bash
# Xcode from the App Store, then:
sudo xcodebuild -license accept
xcode-select --install                 # command line tools
brew install --cask flutter            # or download the Flutter SDK
sudo gem install cocoapods             # iOS pods
flutter doctor                         # resolve any ❌ it reports
cd ~/Inventory-app/mobile && flutter pub get
```

---

## 5. Run the emulator on the Mac mini until you SEE the app

### iOS Simulator (the Mac-only path)

1. **List & boot a simulator:**
   ```bash
   xcrun simctl list devices available          # see installed simulators
   open -a Simulator                            # opens the default device, or:
   xcrun simctl boot "iPhone 15 Pro"            # boot a specific one
   ```

2. **Confirm Flutter sees it:**
   ```bash
   flutter devices
   # look for a line like:  iPhone 15 Pro (mobile) • <UUID> • ios • com.apple...
   ```

3. **Run the app on it, pointed at the Linux box's API:**
   ```bash
   cd ~/Inventory-app/mobile
   flutter run -d "iPhone 15 Pro" \
     --dart-define=API_URL=http://192.168.1.86:4000
   ```
   Flutter builds, installs, and launches it in the Simulator. Wait for
   `Syncing files to device` / `Flutter run key commands` — the app window should
   show the **Inventory login screen**.

4. **Verify the API connection:** type credentials and sign in. If it spins or
   errors, the simulator can't reach the API — check §1 (use the Linux box IP,
   confirm the API is running and `curl http://192.168.1.86:4000/health` from the
   Mac mini returns `{"status":"ok"}`).

5. **If you can't watch the screen directly (headless Mac mini):**
   ```bash
   xcrun simctl io booted screenshot ~/Desktop/app.png   # capture what's shown
   ```
   Open `app.png` (or pull it over) to confirm the app is visible.

### Android emulator on the Mac mini (optional)
Same as Linux but with Mac PATHs:
```bash
flutter emulators                        # list AVDs (create one if none)
flutter emulators --launch <avd_id>      # or: flutter emulators --create
flutter run -d emulator-5554 --dart-define=API_URL=http://192.168.1.86:4000
```
On Android the host alias is `10.0.2.2`, but since the API is on a *different*
machine (the Linux box), use its LAN/Tailscale IP as above.

---

## 6. Quick reference

```bash
# Android APK (sideload, no publish)
flutter build apk --release --dart-define=API_URL=http://192.168.1.86:4000
adb install -r build/app/outputs/flutter-apk/app-release.apk

# iOS — see it on the Mac mini simulator (no account)
flutter run -d "iPhone 15 Pro" --dart-define=API_URL=http://192.168.1.86:4000

# iOS — development IPA (free Apple ID, no publish)
flutter build ipa --export-method development --dart-define=API_URL=http://192.168.1.86:4000
```

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| App opens but login hangs/fails | Wrong `API_URL` for where it runs (see §1); API not running; firewall. `curl <API_URL>/health` from the build machine. |
| `flutter build ipa` fails: no team / signing | Set Team in Xcode (§3 Path B step 1); ensure a unique bundle id. |
| iOS device install "untrusted developer" | On the iPhone: Settings → General → VPN & Device Management → trust your dev cert. Free certs expire after 7 days — rebuild to renew. |
| `flutter devices` doesn't list the simulator | Boot it first (`open -a Simulator`); run `flutter doctor`. |
| Android `adb` can't see emulator on Mac | `adb kill-server && adb start-server && adb devices`. |
| Mac mini can't reach Linux API | Use Tailscale IP `100.121.91.106` if LAN `192.168.1.86` is blocked; confirm API `CORS_ORIGINS` allows it. |
