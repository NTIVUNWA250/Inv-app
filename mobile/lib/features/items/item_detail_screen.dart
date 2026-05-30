import 'package:flutter/material.dart';

import '../../config/api_client.dart';
import '../../config/theme.dart';
import '../../models.dart';
import '../../repository.dart';
import '../../widgets.dart';

class _Data {
  _Data(this.item, this.stock, this.movements, this.profiles, this.locations);
  final Item item;
  final List<StockLevel> stock;
  final List<Movement> movements;
  final List<Profile> profiles;
  final List<Location> locations;
}

class ItemDetailScreen extends StatefulWidget {
  const ItemDetailScreen({super.key, required this.itemId});
  final String itemId;

  @override
  State<ItemDetailScreen> createState() => _ItemDetailScreenState();
}

class _ItemDetailScreenState extends State<ItemDetailScreen> {
  final _repo = const InventoryRepository();
  final _users = const UsersRepository();
  late Future<_Data> _future;

  String? _selectedLocationId;
  int _quantity = 1;
  bool _working = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Data> _load() async {
    final results = await Future.wait([
      _repo.fetchItem(widget.itemId),
      _repo.fetchItemStock(widget.itemId),
      _repo.fetchMovements(widget.itemId),
      _users.fetchProfiles(),
      _repo.fetchLocations(),
    ]);
    final data = _Data(
      results[0] as Item,
      results[1] as List<StockLevel>,
      results[2] as List<Movement>,
      results[3] as List<Profile>,
      results[4] as List<Location>,
    );
    _selectedLocationId ??= data.locations.isNotEmpty ? data.locations.first.id : null;
    return data;
  }

  Future<void> _refresh() async {
    final f = _load();
    setState(() => _future = f);
    await f;
  }

  Future<void> _move(bool checkout) async {
    final locationId = _selectedLocationId;
    if (locationId == null) {
      _snack('Choose a location.');
      return;
    }
    if (_quantity <= 0) {
      _snack('Enter a quantity of at least 1.');
      return;
    }
    setState(() => _working = true);
    try {
      await _repo.recordMovement(
        itemId: widget.itemId,
        locationId: locationId,
        quantity: _quantity,
        checkout: checkout,
      );
      await _refresh();
    } catch (e) {
      _snack('$e');
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _deleteItem(Item item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete "${item.name}"?'),
        content: const Text('Removes it from the catalog and all its stock.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _repo.deleteItem(item.id);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      _snack('$e');
    }
  }

  void _snack(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = ApiClient.instance.isAdmin;
    return Scaffold(
      appBar: AppBar(title: const Text('Item')),
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
            final muted = Theme.of(context).colorScheme.onSurfaceVariant;
            final nameById = {for (final p in data.profiles) p.id: p.fullName};
            final total = data.stock.fold<int>(0, (s, r) => s + r.quantity);

            return ListView(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(data.item.name,
                              style: Theme.of(context).textTheme.headlineSmall),
                          const SizedBox(height: 4),
                          Text(
                            data.item.sku != null ? 'SKU ${data.item.sku}' : 'No SKU',
                            style: TextStyle(color: muted),
                          ),
                          if (data.item.description != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(data.item.description!, style: TextStyle(color: muted)),
                            ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('$total',
                            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
                        Text('in stock', style: TextStyle(fontSize: 12, color: muted)),
                        const SizedBox(height: 6),
                        StatusChip(quantity: total),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                SectionCard(
                  title: 'Where it is',
                  child: data.stock.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(20),
                          child: Center(child: Text('Not stored anywhere yet.')),
                        )
                      : Column(
                          children: [
                            for (final s in data.stock)
                              ListTile(
                                leading: const Icon(Icons.place_outlined),
                                title: Text(s.locationName ?? s.locationId),
                                trailing: Text('${s.quantity}'),
                              ),
                          ],
                        ),
                ),
                const SizedBox(height: 16),

                _MovementCard(
                  locations: data.locations,
                  selectedLocationId: _selectedLocationId,
                  quantity: _quantity,
                  working: _working,
                  onLocationChanged: (v) => setState(() => _selectedLocationId = v),
                  onQuantityChanged: (v) => setState(() => _quantity = v),
                  onTake: () => _move(true),
                  onReturn: () => _move(false),
                ),
                const SizedBox(height: 16),

                SectionCard(
                  title: 'Activity',
                  trailing: Text('who took what',
                      style: TextStyle(fontSize: 12, color: muted)),
                  child: data.movements.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(20),
                          child: Center(child: Text('No activity yet.')),
                        )
                      : Column(
                          children: [
                            for (final m in data.movements)
                              ListTile(
                                leading: Icon(
                                  m.delta < 0 ? Icons.arrow_upward : Icons.arrow_downward,
                                  color: m.delta < 0 ? StatusColors.low : StatusColors.ok,
                                ),
                                title: Text(nameById[m.userId] ?? 'Unknown'),
                                subtitle: Text(
                                  '${m.delta < 0 ? 'Took ${-m.delta}' : 'Added ${m.delta}'}'
                                  ' · ${m.locationName ?? '—'}',
                                ),
                                trailing: Text(
                                  _formatDate(m.createdAt),
                                  style: TextStyle(fontSize: 12, color: muted),
                                ),
                              ),
                          ],
                        ),
                ),

                if (isAdmin) ...[
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(foregroundColor: StatusColors.out),
                    onPressed: () => _deleteItem(data.item),
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Delete item'),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

String _formatDate(DateTime dt) {
  final d = dt.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}-${two(d.month)}-${two(d.day)} ${two(d.hour)}:${two(d.minute)}';
}

class _MovementCard extends StatelessWidget {
  const _MovementCard({
    required this.locations,
    required this.selectedLocationId,
    required this.quantity,
    required this.working,
    required this.onLocationChanged,
    required this.onQuantityChanged,
    required this.onTake,
    required this.onReturn,
  });

  final List<Location> locations;
  final String? selectedLocationId;
  final int quantity;
  final bool working;
  final ValueChanged<String?> onLocationChanged;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onTake;
  final VoidCallback onReturn;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Take or return stock',
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: locations.isEmpty
            ? const Text('No locations exist yet, so stock can\'t be moved.')
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: selectedLocationId,
                    decoration: const InputDecoration(labelText: 'Location'),
                    items: [
                      for (final loc in locations)
                        DropdownMenuItem(value: loc.id, child: Text(loc.name)),
                    ],
                    onChanged: onLocationChanged,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    initialValue: '$quantity',
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Quantity'),
                    onChanged: (v) => onQuantityChanged(int.tryParse(v) ?? 0),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: working ? null : onTake,
                          icon: const Icon(Icons.arrow_upward),
                          label: const Text('Take'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: working ? null : onReturn,
                          icon: const Icon(Icons.arrow_downward),
                          label: const Text('Return'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
      ),
    );
  }
}
