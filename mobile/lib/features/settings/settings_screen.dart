import 'package:flutter/material.dart';

import '../../config/api_client.dart';
import '../../config/theme_controller.dart';
import '../../widgets.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final api = ApiClient.instance;

  void _snack(String msg) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _editName() async {
    final controller = TextEditingController(text: api.currentFullName ?? '');
    final newName = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit name'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Display name'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (newName == null || newName.isEmpty || newName == api.currentFullName) return;
    try {
      await api.updateProfile(fullName: newName);
      if (mounted) setState(() {});
      _snack('Name updated.');
    } catch (e) {
      _snack('$e');
    }
  }

  Future<void> _changePassword() async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ChangePasswordSheet(),
    );
    if (changed == true) _snack('Password changed.');
  }

  @override
  Widget build(BuildContext context) {
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
                  subtitle: Text(
                    api.currentFullName?.isNotEmpty == true ? api.currentFullName! : 'Not set',
                    style: TextStyle(color: muted),
                  ),
                  trailing: const Icon(Icons.edit_outlined),
                  onTap: _editName,
                ),
                const Divider(height: 1),
                ListTile(title: const Text('Email'), trailing: Text(api.currentEmail ?? '—')),
                const Divider(height: 1),
                ListTile(title: const Text('Role'), trailing: Text(api.role)),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.lock_outline),
                  title: const Text('Change password'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: _changePassword,
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

class _ChangePasswordSheet extends StatefulWidget {
  const _ChangePasswordSheet();

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_current.text.isEmpty) {
      setState(() => _error = 'Enter your current password.');
      return;
    }
    if (_next.text.length < 6) {
      setState(() => _error = 'New password must be at least 6 characters.');
      return;
    }
    if (_next.text != _confirm.text) {
      setState(() => _error = 'New passwords do not match.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ApiClient.instance.changePassword(_current.text, _next.text);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() {
        _error = '$e';
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Change password', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
            ),
          TextField(
            controller: _current,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Current password'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _next,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'New password'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _confirm,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Confirm new password'),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Saving…' : 'Change password'),
          ),
        ],
      ),
    );
  }
}
