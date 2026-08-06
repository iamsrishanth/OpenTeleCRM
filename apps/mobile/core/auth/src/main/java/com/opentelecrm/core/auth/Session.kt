package com.opentelecrm.core.auth

/**
 * Authenticated session. The raw token lives only in memory; a copy is persisted
 * encrypted (via [security.CryptoManager]) so it can be restored across process deaths.
 *
 * [tokenType]: TOKEN_TYPE_SYNC for the server-issued sync token,
 * TOKEN_TYPE_DEV_JWT for a developer JWT.
 */
data class Session(
    val enterpriseId: String,
    val tokenType: String,
    val token: String? = null,
) {
    companion object {
        const val TOKEN_TYPE_SYNC =
            "sync"
        const val TOKEN_TYPE_DEV_JWT =
            "dev-jwt"
    }
}
