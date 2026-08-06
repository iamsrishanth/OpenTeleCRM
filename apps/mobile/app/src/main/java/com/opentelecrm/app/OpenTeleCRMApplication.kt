package com.opentelecrm.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.opentelecrm.core.sync.WorkScheduler
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
    }

    @Inject lateinit var scheduler: WorkScheduler
}
