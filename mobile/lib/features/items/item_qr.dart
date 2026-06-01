import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../models.dart';

/// QR payload for an item. Prefixed so the scanner can tell our codes apart
/// from arbitrary QR content.
const _prefix = 'inventory:item:';

String itemQrData(String itemId) => '$_prefix$itemId';

/// Extract an item id from a scanned QR value. Accepts our prefixed payload or
/// a bare id, and returns null for anything else.
String? parseItemQr(String raw) {
  final value = raw.trim();
  if (value.startsWith(_prefix)) {
    final id = value.substring(_prefix.length).trim();
    return id.isEmpty ? null : id;
  }
  // Tolerate a bare UUID (e.g. a code generated elsewhere).
  if (RegExp(r'^[0-9a-fA-F-]{32,40}$').hasMatch(value)) return value;
  return null;
}

/// Show a printable/scannable QR code for [item] in a dialog.
Future<void> showItemQrDialog(BuildContext context, Item item) {
  return showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(item.name),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: QrImageView(
              data: itemQrData(item.id),
              version: QrVersions.auto,
              size: 220,
              backgroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            item.sku != null ? 'SKU ${item.sku}' : 'No SKU',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 4),
          Text(
            'Scan from the Home tab to open this item.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
      ],
    ),
  );
}
