# OpenTeleCRM Mobile (Android)

Kotlin-native Android client for the self-hosted OpenTeleCRM backend.
Offline-first agent app: leads sync with Room cache + outbox, WhatsApp inbox,
click-to-dial with caller-ID, UnifiedPush notifications.

Shipped M0–M5 (2026-08-06). Stack decision: [ADR-0030](../../docs/DECISIONS.md)
(Kotlin native + Compose + Room, supersedes ADR-0024's React Native plan).

## Modules

12 Gradle modules (`settings.gradle.kts`):

```
:app                       — application shell, nav graph, DI root (Hilt)
:core:model                — API DTOs + domain models (kotlinx-serialization)
:core:network              — Retrofit/OkHttp API client, ServerUrlStore, auth interceptor, token exchange
:core:database             — Room database, DAOs, sync_state
:core:auth                 — Keystore session, login/onboarding state
:core:sync                 — Room outbox + WorkManager flush worker, delta sync
:core:designsystem         — Compose M3 theme (slate/indigo, light + dark schemes)
:feature:auth              — onboarding (server URL), login
:feature:leads             — leads list (search/filter/score/tags), lead detail (timeline, custom fields)
:feature:dialer            — call pad, in-call card, dispositions, CallForegroundService, CallerIdNotifier
:feature:inbox             — WhatsApp conversations, thread bubbles, send, template picker, push
:feature:settings          — server URL, sync controls
```

## Stack

| Component | Version |
|-----------|---------|
| Kotlin (kotlinx-serialization 1.7.3) | 2.0.21 |
| Android Gradle Plugin | 8.7.3 |
| Jetpack Compose BOM | 2024.12.01 |
| Hilt (Dagger) | 2.x |
| Room + WorkManager | 2.x |
| Retrofit + OkHttp | 2.9 / 4.x |
| UnifiedPush | 3.0.10 |

## Build & run

```bash
# debug APK (signs with debug keystore)
cd apps/mobile
GRADLE_USER_HOME=/home/sri/.gradle ./gradlew :app:assembleDebug

# release APK (R8 minify; requires keystore.properties — gitignored)
GRADLE_USER_HOME=/home/sri/.gradle ./gradlew :app:assembleRelease

# install on a connected device
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Release signing: `apps/mobile/keystore.properties` (keystore path/passwords)
+ `release.keystore` — both **gitignored**. The release keystore must exist on
the build machine; never commit it (see RISKS.md mobile keystore row).

## On-device verification (smoke)

The release was verified on Samsung J8 (AICP) and Moto G57 Power:
onboarding → health check → secret exchange → leads sync → dial →
disposition → inbox send, all R8-safe. `adb reverse tcp:3005 tcp:3005` for LAN
API access; offline simulation = kill the host API or `adb reverse --remove`.

## F-Droid

Metadata: `fdroid/metadata/com.opentelecrm.app.yml` (License: AGPL-3.0-or-later).
Play publishing (internal track) is a release decision; not yet published.

## Permissions

`READ_PHONE_STATE` (caller-ID heads-up), `POST_NOTIFICATIONS` (runtime),
`ACCESS_NETWORK_STATE`, `FOREGROUND_SERVICE`/`phoneCall` FGS (in-call card).
Debug builds allow cleartext for LAN/loopback API hosts; release restricts to
explicit `network_security_config` hosts.
