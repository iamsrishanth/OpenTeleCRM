package com.opentelecrm.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.opentelecrm.app.HomeScreen
import com.opentelecrm.core.auth.SessionManager
import com.opentelecrm.feature.auth.LoginRoute
import com.opentelecrm.feature.auth.OnboardingRoute
import com.opentelecrm.feature.dialer.DialerRoute
import com.opentelecrm.feature.inbox.InboxRoute
import com.opentelecrm.feature.leads.LeadDetailRoute
import com.opentelecrm.feature.leads.LeadsRoute
import com.opentelecrm.feature.leads.TeamRoute
import com.opentelecrm.feature.settings.SettingsRoute

object Routes {
    const val ONBOARDING = "onboarding"
    const val LOGIN = "login"
    const val HOME = "home"
    const val LEADS = "leads"
    const val LEAD_DETAIL = "leads/{leadId}"
    const val TEAM = "team"
    const val DIALER = "dialer"
    const val INBOX = "inbox"
    const val SETTINGS = "settings"

    fun leadDetail(leadId: String) = "leads/$leadId"
}

/**
 * App navigation. Start destination is session-gated: signed-in users land on
 * the leads list; otherwise onboarding. The NavHost is keyed on the session
 * state so the graph is rebuilt when the user signs in/out.
 *
 * NOTE: HomeScreen remains registered for M0 compat but the post-login landing
 * is the leads list (M1).
 */
@Composable
fun AppNavHost(
    sessionManager: SessionManager,
    deepLink: android.net.Uri? = null,
) {
    val navController = rememberNavController()
    val session by sessionManager.session.collectAsStateWithLifecycle()
    val startDestination = if (session != null) Routes.LEADS else Routes.ONBOARDING

    // M4: handle opentelecrm://lead/{leadId} deep links (push taps).
    val deepLinkLeadId = remember(deepLink) {
        deepLink?.let { uri ->
            if (uri.scheme == "opentelecrm" && uri.host == "lead") {
                uri.pathSegments.firstOrNull()
            } else null
        }
    }
    LaunchedEffect(deepLinkLeadId, session != null) {
        val leadId = deepLinkLeadId ?: return@LaunchedEffect
        if (session == null) return@LaunchedEffect
        navController.navigate(Routes.leadDetail(leadId)) {
            launchSingleTop = true
        }
    }

    key(session != null) {
        NavHost(
            navController = navController,
            startDestination = startDestination,
        ) {
            composable(Routes.ONBOARDING) {
                OnboardingRoute(onSaved = { navController.navigate(Routes.LOGIN) })
            }
            composable(Routes.LOGIN) {
                LoginRoute(
                    onLoggedIn = {
                        navController.navigate(Routes.LEADS) {
                            popUpTo(Routes.ONBOARDING) { inclusive = true }
                        }
                    },
                )
            }
            composable(Routes.HOME) {
                HomeScreen(
                    onNavigateToLeads = { navController.navigate(Routes.LEADS) },
                    onNavigateToSettings = { navController.navigate(Routes.SETTINGS) },
                )
            }
            composable(Routes.LEADS) {
                LeadsRoute(
                    onLeadClick = { leadId -> navController.navigate(Routes.leadDetail(leadId)) },
                    onOpenTeam = { navController.navigate(Routes.TEAM) },
                    onOpenDialer = { navController.navigate(Routes.DIALER) },
                    onOpenInbox = { navController.navigate(Routes.INBOX) },
                    onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                )
            }
            composable(Routes.DIALER) {
                DialerRoute(onBack = { navController.popBackStack() })
            }
            composable(Routes.INBOX) {
                InboxRoute(onBack = { navController.popBackStack() })
            }
            composable(
                route = Routes.LEAD_DETAIL,
                arguments = listOf(navArgument("leadId") { type = NavType.StringType }),
            ) {
                LeadDetailRoute(
                    leadId = it.arguments?.getString("leadId").orEmpty(),
                    onBack = { navController.popBackStack() },
                )
            }
            composable(Routes.TEAM) {
                TeamRoute(onBack = { navController.popBackStack() })
            }
            composable(Routes.SETTINGS) { SettingsRoute() }
        }
    }
}
