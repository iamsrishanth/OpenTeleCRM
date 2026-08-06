package com.opentelecrm.core.auth

import com.opentelecrm.core.network.TokenProvider
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class AuthModule {

    @Binds
    abstract fun bindTokenProvider(impl: SessionManager): TokenProvider
}
