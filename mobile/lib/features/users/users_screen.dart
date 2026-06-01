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

  List<Profile> _profiles = [];
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final profiles = await _users.fetchProfiles();
      if (!mounted) return;
      setState(() {
        _profiles = profiles;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _refresh() => _load();

  void _snack(String msg) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _changeRole(Profile p, String role) async {
    if (role == p.role) return;
    try {
      // Apply the server's response directly rather than re-fetching, so a
      // stale cached GET /profiles can't make the change appear to revert.
      final updated = await _users.changeRole(p.id, role);
      if (!mounted) return;
      setState(() {
        final i = _profiles.indexWhere((x) => x.id == p.id);
        if (i != -1) _profiles[i] = updated;
      });
      _snack('${updated.fullName ?? 'User'} is now ${updated.role}.');
    } catch (e) {
      _snack('$e');
    }
  }

  Future<void> _toggleBlock(Profile p) async {
    final verb = p.blocked ? 'Unblock' : 'Block';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$verb ${p.fullName ?? 'this user'}?'),
        content: Text(p.blocked
            ? 'They will be able to sign in and use the app again.'
            : 'They will be signed out and blocked from using the app until unblocked.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(verb)),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _users.setBlocked(p.id, !p.blocked);
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

  Future<void> _openEditSheet(Profile p) async {
    final updated = await showModalBottomSheet<Profile>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _EditUserSheet(profile: p),
    );
    if (updated == null || !mounted) return;
    setState(() {
      final i = _profiles.indexWhere((x) => x.id == updated.id);
      if (i != -1) _profiles[i] = updated;
    });
    _snack('${updated.fullName ?? 'User'} updated.');
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
        child: Builder(
          builder: (context) {
            if (_loading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (_error != null) {
              return ListView(children: [const SizedBox(height: 80), Center(child: Text('$_error'))]);
            }
            final profiles = _profiles;
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
                  title: Row(
                    children: [
                      Flexible(child: Text(p.fullName ?? '—')),
                      if (p.blocked) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text('Blocked',
                              style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFB45309))),
                        ),
                      ],
                    ],
                  ),
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
                          tooltip: 'Edit user',
                          icon: const Icon(Icons.edit_outlined),
                          onPressed: () => _openEditSheet(p),
                        ),
                      if (!isSelf)
                        IconButton(
                          tooltip: p.blocked ? 'Unblock' : 'Block',
                          icon: Icon(p.blocked ? Icons.check_circle_outline : Icons.block),
                          color: p.blocked ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                          onPressed: () => _toggleBlock(p),
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

/// Admin edit of another user's name, email, and/or password. Pops the updated
/// [Profile] on success; only the fields that were filled in are changed.
class _EditUserSheet extends StatefulWidget {
  const _EditUserSheet({required this.profile});

  final Profile profile;

  @override
  State<_EditUserSheet> createState() => _EditUserSheetState();
}

class _EditUserSheetState extends State<_EditUserSheet> {
  final _users = const UsersRepository();
  late final TextEditingController _name =
      TextEditingController(text: widget.profile.fullName ?? '');
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final email = _email.text.trim();
    final password = _password.text;
    if (name.isEmpty && email.isEmpty && password.isEmpty) {
      setState(() => _error = 'Fill in at least one field to update.');
      return;
    }
    if (password.isNotEmpty && password.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await _users.updateUser(
        widget.profile.id,
        fullName: name,
        email: email,
        password: password,
      );
      if (mounted) Navigator.pop(context, updated);
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
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Edit ${widget.profile.fullName ?? 'user'}',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
            ),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full name')),
          const SizedBox(height: 12),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email',
              hintText: 'Leave blank to keep current',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            decoration: const InputDecoration(
              labelText: 'New password',
              hintText: 'Leave blank to keep current',
            ),
          ),
          const SizedBox(height: 8),
          Text('Only the fields you fill in will change.',
              style: TextStyle(fontSize: 12, color: muted)),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Saving…' : 'Save changes'),
          ),
        ],
      ),
    );
  }
}
