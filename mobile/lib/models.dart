/// Items at or below this total quantity are flagged "low stock".
const int lowStockThreshold = 10;

enum StockStatus { out, low, ok }

StockStatus statusForQuantity(int quantity) {
  if (quantity <= 0) return StockStatus.out;
  if (quantity <= lowStockThreshold) return StockStatus.low;
  return StockStatus.ok;
}

class Item {
  Item({required this.id, required this.name, this.sku, this.description});

  final String id;
  final String name;
  final String? sku;
  final String? description;

  factory Item.fromJson(Map<String, dynamic> json) => Item(
        id: json['id'] as String,
        name: json['name'] as String,
        sku: json['sku'] as String?,
        description: json['description'] as String?,
      );
}

class Location {
  Location({required this.id, required this.name});

  final String id;
  final String name;

  factory Location.fromJson(Map<String, dynamic> json) => Location(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class StockLevel {
  StockLevel({
    required this.itemId,
    required this.locationId,
    required this.quantity,
    this.itemName,
    this.itemSku,
    this.locationName,
  });

  final String itemId;
  final String locationId;
  final int quantity;
  final String? itemName;
  final String? itemSku;
  final String? locationName;

  factory StockLevel.fromJson(Map<String, dynamic> json) {
    final items = json['items'] as Map<String, dynamic>?;
    final locations = json['locations'] as Map<String, dynamic>?;
    return StockLevel(
      itemId: json['item_id'] as String,
      locationId: json['location_id'] as String,
      quantity: (json['quantity'] as num).toInt(),
      itemName: items?['name'] as String?,
      itemSku: items?['sku'] as String?,
      locationName: locations?['name'] as String?,
    );
  }
}

class Movement {
  Movement({
    required this.id,
    required this.itemId,
    required this.locationId,
    required this.userId,
    required this.delta,
    required this.createdAt,
    this.note,
    this.locationName,
  });

  final String id;
  final String itemId;
  final String locationId;
  final String userId;
  final int delta;
  final DateTime createdAt;
  final String? note;
  final String? locationName;

  factory Movement.fromJson(Map<String, dynamic> json) {
    final locations = json['locations'] as Map<String, dynamic>?;
    return Movement(
      id: json['id'] as String,
      itemId: json['item_id'] as String,
      locationId: json['location_id'] as String,
      userId: json['user_id'] as String,
      delta: (json['delta'] as num).toInt(),
      createdAt: DateTime.parse(json['created_at'] as String),
      note: json['note'] as String?,
      locationName: locations?['name'] as String?,
    );
  }
}

class Profile {
  Profile({
    required this.id,
    required this.role,
    this.fullName,
    this.createdAt,
  });

  final String id;
  final String role; // 'member' | 'admin'
  final String? fullName;
  final DateTime? createdAt;

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
        id: json['id'] as String,
        role: (json['role'] as String?) ?? 'member',
        fullName: json['full_name'] as String?,
        createdAt: json['created_at'] != null
            ? DateTime.tryParse(json['created_at'] as String)
            : null,
      );
}
