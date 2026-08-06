package com.opentelecrm.core.network.di

import android.content.Context
import com.opentelecrm.core.network.ServerUrlStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object ServerUrlModule {

    @Provides
    @Singleton
    fun provideServerUrlStore(@ApplicationContext context: Context): ServerUrlStore =
        ServerUrlStore(context)

    // NOTE: TokenProvider is intentionally NOT bound here.
    // :core:auth provides it via @Binds (SessionManager -> TokenProvider).
}
