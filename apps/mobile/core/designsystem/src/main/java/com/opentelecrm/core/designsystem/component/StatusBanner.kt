package com.opentelecrm.core.designsystem.component

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Small offline/error banner used by auth screens.
 *
 * @param isError when true the banner uses the error container colors; otherwise
 * it renders in a neutral surface-variant tone (e.g. informational/offline states).
 */
@Composable
fun StatusBanner(
    message: String,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
    containerColor: Color = if (isError) {
        MaterialTheme.colorScheme.errorContainer
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    },
    contentColor: Color = if (isError) {
        MaterialTheme.colorScheme.onErrorContainer
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    },
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = containerColor,
        contentColor = contentColor,
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}
