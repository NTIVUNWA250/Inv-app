import 'package:flutter/material.dart';

import '../config/api_client.dart';
import '../features/inventory/inventory_repository.dart';
import '../features/inventory/models.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _repository = const InventoryRepository();
  late Future<List<Item>> _itemsFuture;

  @override
  void initState() {
    super.initState();
    _itemsFuture = _repository.fetchItems();
  }

  Future<void> _refresh() async {
    setState(() {
      _itemsFuture = _repository.fetchItems();
    });
    await _itemsFuture;
  }

  @override
  Widget build(BuildContext context) {
    final email = ApiClient.instance.currentEmail ?? '';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ApiClient.instance.logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
              child: Text('Signed in as $email',
                  style: Theme.of(context).textTheme.bodyMedium),
            ),
            Expanded(
              child: FutureBuilder<List<Item>>(
                future: _itemsFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return _Message(
                      icon: Icons.error_outline,
                      text: 'Couldn\'t load items from the API:\n'
                          '${snapshot.error}',
                    );
                  }
                  final items = snapshot.data ?? const [];
                  if (items.isEmpty) {
                    return const _Message(
                      icon: Icons.inventory_2_outlined,
                      text: 'No items yet.\nAn admin can add items to the catalog.',
                    );
                  }
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final item = items[i];
                      return ListTile(
                        leading: const Icon(Icons.inventory_2_outlined),
                        title: Text(item.name),
                        subtitle: item.sku != null ? Text('SKU ${item.sku}') : null,
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    // Wrapped in a scroll view so RefreshIndicator still works when empty.
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 96),
        Icon(icon, size: 48, color: Theme.of(context).colorScheme.outline),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Text(text, textAlign: TextAlign.center),
        ),
      ],
    );
  }
}
