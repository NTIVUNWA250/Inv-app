import 'config/api_client.dart';
import 'models.dart';

/// All inventory data access, going through [ApiClient] (so every call carries
/// the user's token and respects the backend's RLS rules).
class InventoryRepository {
  const InventoryRepository();

  Future<List<Item>> fetchItems({String? search}) async {
    final path = (search == null || search.isEmpty)
        ? '/items'
        : '/items?search=${Uri.encodeQueryComponent(search)}';
    final data = await api.get(path) as List<dynamic>;
    return data.map((e) => Item.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Item> fetchItem(String id) async {
    final data = await api.get('/items/$id') as Map<String, dynamic>;
    return Item.fromJson(data);
  }

  Future<List<StockLevel>> fetchStock() async {
    final data = await api.get('/stock') as List<dynamic>;
    return data.map((e) => StockLevel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<StockLevel>> fetchItemStock(String itemId) async {
    final data = await api.get('/items/$itemId/stock') as List<dynamic>;
    return data.map((e) => StockLevel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<StockLevel>> fetchStockAtLocation(String locationId) async {
    final data = await api.get('/stock?location_id=$locationId') as List<dynamic>;
    return data.map((e) => StockLevel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Location>> fetchLocations() async {
    final data = await api.get('/locations') as List<dynamic>;
    return data.map((e) => Location.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Location> fetchLocation(String id) async {
    final data = await api.get('/locations/$id') as Map<String, dynamic>;
    return Location.fromJson(data);
  }

  Future<List<Movement>> fetchMovements(String itemId) async {
    final data = await api.get('/movements?item_id=$itemId') as List<dynamic>;
    return data.map((e) => Movement.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Move stock. `action` is take | return | finish | destroy. take/return move
  /// stock as usual; finish/destroy permanently reduce quantity AND the total.
  /// The user is recorded as the actor.
  Future<void> moveStock({
    required String itemId,
    required String locationId,
    required int quantity,
    required String action,
  }) async {
    const endpoints = {
      'take': '/movements/check-out',
      'return': '/movements/check-in',
      'finish': '/movements/finish',
      'destroy': '/movements/destroy',
    };
    await api.post(endpoints[action]!, {
      'item_id': itemId,
      'location_id': locationId,
      'quantity': quantity,
    });
  }

  /// Admin: set the current quantity and/or total (ceiling) at a location.
  Future<void> adjustStock({
    required String itemId,
    required String locationId,
    required int quantity,
    required int capacity,
  }) =>
      api.post('/movements/adjust', {
        'item_id': itemId,
        'location_id': locationId,
        'quantity': quantity,
        'capacity': capacity,
      });

  /// Undo a finish/destroyed movement (own entry, or any as admin).
  Future<void> undoMovement(String movementId) =>
      api.post('/movements/$movementId/undo', const {});

  /// Admin: toggle whether an item can be finished.
  Future<void> setFinishable(String itemId, bool finishable) =>
      api.patch('/items/$itemId', {'finishable': finishable});

  /// Create a catalog item and seed its initial stock at a location.
  Future<void> createItem({
    required String name,
    String? sku,
    String? description,
    required String locationId,
    required int quantity,
    bool finishable = false,
  }) async {
    final item = await api.post('/items', {
      'name': name,
      'sku': (sku != null && sku.isNotEmpty) ? sku : null,
      'description': (description != null && description.isNotEmpty) ? description : null,
      'finishable': finishable,
    }) as Map<String, dynamic>;

    await api.post('/movements', {
      'item_id': item['id'],
      'location_id': locationId,
      'delta': quantity,
      'reason': 'initial',
      'note': 'Initial stock',
    });
  }

  Future<void> deleteItem(String id) => api.delete('/items/$id');

  Future<void> createLocation(String name) => api.post('/locations', {'name': name});

  Future<void> deleteLocation(String id) => api.delete('/locations/$id');
}

/// Profile + account management (admin-only operations are gated server-side).
class UsersRepository {
  const UsersRepository();

  Future<List<Profile>> fetchProfiles() async {
    final data = await api.get('/profiles') as List<dynamic>;
    return data.map((e) => Profile.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Change a user's role (admin-only, enforced server-side). Returns the
  /// updated profile from the API so the UI can reflect it without re-fetching
  /// (a re-fetch can be served stale from the browser's HTTP cache on web).
  Future<Profile> changeRole(String id, String role) async {
    final data = await api.patch('/profiles/$id/role', {'role': role}) as Map<String, dynamic>;
    return Profile.fromJson(data);
  }

  /// Block or unblock a user (admin-only, enforced server-side).
  Future<void> setBlocked(String id, bool blocked) =>
      api.patch('/users/$id/block', {'blocked': blocked});

  Future<void> createUser({
    required String email,
    required String password,
    String? fullName,
    required String role,
  }) =>
      api.post('/users', {
        'email': email,
        'password': password,
        if (fullName != null && fullName.isNotEmpty) 'full_name': fullName,
        'role': role,
      });

  /// Edit another user's account as an admin: display name, email, and/or
  /// password (for fixing things when the user can't themselves). Only the
  /// provided fields are sent. Admin-only + service-role key, enforced
  /// server-side. Returns the updated profile.
  Future<Profile> updateUser(
    String id, {
    String? fullName,
    String? email,
    String? password,
  }) async {
    final body = <String, dynamic>{
      if (fullName != null && fullName.isNotEmpty) 'full_name': fullName,
      if (email != null && email.isNotEmpty) 'email': email,
      if (password != null && password.isNotEmpty) 'password': password,
    };
    final data = await api.patch('/users/$id', body) as Map<String, dynamic>;
    return Profile.fromJson(data);
  }

  Future<void> deleteUser(String id) => api.delete('/users/$id');
}
