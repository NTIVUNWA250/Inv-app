import 'package:flutter/material.dart';

import '../../config/api_client.dart';
import '../../config/theme.dart';
import '../../models.dart';
import '../../repository.dart';
import '../../widgets.dart';
import 'item_qr.dart';

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

  Future<void> _move(String action) async {
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
      await _repo.moveStock(
        itemId: widget.itemId,
        locationId: locationId,
        quantity: _quantity,
        action: action,
      );
      await _refresh();
    } catch (e) {
      _snack('$e');
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _undo(Movement m) async {
    try {
      await _repo.undoMovement(m.id);
      await _refresh();
    } catch (e) {
      _snack('$e');
    }
  }

  Future<void> _toggleFinishable(Item item) async {
    try {
      await _repo.setFinishable(item.id, !item.finishable);
      await _refresh();
    } catch (e) {
      _snack('$e');
    }
  }

  Future<void> _editStock(List<StockLevel> stock) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _EditStockSheet(itemId: widget.itemId, stock: stock),
    );
    if (saved == true) await _refresh();
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
            final reversedIds = {
              for (final m in data.movements)
                if (m.reversalOf != null) m.reversalOf!,
            };
            final myId = ApiClient.instance.currentUserId;

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
                    IconButton(
                      tooltip: 'Show QR code',
                      icon: const Icon(Icons.qr_code_2),
                      onPressed: () => showItemQrDialog(context, data.item),
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
                                trailing: Text(
                                  s.capacity > 0 ? '${s.quantity} / ${s.capacity}' : '${s.quantity}',
                                ),
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
                  finishable: data.item.finishable,
                  onLocationChanged: (v) => setState(() => _selectedLocationId = v),
                  onQuantityChanged: (v) => setState(() => _quantity = v),
                  onTake: () => _move('take'),
                  onReturn: () => _move('return'),
                  onFinish: () => _move('finish'),
                  onDestroy: () => _move('destroy'),
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
                                leading: Icon(_reasonIcon(m), color: _reasonColor(m)),
                                title: Text(nameById[m.userId] ?? 'Unknown'),
                                subtitle: Text(
                                  '${_reasonLabel(m)} · ${m.locationName ?? '—'}'
                                  ' · ${_formatDate(m.createdAt)}',
                                ),
                                trailing: ((m.reason == 'finish' || m.reason == 'destroyed') &&
                                        !reversedIds.contains(m.id) &&
                                        (m.userId == myId || isAdmin))
                                    ? TextButton.icon(
                                        onPressed: () => _undo(m),
                                        icon: const Icon(Icons.undo, size: 16),
                                        label: const Text('Undo'),
                                      )
                                    : null,
                              ),
                          ],
                        ),
                ),

                if (isAdmin) ...[
                  const SizedBox(height: 16),
                  SectionCard(
                    title: 'Item settings',
                    child: SwitchListTile(
                      title: const Text('Finishable'),
                      subtitle: const Text('Anyone can permanently use this item up.'),
                      value: data.item.finishable,
                      onChanged: _working ? null : (_) => _toggleFinishable(data.item),
                    ),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: data.stock.isEmpty ? null : () => _editStock(data.stock),
                    icon: const Icon(Icons.tune),
                    label: const Text('Edit stock numbers'),
                  ),
                  const SizedBox(height: 12),
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
    required this.finishable,
    required this.onLocationChanged,
    required this.onQuantityChanged,
    required this.onTake,
    required this.onReturn,
    required this.onFinish,
    required this.onDestroy,
  });

  final List<Location> locations;
  final String? selectedLocationId;
  final int quantity;
  final bool working;
  final bool finishable;
  final ValueChanged<String?> onLocationChanged;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onTake;
  final VoidCallback onReturn;
  final VoidCallback onFinish;
  final VoidCallback onDestroy;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Move stock',
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
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      if (finishable) ...[
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: working ? null : onFinish,
                            icon: const Icon(Icons.check_circle_outline),
                            label: const Text('Finish'),
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(foregroundColor: StatusColors.out),
                          onPressed: working ? null : onDestroy,
                          icon: const Icon(Icons.delete_outline),
                          label: const Text('Destroyed'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Finish and Destroyed permanently reduce the total; undo from the activity log.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

String _reasonLabel(Movement m) {
  final n = m.delta.abs();
  switch (m.reason) {
    case 'return':
      return 'Returned $n';
    case 'initial':
      return 'Stocked $n';
    case 'finish':
      return 'Finished $n';
    case 'destroyed':
      return 'Destroyed $n';
    case 'undo':
      return 'Undid';
    case 'adjust':
      final parts = <String>[];
      if (m.delta != 0) parts.add('qty ${m.delta > 0 ? '+' : ''}${m.delta}');
      if (m.capacityDelta != 0) parts.add('total ${m.capacityDelta > 0 ? '+' : ''}${m.capacityDelta}');
      return parts.isEmpty ? 'Adjusted' : 'Adjusted (${parts.join(', ')})';
    case 'take':
    default:
      return m.delta < 0 ? 'Took $n' : 'Added $n';
  }
}

IconData _reasonIcon(Movement m) {
  switch (m.reason) {
    case 'finish':
      return Icons.check_circle_outline;
    case 'destroyed':
      return Icons.delete_outline;
    case 'adjust':
      return Icons.tune;
    case 'undo':
      return Icons.undo;
    default:
      return m.delta < 0 ? Icons.arrow_upward : Icons.arrow_downward;
  }
}

Color _reasonColor(Movement m) {
  switch (m.reason) {
    case 'destroyed':
      return StatusColors.out;
    case 'finish':
    case 'adjust':
      return StatusColors.low;
    case 'undo':
      return StatusColors.ok;
    default:
      return m.delta < 0 ? StatusColors.low : StatusColors.ok;
  }
}

/// Admin bottom sheet to set the current quantity and total at a location.
class _EditStockSheet extends StatefulWidget {
  const _EditStockSheet({required this.itemId, required this.stock});
  final String itemId;
  final List<StockLevel> stock;

  @override
  State<_EditStockSheet> createState() => _EditStockSheetState();
}

class _EditStockSheetState extends State<_EditStockSheet> {
  final _repo = const InventoryRepository();
  late String _locationId = widget.stock.first.locationId;
  late final TextEditingController _qty;
  late final TextEditingController _cap;
  bool _saving = false;
  String? _error;

  StockLevel get _current =>
      widget.stock.firstWhere((s) => s.locationId == _locationId);

  @override
  void initState() {
    super.initState();
    _qty = TextEditingController(text: '${_current.quantity}');
    _cap = TextEditingController(text: '${_current.capacity}');
  }

  void _syncToLocation() {
    _qty.text = '${_current.quantity}';
    _cap.text = '${_current.capacity}';
  }

  @override
  void dispose() {
    _qty.dispose();
    _cap.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final quantity = int.tryParse(_qty.text) ?? -1;
    final capacity = int.tryParse(_cap.text) ?? -1;
    if (quantity < 0 || capacity < 0) {
      setState(() => _error = "Numbers can't be negative.");
      return;
    }
    if (quantity > capacity) {
      setState(() => _error = "Quantity can't exceed the total.");
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _repo.adjustStock(
        itemId: widget.itemId,
        locationId: _locationId,
        quantity: quantity,
        capacity: capacity,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() {
        _saving = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Edit stock numbers', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _locationId,
            decoration: const InputDecoration(labelText: 'Location'),
            items: [
              for (final s in widget.stock)
                DropdownMenuItem(value: s.locationId, child: Text(s.locationName ?? s.locationId)),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() {
                _locationId = v;
                _syncToLocation();
              });
            },
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _qty,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Current quantity'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _cap,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Total'),
                ),
              ),
            ],
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: const TextStyle(color: StatusColors.out)),
            ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Saving…' : 'Save stock numbers'),
          ),
        ],
      ),
    );
  }
}
