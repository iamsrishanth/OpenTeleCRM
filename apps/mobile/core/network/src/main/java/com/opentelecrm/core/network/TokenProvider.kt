package com.opentelecrm.core.network

/**
 * Supplies the current session token for authenticated API calls.
 *
 * Implemented by :core:auth's SessionManager and bound via @Binds in
 * :core:auth's Hilt module. Do NOT implement here.
 */
interface TokenProvider {
    fun token(): String?
}
