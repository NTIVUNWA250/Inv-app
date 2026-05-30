import '../../config/api_client.dart';
import 'models.dart';

/// Reads inventory data from the shared API. All calls go through [ApiClient],
/// so they carry the user's token and respect the backend's RLS rules.
class InventoryRepository {
  const InventoryRepository();

  Future<List<Item>> fetchItems({String? search}) async {
    final path = search == null || search.isEmpty
        ? '/items'
        : '/items?search=${Uri.encodeQueryComponent(search)}';
    final data = await api.get(path) as List<dynamic>;
    return data.map((e) => Item.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<StockLevel>> fetchStock() async {
    final data = await api.get('/stock') as List<dynamic>;
    return data.map((e) => StockLevel.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Check a quantity out of (negative) or back in to (positive) a location.
  Future<void> recordMovement({
    required String itemId,
    required String locationId,
    required int quantity,
    String? note,
    required bool checkOut,
  }) async {
    await api.post(checkOut ? '/movements/check-out' : '/movements/check-in', {
      'item_id': itemId,
      'location_id': locationId,
      'quantity': quantity,
      if (note != null) 'note': note,
    });
  }
}
