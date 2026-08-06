package com.opentelecrm.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable

/**
 * Standard M3 template shape: picks light/dark scheme from system setting.
 */
@Composable
fun OpenTeleCRMTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content,
    )
}

/**
 * Entry point used by the app: allows an explicit [ColorScheme] override.
 */
@Composable
fun AppTheme(
    colorScheme: ColorScheme = if (isSystemInDarkTheme()) DarkColorScheme else LightColorScheme,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content,
    )
}
