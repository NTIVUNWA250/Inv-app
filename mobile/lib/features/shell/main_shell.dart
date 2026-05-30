import 'package:flutter/material.dart';

import '../../config/api_client.dart';
import '../dashboard/dashboard_screen.dart';
import '../locations/locations_screen.dart';
import '../items/items_admin_screen.dart';
import '../users/users_screen.dart';
import '../settings/settings_screen.dart';

/// Bottom-navigation shell. Tabs depend on the user's role: members get
/// Home / Locations / Settings; admins also get Items and Users.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final isAdmin = ApiClient.instance.isAdmin;

    final tabs = <_Tab>[
      _Tab('Home', Icons.home_outlined, Icons.home, const DashboardScreen()),
      _Tab('Locations', Icons.warehouse_outlined, Icons.warehouse, const LocationsScreen()),
      if (isAdmin)
        _Tab('Items', Icons.inventory_2_outlined, Icons.inventory_2, const ItemsAdminScreen()),
      if (isAdmin)
        _Tab('Users', Icons.group_outlined, Icons.group, const UsersScreen()),
      _Tab('Settings', Icons.settings_outlined, Icons.settings, const SettingsScreen()),
    ];

    final index = _index.clamp(0, tabs.length - 1);

    return Scaffold(
      body: IndexedStack(
        index: index,
        children: tabs.map((t) => t.screen).toList(),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final t in tabs)
            NavigationDestination(
              icon: Icon(t.icon),
              selectedIcon: Icon(t.selectedIcon),
              label: t.label,
            ),
        ],
      ),
    );
  }
}

class _Tab {
  _Tab(this.label, this.icon, this.selectedIcon, this.screen);
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final Widget screen;
}
