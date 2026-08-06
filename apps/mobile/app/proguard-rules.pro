# OpenTeleCRM ProGuard/R8 keep rules (M5 release hardening)

# --- kotlinx.serialization (reflection-based; keep generated serializers) ---
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.opentelecrm.**$$serializer { *; }
-keepclassmembers class com.opentelecrm.** {
    *** Companion;
}
-keepclasseswithmembers class com.opentelecrm.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# --- Retrofit + OkHttp (interface proxies) ---
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-dontwarn okhttp3.**
-dontwarn okio.**
-keepattributes Signature, Exceptions
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-keep class com.opentelecrm.core.network.api.OpenTeleCrmApi { *; }

# --- Hilt / Dagger (generated components) ---
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }

# --- WorkManager (HiltWorker via reflection-ish lookup) ---
-keep class androidx.work.** { *; }
-keep class * extends androidx.work.Worker { *; }
-keep class com.opentelecrm.core.sync.OutboxWorker { *; }

# --- Room (generated impls) ---
-keep class * extends androidx.room.RoomDatabase { *; }
-dontwarn androidx.room.paging.**

# --- UnifiedPush receiver ---
-keep class com.opentelecrm.feature.inbox.PushMessageReceiver { *; }

# --- Compose / AndroidX (avoid aggressive stripping of runtime lookups) ---
-dontwarn androidx.compose.**
-dontwarn androidx.lifecycle.**
-dontwarn androidx.navigation.**

# --- Services / receivers referenced from the manifest ---
-keep class com.opentelecrm.feature.dialer.CallForegroundService { *; }
-keep class com.opentelecrm.feature.dialer.CallerIdNotifier { *; }

# --- Misc reflection (dates, gson-free JSON paths) ---
-dontwarn java.lang.invoke.**
-dontwarn org.conscrypt.**
