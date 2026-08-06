package com.opentelecrm.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.opentelecrm.app.navigation.AppNavHost
import com.opentelecrm.core.auth.SessionManager
import com.opentelecrm.core.designsystem.AppTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Restore a persisted (encrypted) session so the nav graph starts at
        // the leads list instead of onboarding for returning users.
        lifecycleScope.launch { sessionManager.restore() }
        setContent {
            AppTheme {
                AppNavHost(sessionManager = sessionManager)
            }
        }
    }
}
