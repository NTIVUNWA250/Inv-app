import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../items/item_detail_screen.dart';
import '../items/item_qr.dart';

/// Full-screen camera scanner. On reading an item QR code it opens that item.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _handled = false;

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null) continue;
      final id = parseItemQr(raw);
      if (id != null) {
        _handled = true;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => ItemDetailScreen(itemId: id)),
        );
        return;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan item QR')),
      body: Stack(
        alignment: Alignment.center,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Camera unavailable.\n${error.errorDetails?.message ?? error.errorCode.name}\n\n'
                  'On desktop there may be no camera — try the web or mobile build.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
          IgnorePointer(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white70, width: 2),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const Positioned(
            left: 16,
            right: 16,
            bottom: 32,
            child: Text(
              "Point the camera at an item's QR code",
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}
