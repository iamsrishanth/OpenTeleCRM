package com.opentelecrm.core.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/** WorkManager flush of the offline outbox (M2). */
@HiltWorker
class OutboxWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val outbox: ActionOutbox,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return try {
            outbox.flushNow()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
