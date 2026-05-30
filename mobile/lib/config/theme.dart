import 'package:flutter/material.dart';

/// Brand accent (matches the web app's pink) used as the Material seed.
const Color kAccent = Color(0xFFDB2777);

const Color _darkCanvas = Color(0xFF09090B);
const Color _darkSurface = Color(0xFF18181B);
const Color _lightCanvas = Color(0xFFF7F7F8);

ThemeData buildTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: kAccent,
    brightness: brightness,
  ).copyWith(
    surface: isDark ? _darkSurface : Colors.white,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: isDark ? _darkCanvas : _lightCanvas,
    appBarTheme: AppBarTheme(
      backgroundColor: isDark ? _darkCanvas : _lightCanvas,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: isDark ? _darkSurface : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isDark ? const Color(0xFF27272A) : const Color(0xFFE4E4E7),
        ),
      ),
      margin: EdgeInsets.zero,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: isDark ? _darkSurface : Colors.white,
      indicatorColor: kAccent.withValues(alpha: 0.18),
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(fontSize: 12, color: scheme.onSurface),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? _darkSurface : Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
    ),
  );
}

/// Colors for stock-status chips, used across screens.
class StatusColors {
  static Color bg(BuildContext context, Color base) => base.withValues(alpha: 0.15);
  static const Color out = Color(0xFFEF4444); // red
  static const Color low = Color(0xFFF59E0B); // amber
  static const Color ok = Color(0xFF10B981); // emerald
}
