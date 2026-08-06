package com.opentelecrm.core.network.di

import com.opentelecrm.core.network.AuthInterceptor
import com.opentelecrm.core.network.BuildConfig
import com.opentelecrm.core.network.ServerUrlInterceptor
import com.opentelecrm.core.network.api.OpenTeleCrmApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
    }

    /**
     * Interceptor order matters:
     * 1. [ServerUrlInterceptor] — rewrites the request onto the configured API server;
     * 2. [AuthInterceptor] — attaches the bearer token (skips public endpoints);
     * 3. logging — always on at BASIC level, upgraded to BODY in debug builds.
     */
    @Provides
    @Singleton
    fun provideOkHttpClient(
        serverUrlInterceptor: ServerUrlInterceptor,
        authInterceptor: AuthInterceptor,
    ): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.BASIC
            }
        }
        return OkHttpClient.Builder()
            .addInterceptor(serverUrlInterceptor)
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        json: Json,
        okHttpClient: OkHttpClient,
    ): Retrofit = Retrofit.Builder()
        // Placeholder only — ServerUrlInterceptor rewrites the host per request.
        .baseUrl("http://10.0.2.2:3005/")
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun provideOpenTeleCrmApi(retrofit: Retrofit): OpenTeleCrmApi =
        retrofit.create(OpenTeleCrmApi::class.java)
}
