/// Catalog item, mirroring the `items` table / API shape.
class Item {
  Item({
    required this.id,
    required this.name,
    this.sku,
    this.description,
  });

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

/// Current stock for one (item, location), with names joined in by the API.
class StockLevel {
  StockLevel({
    required this.itemId,
    required this.locationId,
    required this.quantity,
    this.itemName,
    this.locationName,
  });

  final String itemId;
  final String locationId;
  final int quantity;
  final String? itemName;
  final String? locationName;

  factory StockLevel.fromJson(Map<String, dynamic> json) => StockLevel(
        itemId: json['item_id'] as String,
        locationId: json['location_id'] as String,
        quantity: json['quantity'] as int,
        itemName: (json['items'] as Map?)?['name'] as String?,
        locationName: (json['locations'] as Map?)?['name'] as String?,
      );
}
