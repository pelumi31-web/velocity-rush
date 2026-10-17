# Velocity Rush — 3D Highway Arcade Racing

## 1. Environment & Deliverable Overview

- **Playable WebGL / Three.js Application (Live in Browser)**: Complete 5-phase implementation running at `http://localhost:3000` with procedural 3D vehicles, 4-lane city highway, traffic spawning, near-miss scoring, mobile tilt/touch/keyboard steering, calibration, garage unlocks & upgrades, progressive challenges, versioned local save system, and Google AdMob monetization simulation.
- **Unity 6 LTS (URP) C# Source Scripts**: Located in `/Assets/Scripts/` and inspectable directly inside the running application via the **Unity 6 C# & APK Guide** modal.

## 2. Unity 6 Version & Package Requirements

- **Unity Version**: Unity 6 LTS (`6000.0.x` LTS)
- **Render Pipeline**: Universal Render Pipeline (`com.unity.render-pipelines.universal` 17.x)
- **Input System**: Unity Input System (`com.unity.inputsystem` 1.11.x) — set **Active Input Handling** to `Input System Package (New)` in `Edit > Project Settings > Player`.
- **Google Mobile Ads SDK**: Google Mobile Ads Unity Plugin v9.x+ (includes Google User Messaging Platform UMP SDK).

## 3. Running in the Unity Editor or Browser

1. **Browser / AI Studio Runtime**:
   - Press **Play Race** on the main menu (or load `?autostart=1`).
   - Steer with `A`/`D` or `Left`/`Right` Arrow keys, hold `W`/`Up`/`Space` for Nitro Boost, `S`/`Down` to Brake, `P`/`Esc` to Pause, `M` to Mute.
   - Open **Settings** to switch between **Tilt Motion**, **On-Screen Buttons**, and **Touch & Drag**, calibrate neutral tilt offset, and test tilt steering with the interactive Tilt Sensor Simulator slider.
2. **Unity Editor**:
   - Open the project in Unity 6000.0 LTS with Android Build Support installed.
   - Open the main scene, press Play, and use the `Keyboard.current` fallback in `MobileSteeringInput.cs` (`A`/`D` or Arrow keys) to test steering in the Editor.

## 4. Building & Installing an Android Test APK

1. Open `File > Build Profiles` (Unity 6) and select **Android**, then click **Switch Platform**.
2. Open `Edit > Project Settings > Player > Android`:
   - Set **Default Orientation** to `Landscape Left` (or `Auto Rotation` with `Landscape Left` and `Landscape Right` enabled).
   - Under **Other Settings > Identification**, replace the placeholder Package Name `com.placeholder.velocityrush` with your studio's reverse-domain identifier.
   - Set **Scripting Backend** to `IL2CPP` and enable `ARM64` target architecture.
   - Set **Target API Level** to `Automatic (highest installed)` (API 35+ as required by current Google Play submission rules).
3. Connect an Android phone with **USB Debugging** enabled and click **Build and Run** to install the test APK and verify hardware `GravitySensor` / `Accelerometer` tilt steering.

## 5. Producing a Signed Android App Bundle (AAB) for Google Play

1. In `File > Build Profiles > Android`, check **Build App Bundle (Google Play)**.
2. Open `Edit > Project Settings > Player > Publishing Settings`:
   - Enable **Custom Keystore** and create or select your production `.keystore` file (keep `.keystore` files and passwords outside version control).
3. Click **Build** to generate the signed `.aab` bundle for Google Play Console upload.

## 6. Configuring Google AdMob & UMP Consent

- During development, use only official Google test IDs (`ca-app-pub-3940256099942544~3347511713` for App ID, `ca-app-pub-3940256099942544/5224354917` for Rewarded, `ca-app-pub-3940256099942544/1033173712` for Interstitial).
- Before production release, configure your GDPR/CCPA consent message in the AdMob Privacy & Messaging tab and inject production Ad Unit IDs via a non-committed build config asset.

## 7. Assets & Licensing Note

All 3D vehicle meshes, road textures, UI SVG emblems, and Web Audio sound effects in this project are 100% procedurally generated in code with zero external copyrighted assets, logos, or third-party liveries, making them clean for commercial use.
