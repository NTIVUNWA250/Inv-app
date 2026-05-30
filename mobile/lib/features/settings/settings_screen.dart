import 'package:flutter/material.dart';

import '../../config/api_client.dart';
import '../../config/theme_controller.dart';
import '../../widgets.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = ApiClient.instance;
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: 'Profile',
            child: Column(
              children: [
                ListTile(
                  title: const Text('Name'),
                  trailing: Text(api.currentFullName?.isNotEmpty == true
                      ? api.currentFullName!
                      : '—'),
                ),
                const Divider(height: 1),
                ListTile(title: const Text('Email'), trailing: Text(api.currentEmail ?? '—')),
                const Divider(height: 1),
                ListTile(
                  title: const Text('Role'),
                  trailing: Text(api.role),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Appearance',
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: ValueListenableBuilder<ThemeMode>(
                valueListenable: themeController.mode,
                builder: (context, mode, _) {
                  return SegmentedButton<ThemeMode>(
                    segments: const [
                      ButtonSegment(
                        value: ThemeMode.light,
                        label: Text('Light'),
                        icon: Icon(Icons.light_mode_outlined),
                      ),
                      ButtonSegment(
                        value: ThemeMode.dark,
                        label: Text('Dark'),
                        icon: Icon(Icons.dark_mode_outlined),
                      ),
                      ButtonSegment(
                        value: ThemeMode.system,
                        label: Text('System'),
                        icon: Icon(Icons.brightness_auto_outlined),
                      ),
                    ],
                    selected: {mode},
                    onSelectionChanged: (s) => themeController.set(s.first),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Account',
            child: ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Sign out'),
              subtitle: Text('End your session on this device', style: TextStyle(color: muted)),
              onTap: () => api.logout(),
            ),
          ),
        ],
      ),
    );
  }
}
