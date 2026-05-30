import 'package:flutter/material.dart';

import '../../config/api_client.dart';
import '../../models.dart';
import '../../repository.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  final _users = const UsersRepository();
  late Future<List<Profile>> _future;

  @override
  void initState() {
    super.initState();
    _future = _users.fetchProfiles();
  }

  Future<void> _refresh() async {
    final f = _users.fetchProfiles();
    setState(() => _future = f);
    await f;
  }

  void _snack(String msg) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _changeRole(Profile p, String role) async {
    if (role == p.role) return;
    try {
      await _users.changeRole(p.id, role);
      await _refresh();
    } catch (e) {
      _snack('$e');
    }
  }

  Future<void> _delete(Profile p) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete ${p.fullName ?? 'this user'}?'),
        content: const Text('This permanently removes the account.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _users.deleteUser(p.id);
      await _refresh();
    } catch (e) {
      _snack('$e');
    }
  }

  Future<void> _openAddSheet() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _AddUserSheet(),
    );
    if (added == true) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final myId = ApiClient.instance.currentUserId;
    return Scaffold(
      appBar: AppBar(title: const Text('Users')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAddSheet,
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Add user'),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Profile>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(children: [const SizedBox(height: 80), Center(child: Text('${snap.error}'))]);
            }
            final profiles = snap.data!;
            if (profiles.isEmpty) {
              return ListView(children: const [SizedBox(height: 80), Center(child: Text('No users found.'))]);
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: profiles.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final p = profiles[i];
                final isSelf = p.id == myId;
                return ListTile(
                  title: Text(p.fullName ?? '—'),
                  subtitle: Text(isSelf ? 'You' : 'Joined ${_date(p.createdAt)}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      DropdownButton<String>(
                        value: p.role,
                        underline: const SizedBox.shrink(),
                        onChanged: isSelf ? null : (v) => _changeRole(p, v!),
                        items: const [
                          DropdownMenuItem(value: 'member', child: Text('member')),
                          DropdownMenuItem(value: 'admin', child: Text('admin')),
                        ],
                      ),
                      if (!isSelf)
                        IconButton(
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () => _delete(p),
                        ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

String _date(DateTime? dt) {
  if (dt == null) return '—';
  final d = dt.toLocal();
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class _AddUserSheet extends StatefulWidget {
  const _AddUserSheet();

  @override
  State<_AddUserSheet> createState() => _AddUserSheetState();
}

class _AddUserSheetState extends State<_AddUserSheet> {
  final _users = const UsersRepository();
  final _email = TextEditingController();
  final _name = TextEditingController();
  final _password = TextEditingController();
  String _role = 'member';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _name.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final email = _email.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Email is required.');
      return;
    }
    if (_password.text.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _users.createUser(
        email: email,
        password: _password.text,
        fullName: _name.text.trim(),
        role: _role,
      );
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
          Text('Add user', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
            ),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 12),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full name (optional)')),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            decoration: const InputDecoration(labelText: 'Temporary password'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _role,
            decoration: const InputDecoration(labelText: 'Role'),
            items: const [
              DropdownMenuItem(value: 'member', child: Text('member')),
              DropdownMenuItem(value: 'admin', child: Text('admin')),
            ],
            onChanged: (v) => setState(() => _role = v ?? 'member'),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Creating…' : 'Create user'),
          ),
          const SizedBox(height: 8),
          Text(
            'Requires the API service-role key to be configured.',
            style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}
