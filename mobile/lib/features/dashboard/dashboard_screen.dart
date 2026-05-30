import 'package:flutter/material.dart';

import '../../models.dart';
import '../../repository.dart';
import '../../widgets.dart';
import '../items/item_detail_screen.dart';
import '../locations/location_detail_screen.dart';

class _Data {
  _Data(this.items, this.stock, this.locations);
  final List<Item> items;
  final List<StockLevel> stock;
  final List<Location> locations;
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _repo = const InventoryRepository();
  late Future<_Data> _future;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Data> _load() async {
    final results = await Future.wait([
      _repo.fetchItems(),
      _repo.fetchStock(),
      _repo.fetchLocations(),
    ]);
    return _Data(
      results[0] as List<Item>,
      results[1] as List<StockLevel>,
      results[2] as List<Location>,
    );
  }

  Future<void> _refresh() async {
    final f = _load();
    setState(() => _future = f);
    await f;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inventory Dashboard')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_Data>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return _ErrorState(message: '${snap.error}');
            }
            final data = snap.data!;
            return _DashboardBody(
              data: data,
              query: _query,
              onQueryChanged: (q) => setState(() => _query = q),
            );
          },
        ),
      ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({
    required this.data,
    required this.query,
    required this.onQueryChanged,
  });

  final _Data data;
  final String query;
  final ValueChanged<String> onQueryChanged;

  @override
  Widget build(BuildContext context) {
    final byItem = <String, int>{};
    final byLocation = <String, int>{};
    for (final s in data.stock) {
      byItem[s.itemId] = (byItem[s.itemId] ?? 0) + s.quantity;
      byLocation[s.locationId] = (byLocation[s.locationId] ?? 0) + s.quantity;
    }

    final totalUnits = data.stock.fold<int>(0, (sum, s) => sum + s.quantity);
    final lowCount = data.items
        .where((i) => statusForQuantity(byItem[i.id] ?? 0) != StockStatus.ok)
        .length;

    final lowStock = data.items
        .where((i) => statusForQuantity(byItem[i.id] ?? 0) != StockStatus.ok)
        .take(5)
        .toList();

    final q = query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? data.items
        : data.items
            .where((i) =>
                i.name.toLowerCase().contains(q) ||
                (i.sku ?? '').toLowerCase().contains(q))
            .toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.7,
          children: [
            StatCard(label: 'Catalog items', value: '${data.items.length}', icon: Icons.widgets_outlined),
            StatCard(label: 'Total units', value: '$totalUnits', icon: Icons.inventory_2_outlined),
            StatCard(label: 'Locations', value: '${data.locations.length}', icon: Icons.warehouse_outlined),
            StatCard(label: 'Low / out', value: '$lowCount', icon: Icons.warning_amber_outlined),
          ],
        ),
        const SizedBox(height: 16),

        SectionCard(
          title: 'Low stock items',
          child: lowStock.isEmpty
              ? const _Empty(text: 'Everything is well stocked.')
              : Column(
                  children: [
                    for (final item in lowStock)
                      _ItemTile(
                        item: item,
                        quantity: byItem[item.id] ?? 0,
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 16),

        SectionCard(
          title: 'Storage locations',
          child: data.locations.isEmpty
              ? const _Empty(text: 'No locations yet.')
              : Column(
                  children: [
                    for (final loc in data.locations)
                      ListTile(
                        leading: const Icon(Icons.warehouse_outlined),
                        title: Text(loc.name),
                        trailing: Text('${byLocation[loc.id] ?? 0} units'),
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => LocationDetailScreen(locationId: loc.id),
                        )),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 16),

        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'Search items or SKU…',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: onQueryChanged,
          ),
        ),
        SectionCard(
          title: 'Inventory',
          trailing: Text(
            q.isEmpty ? '${data.items.length} items' : '${filtered.length} of ${data.items.length}',
            style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          child: filtered.isEmpty
              ? _Empty(text: q.isEmpty ? 'No items yet.' : 'No items match "$query".')
              : Column(
                  children: [
                    for (final item in filtered)
                      _ItemTile(item: item, quantity: byItem[item.id] ?? 0),
                  ],
                ),
        ),
      ],
    );
  }
}

class _ItemTile extends StatelessWidget {
  const _ItemTile({required this.item, required this.quantity});
  final Item item;
  final int quantity;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(item.name),
      subtitle: Text(item.sku ?? 'No SKU'),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$quantity'),
          const SizedBox(width: 10),
          StatusChip(quantity: quantity),
        ],
      ),
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ItemDetailScreen(itemId: item.id),
      )),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 80),
        const Icon(Icons.error_outline, size: 40),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Text('Couldn\'t load data:\n$message', textAlign: TextAlign.center),
        ),
      ],
    );
  }
}
