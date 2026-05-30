import 'package:flutter/material.dart';

import '../../config/api_client.dart';
import '../../models.dart';
import '../../repository.dart';
import 'location_detail_screen.dart';

class _Data {
  _Data(this.locations, this.stock);
  final List<Location> locations;
  final List<StockLevel> stock;
}

class LocationsScreen extends StatefulWidget {
  const LocationsScreen({super.key});

  @override
  State<LocationsScreen> createState() => _LocationsScreenState();
}

class _LocationsScreenState extends State<LocationsScreen> {
  final _repo = const InventoryRepository();
  late Future<_Data> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Data> _load() async {
    final results = await Future.wait([_repo.fetchLocations(), _repo.fetchStock()]);
    return _Data(results[0] as List<Location>, results[1] as List<StockLevel>);
  }

  Future<void> _refresh() async {
    final f = _load();
    setState(() => _future = f);
    await f;
  }

  Future<void> _addLocation() async {
    final name = await _promptName(context);
    if (name == null || name.trim().isEmpty) return;
    try {
      await _repo.createLocation(name.trim());
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = ApiClient.instance.isAdmin;
    return Scaffold(
      appBar: AppBar(title: const Text('Locations')),
      floatingActionButton: isAdmin
          ? FloatingActionButton.extended(
              onPressed: _addLocation,
              icon: const Icon(Icons.add),
              label: const Text('Location'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_Data>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return _scrollMessage("Couldn't load locations:\n${snap.error}");
            }
            final data = snap.data!;
            if (data.locations.isEmpty) {
              return _scrollMessage('No locations yet.');
            }

            final units = <String, int>{};
            final items = <String, Set<String>>{};
            for (final s in data.stock) {
              units[s.locationId] = (units[s.locationId] ?? 0) + s.quantity;
              if (s.quantity > 0) {
                (items[s.locationId] ??= <String>{}).add(s.itemId);
              }
            }

            return ListView.separated(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: data.locations.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final loc = data.locations[i];
                return Card(
                  child: ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.warehouse_outlined)),
                    title: Text(loc.name),
                    subtitle: Text(
                      '${items[loc.id]?.length ?? 0} items · ${units[loc.id] ?? 0} units',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => LocationDetailScreen(locationId: loc.id),
                    )).then((_) => _refresh()),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  Widget _scrollMessage(String text) {
    return ListView(
      children: [
        const SizedBox(height: 80),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Center(child: Text(text, textAlign: TextAlign.center)),
        ),
      ],
    );
  }
}

Future<String?> _promptName(BuildContext context) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('New location'),
      content: TextField(
        controller: controller,
        autofocus: true,
        decoration: const InputDecoration(labelText: 'Name', hintText: 'e.g. Lab B'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text),
          child: const Text('Add'),
        ),
      ],
    ),
  );
}
