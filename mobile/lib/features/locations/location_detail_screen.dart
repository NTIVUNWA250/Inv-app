import 'package:flutter/material.dart';

import '../../config/api_client.dart';
import '../../models.dart';
import '../../repository.dart';
import '../../widgets.dart';
import '../items/item_detail_screen.dart';

class _Data {
  _Data(this.location, this.stock);
  final Location location;
  final List<StockLevel> stock;
}

class LocationDetailScreen extends StatefulWidget {
  const LocationDetailScreen({super.key, required this.locationId});
  final String locationId;

  @override
  State<LocationDetailScreen> createState() => _LocationDetailScreenState();
}

class _LocationDetailScreenState extends State<LocationDetailScreen> {
  final _repo = const InventoryRepository();
  late Future<_Data> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Data> _load() async {
    final results = await Future.wait([
      _repo.fetchLocation(widget.locationId),
      _repo.fetchStockAtLocation(widget.locationId),
    ]);
    return _Data(results[0] as Location, results[1] as List<StockLevel>);
  }

  Future<void> _refresh() async {
    final f = _load();
    setState(() => _future = f);
    await f;
  }

  Future<void> _deleteLocation(Location loc) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Remove "${loc.name}"?'),
        content: const Text('This only works if no stock references it.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remove')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _repo.deleteLocation(loc.id);
      if (mounted) Navigator.of(context).pop();
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
      appBar: AppBar(title: const Text('Location')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_Data>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(children: [
                const SizedBox(height: 80),
                Center(child: Text('${snap.error}')),
              ]);
            }
            final data = snap.data!;
            final rows = [...data.stock]
              ..sort((a, b) => (a.itemName ?? '').compareTo(b.itemName ?? ''));
            final units = rows.fold<int>(0, (s, r) => s + r.quantity);

            return ListView(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(data.location.name,
                              style: Theme.of(context).textTheme.headlineSmall),
                          const SizedBox(height: 4),
                          Text('${rows.length} items · $units units',
                              style: TextStyle(
                                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                    if (isAdmin)
                      IconButton(
                        tooltip: 'Remove location',
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () => _deleteLocation(data.location),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                SectionCard(
                  title: 'Items here',
                  child: rows.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(24),
                          child: Center(child: Text('No items stored here yet.')),
                        )
                      : Column(
                          children: [
                            for (final r in rows)
                              ListTile(
                                title: Text(r.itemName ?? r.itemId),
                                subtitle: Text(r.itemSku ?? 'No SKU'),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text('${r.quantity}'),
                                    const SizedBox(width: 10),
                                    StatusChip(quantity: r.quantity),
                                  ],
                                ),
                                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                                  builder: (_) => ItemDetailScreen(itemId: r.itemId),
                                )).then((_) => _refresh()),
                              ),
                          ],
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
