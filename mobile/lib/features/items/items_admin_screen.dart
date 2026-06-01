import 'package:flutter/material.dart';

import '../../models.dart';
import '../../repository.dart';
import '../../widgets.dart';
import 'item_detail_screen.dart';

class _Data {
  _Data(this.items, this.locations, this.quantityByItem);
  final List<Item> items;
  final List<Location> locations;
  final Map<String, int> quantityByItem;
}

class ItemsAdminScreen extends StatefulWidget {
  const ItemsAdminScreen({super.key});

  @override
  State<ItemsAdminScreen> createState() => _ItemsAdminScreenState();
}

class _ItemsAdminScreenState extends State<ItemsAdminScreen> {
  final _repo = const InventoryRepository();
  late Future<_Data> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Data> _load() async {
    final results = await Future.wait([
      _repo.fetchItems(),
      _repo.fetchLocations(),
      _repo.fetchStock(),
    ]);
    final stock = results[2] as List<StockLevel>;
    final quantityByItem = <String, int>{};
    for (final s in stock) {
      quantityByItem[s.itemId] = (quantityByItem[s.itemId] ?? 0) + s.quantity;
    }
    return _Data(results[0] as List<Item>, results[1] as List<Location>, quantityByItem);
  }

  Future<void> _refresh() async {
    final f = _load();
    setState(() => _future = f);
    await f;
  }

  Future<void> _openAddSheet(List<Location> locations) async {
    if (locations.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create a location first (Locations tab).')),
      );
      return;
    }
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddItemSheet(locations: locations),
    );
    if (added == true) await _refresh();
  }

  Future<void> _delete(Item item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete "${item.name}"?'),
        content: const Text('This can\'t be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _repo.deleteItem(item.id);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Items')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_Data>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(children: [const SizedBox(height: 80), Center(child: Text('${snap.error}'))]);
            }
            final data = snap.data!;
            return Column(
              children: [
                if (data.items.isEmpty)
                  const Expanded(child: Center(child: Text('No items yet. Tap + to add one.')))
                else
                  Expanded(
                    child: ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      itemCount: data.items.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final item = data.items[i];
                        final quantity = data.quantityByItem[item.id] ?? 0;
                        return ListTile(
                          title: Text(item.name),
                          subtitle: Text(item.sku ?? 'No SKU'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('$quantity'),
                              const SizedBox(width: 8),
                              StatusChip(quantity: quantity),
                              const SizedBox(width: 4),
                              IconButton(
                                icon: const Icon(Icons.delete_outline),
                                onPressed: () => _delete(item),
                              ),
                            ],
                          ),
                          onTap: () => Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => ItemDetailScreen(itemId: item.id),
                          )).then((_) => _refresh()),
                        );
                      },
                    ),
                  ),
              ],
            );
          },
        ),
      ),
      floatingActionButton: FutureBuilder<_Data>(
        future: _future,
        builder: (context, snap) => FloatingActionButton.extended(
          onPressed: snap.hasData ? () => _openAddSheet(snap.data!.locations) : null,
          icon: const Icon(Icons.add),
          label: const Text('Add item'),
        ),
      ),
    );
  }
}

class _AddItemSheet extends StatefulWidget {
  const _AddItemSheet({required this.locations});
  final List<Location> locations;

  @override
  State<_AddItemSheet> createState() => _AddItemSheetState();
}

class _AddItemSheetState extends State<_AddItemSheet> {
  final _repo = const InventoryRepository();
  final _name = TextEditingController();
  final _sku = TextEditingController();
  final _description = TextEditingController();
  late String _locationId = widget.locations.first.id;
  int _quantity = 1;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _sku.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Name is required.');
      return;
    }
    if (_quantity <= 0) {
      setState(() => _error = 'Quantity must be at least 1.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _repo.createItem(
        name: name,
        sku: _sku.text.trim(),
        description: _description.text.trim(),
        locationId: _locationId,
        quantity: _quantity,
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
          Text('Add item', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
            ),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
          const SizedBox(height: 12),
          TextField(controller: _sku, decoration: const InputDecoration(labelText: 'SKU (optional)')),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            decoration: const InputDecoration(labelText: 'Description (optional)'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _locationId,
            decoration: const InputDecoration(labelText: 'Location'),
            items: [
              for (final loc in widget.locations)
                DropdownMenuItem(value: loc.id, child: Text(loc.name)),
            ],
            onChanged: (v) => setState(() => _locationId = v ?? _locationId),
          ),
          const SizedBox(height: 12),
          TextFormField(
            initialValue: '1',
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Initial quantity'),
            onChanged: (v) => _quantity = int.tryParse(v) ?? 0,
          ),
          const SizedBox(height: 8),
          Text(
            'Every item must be assigned to a location with a starting quantity.',
            style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Adding…' : 'Add item'),
          ),
        ],
      ),
    );
  }
}
