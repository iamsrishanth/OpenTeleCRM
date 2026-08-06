package com.opentelecrm.core.designsystem

import androidx.compose.ui.graphics.Color

// Light scheme — professional CRM: neutral slate background, deep indigo accent, white surface.
val IndigoPrimary = Color(0xFF4F46E5)
val OnIndigoPrimary = Color(0xFFFFFFFF)
val IndigoPrimaryContainer = Color(0xFFE0E7FF)
val OnIndigoPrimaryContainer = Color(0xFF1E1B4B)

val SlateSecondary = Color(0xFF64748B)
val OnSlateSecondary = Color(0xFFFFFFFF)
val SlateSecondaryContainer = Color(0xFFE2E8F0)
val OnSlateSecondaryContainer = Color(0xFF1E293B)

val TealTertiary = Color(0xFF0D9488)
val OnTealTertiary = Color(0xFFFFFFFF)
val TealTertiaryContainer = Color(0xFFCCFBF1)
val OnTealTertiaryContainer = Color(0xFF042F2E)

val SlateBackgroundLight = Color(0xFFF8FAFC)
val OnSlateBackgroundLight = Color(0xFF0F172A)
val WhiteSurface = Color(0xFFFFFFFF)
val OnWhiteSurface = Color(0xFF0F172A)
val SlateSurfaceVariantLight = Color(0xFFE2E8F0)
val OnSlateSurfaceVariantLight = Color(0xFF475569)
val SlateOutlineLight = Color(0xFF94A3B8)
val SlateOutlineVariantLight = Color(0xFFCBD5E1)

// Dark scheme — deep slate background, lighter indigo accent.
val IndigoPrimaryDark = Color(0xFFA5B4FC)
val OnIndigoPrimaryDark = Color(0xFF1E1B4B)
val IndigoPrimaryContainerDark = Color(0xFF312E81)
val OnIndigoPrimaryContainerDark = Color(0xFFE0E7FF)

val SlateSecondaryDark = Color(0xFF94A3B8)
val OnSlateSecondaryDark = Color(0xFF1E293B)
val SlateSecondaryContainerDark = Color(0xFF334155)
val OnSlateSecondaryContainerDark = Color(0xFFCBD5E1)

val TealTertiaryDark = Color(0xFF2DD4BF)
val OnTealTertiaryDark = Color(0xFF042F2E)
val TealTertiaryContainerDark = Color(0xFF134E4A)
val OnTealTertiaryContainerDark = Color(0xFF99F6E4)

val SlateBackgroundDark = Color(0xFF0F172A)
val OnSlateBackgroundDark = Color(0xFFE2E8F0)
val SlateSurfaceDark = Color(0xFF111827)
val OnSlateSurfaceDark = Color(0xFFE2E8F0)
val SlateSurfaceVariantDark = Color(0xFF334155)
val OnSlateSurfaceVariantDark = Color(0xFF94A3B8)
val SlateOutlineDark = Color(0xFF64748B)
val SlateOutlineVariantDark = Color(0xFF475569)

// Error — standard M3 values.
val ErrorLight = Color(0xFFB3261E)
val OnErrorLight = Color(0xFFFFFFFF)
val ErrorContainerLight = Color(0xFFF9DEDC)
val OnErrorContainerLight = Color(0xFF410E0B)

val ErrorDark = Color(0xFFF2B8B5)
val OnErrorDark = Color(0xFF601410)
val ErrorContainerDark = Color(0xFF8C1D18)
val OnErrorContainerDark = Color(0xFFF9DEDC)

val LightColorScheme = androidx.compose.material3.lightColorScheme(
    primary = IndigoPrimary,
    onPrimary = OnIndigoPrimary,
    primaryContainer = IndigoPrimaryContainer,
    onPrimaryContainer = OnIndigoPrimaryContainer,
    secondary = SlateSecondary,
    onSecondary = OnSlateSecondary,
    secondaryContainer = SlateSecondaryContainer,
    onSecondaryContainer = OnSlateSecondaryContainer,
    tertiary = TealTertiary,
    onTertiary = OnTealTertiary,
    tertiaryContainer = TealTertiaryContainer,
    onTertiaryContainer = OnTealTertiaryContainer,
    error = ErrorLight,
    onError = OnErrorLight,
    errorContainer = ErrorContainerLight,
    onErrorContainer = OnErrorContainerLight,
    background = SlateBackgroundLight,
    onBackground = OnSlateBackgroundLight,
    surface = WhiteSurface,
    onSurface = OnWhiteSurface,
    surfaceVariant = SlateSurfaceVariantLight,
    onSurfaceVariant = OnSlateSurfaceVariantLight,
    outline = SlateOutlineLight,
    outlineVariant = SlateOutlineVariantLight,
)

val DarkColorScheme = androidx.compose.material3.darkColorScheme(
    primary = IndigoPrimaryDark,
    onPrimary = OnIndigoPrimaryDark,
    primaryContainer = IndigoPrimaryContainerDark,
    onPrimaryContainer = OnIndigoPrimaryContainerDark,
    secondary = SlateSecondaryDark,
    onSecondary = OnSlateSecondaryDark,
    secondaryContainer = SlateSecondaryContainerDark,
    onSecondaryContainer = OnSlateSecondaryContainerDark,
    tertiary = TealTertiaryDark,
    onTertiary = OnTealTertiaryDark,
    tertiaryContainer = TealTertiaryContainerDark,
    onTertiaryContainer = OnTealTertiaryContainerDark,
    error = ErrorDark,
    onError = OnErrorDark,
    errorContainer = ErrorContainerDark,
    onErrorContainer = OnErrorContainerDark,
    background = SlateBackgroundDark,
    onBackground = OnSlateBackgroundDark,
    surface = SlateSurfaceDark,
    onSurface = OnSlateSurfaceDark,
    surfaceVariant = SlateSurfaceVariantDark,
    onSurfaceVariant = OnSlateSurfaceVariantDark,
    outline = SlateOutlineDark,
    outlineVariant = SlateOutlineVariantDark,
)
