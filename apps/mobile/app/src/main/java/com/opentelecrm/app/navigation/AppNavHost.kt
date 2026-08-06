package com.opentelecrm.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.opentelecrm.app.HomeScreen
import com.opentelecrm.feature.auth.LoginRoute
import com.opentelecrm.feature.auth.OnboardingRoute
import com.opentelecrm.feature.settings.SettingsRoute

object Routes {
    const val ONBOARDING = "onboarding"
    const val LOGIN = "login"
    const val HOME = "home"
    const val SETTINGS = "settings"
}

/**
 * M0 placeholder flow: starts at onboarding.
 * Session gating (route based on SessionManager state) lands in M1.
 */
@Composable
fun AppNavHost() {
    val navController = rememberNavController()
    NavHost(
        navController = navController,
        startDestination = Routes.ONBOARDING,
    ) {
        composable(Routes.ONBOARDING) {
            OnboardingRoute(onSaved = { navController.navigate(Routes.LOGIN) })
        }
        composable(Routes.LOGIN) {
            LoginRoute(onLoggedIn = { navController.navigate(Routes.HOME) })
        }
        composable(Routes.HOME) {
            HomeScreen(onNavigateToSettings = { navController.navigate(Routes.SETTINGS) })
        }
        composable(Routes.SETTINGS) { SettingsRoute() }
    }
}
