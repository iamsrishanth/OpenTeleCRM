package com.opentelecrm.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.opentelecrm.core.sync.WorkScheduler
import com.opentelecrm.feature.dialer.CallerIdNotifier
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class OpenTeleCRMApplication : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        // Safety net: periodic outbox flush (15 min) so mutations queued while
        // offline are replayed even if no one-shot is scheduled later.
        scheduler.schedulePeriodic()
        // M3: incoming-call caller-ID lookup (no-op until READ_PHONE_STATE granted).
        callerIdNotifier.register()
        // M4: register with a UnifiedPush distributor (ntfy app) for push.
        runCatching {
            org.unifiedpush.android.connector.UnifiedPush.register(this, "opentelecrm", "", "")
        }
    }

    @Inject lateinit var scheduler: WorkScheduler
    @Inject lateinit var callerIdNotifier: CallerIdNotifier
}
