package com.opentelecrm.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.opentelecrm.app.HomeScreen
import com.opentelecrm.core.auth.SessionManager
import com.opentelecrm.feature.attendance.AttendanceRoute
import com.opentelecrm.feature.auth.LoginRoute
import com.opentelecrm.feature.auth.OnboardingRoute
import com.opentelecrm.feature.calls.CallsRoute
import com.opentelecrm.feature.dialer.DialerRoute
import com.opentelecrm.feature.eod.EodRoute
import com.opentelecrm.feature.inbox.InboxRoute
import com.opentelecrm.feature.leads.LeadDetailRoute
import com.opentelecrm.feature.leads.LeadsRoute
import com.opentelecrm.feature.leads.TeamRoute
import com.opentelecrm.feature.settings.SettingsRoute
import com.opentelecrm.feature.tasks.TasksRoute
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone

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
    const val ATTENDANCE = "attendance"
    const val EOD = "eod"
    const val TASKS = "tasks"
    const val CALLS = "calls"

    fun leadDetail(leadId: String) = "leads/$leadId"
}

/** Bottom-nav destinations shown once signed in (ByteCodeEMS port adds the workforce tabs). */
private data class TabItem(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val BOTTOM_TABS = listOf(
    TabItem(Routes.LEADS, "Leads", Icons.Filled.Person),
    TabItem(Routes.ATTENDANCE, "Attendance", Icons.Filled.DateRange),
    TabItem(Routes.EOD, "EOD", Icons.Filled.Info),
    TabItem(Routes.TASKS, "Tasks", Icons.Filled.CheckCircle),
    TabItem(Routes.CALLS, "Calls", Icons.Filled.Phone),
)

/**
 * App navigation. Start destination is session-gated: signed-in users land on
 * the leads list; otherwise onboarding. The NavHost is keyed on the session
 * state so the graph is rebuilt when the user signs in/out. A bottom
 * NavigationBar surfaces the workforce tabs once signed in.
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
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.weight(1f)) {
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
                    composable(Routes.ATTENDANCE) {
                        AttendanceRoute(onBack = { navController.popBackStack() })
                    }
                    composable(Routes.EOD) {
                        EodRoute(onBack = { navController.popBackStack() })
                    }
                    composable(Routes.TASKS) {
                        TasksRoute(onBack = { navController.popBackStack() })
                    }
                    composable(Routes.CALLS) {
                        CallsRoute(onBack = { navController.popBackStack() })
                    }
                }
            }

            if (session != null) {
                val backStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = backStackEntry?.destination
                NavigationBar {
                    BOTTOM_TABS.forEach { tab ->
                        val selected = currentDestination?.hierarchy?.any { it.route == tab.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        }
    }
}
