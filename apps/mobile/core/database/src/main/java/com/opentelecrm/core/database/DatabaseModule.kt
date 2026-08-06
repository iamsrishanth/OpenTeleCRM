package com.opentelecrm.core.database

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "opentelecrm.db",
        )
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideSyncStateDao(db: AppDatabase): SyncStateDao = db.syncStateDao()

    @Provides
    fun provideLeadDao(db: AppDatabase): LeadDao = db.leadDao()

    @Provides
    fun provideActionDao(db: AppDatabase): ActionDao = db.actionDao()

    @Provides
    fun providePendingMutationDao(db: AppDatabase): PendingMutationDao = db.pendingMutationDao()
}
