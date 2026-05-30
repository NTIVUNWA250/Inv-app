import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// Error thrown for non-2xx API responses, carrying the API's message.
class ApiException implements Exception {
  ApiException(this.status, this.message, [this.code]);
  final int status;
  final String message;
  final String? code;

  @override
  String toString() => message;
}

/// Single client the whole app uses to talk to the shared inventory-api.
///
/// Holds the session (access + refresh tokens) in secure storage, attaches the
/// Bearer token to every request, and transparently refreshes once on a 401.
/// [isAuthenticated] drives the auth gate in main.dart.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _accessKey = 'sb-access-token';
  static const _refreshKey = 'sb-refresh-token';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  String? _accessToken;
  String? _refreshToken;
  String? _currentEmail;

  /// Whether a session is currently active. The auth gate listens to this.
  final ValueNotifier<bool> isAuthenticated = ValueNotifier<bool>(false);

  String? get currentEmail => _currentEmail;

  String get _baseUrl => dotenv.env['API_URL'] ?? 'http://10.0.2.2:4000';

  Uri _uri(String path) => Uri.parse('$_baseUrl$path');

  Map<String, String> _headers({bool json = false}) => {
        if (json) 'Content-Type': 'application/json',
        if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
      };

  /// Restore a persisted session at startup and confirm it's still valid.
  Future<void> restore() async {
    _accessToken = await _storage.read(key: _accessKey);
    _refreshToken = await _storage.read(key: _refreshKey);
    isAuthenticated.value = _accessToken != null;

    if (_accessToken != null) {
      try {
        final me = await get('/auth/me') as Map<String, dynamic>;
        _currentEmail = (me['user'] as Map?)?['email'] as String?;
      } catch (_) {
        // A failed /auth/me (after a failed refresh) will have cleared the session.
      }
    }
  }

  // --- Auth ---------------------------------------------------------------

  Future<void> login(String email, String password) async {
    final body = await _unauthed('/auth/login', {
      'email': email,
      'password': password,
    });
    _currentEmail = (body['user'] as Map?)?['email'] as String?;
    await _persist(body['session'] as Map<String, dynamic>);
  }

  /// Returns true if signup logged the user straight in (email confirmation
  /// disabled), false if they still need to confirm their email.
  Future<bool> signup(String email, String password, String fullName) async {
    final body = await _unauthed('/auth/signup', {
      'email': email,
      'password': password,
      'full_name': fullName,
    });
    final session = body['session'];
    if (session is Map<String, dynamic>) {
      _currentEmail = (body['user'] as Map?)?['email'] as String?;
      await _persist(session);
      return true;
    }
    return false;
  }

  Future<void> logout() async {
    try {
      if (_accessToken != null) {
        await http.post(_uri('/auth/logout'), headers: _headers());
      }
    } catch (_) {
      // Best effort — clear locally regardless.
    }
    await _clear();
  }

  // --- Generic requests ---------------------------------------------------

  Future<dynamic> get(String path) => _request('GET', path);

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) =>
      _request('POST', path, body);

  Future<dynamic> _request(
    String method,
    String path, [
    Map<String, dynamic>? body,
    bool retried = false,
  ]) async {
    final res = await _send(method, path, body);

    if (res.statusCode == 401 && !retried && _refreshToken != null) {
      if (await _refresh()) {
        return _request(method, path, body, true);
      }
    }

    final decoded = _decode(res);
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, _errorMessage(decoded), _errorCode(decoded));
    }
    return decoded;
  }

  Future<http.Response> _send(String method, String path, Map<String, dynamic>? body) {
    final uri = _uri(path);
    final headers = _headers(json: body != null);
    switch (method) {
      case 'POST':
        return http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
      case 'GET':
      default:
        return http.get(uri, headers: headers);
    }
  }

  // --- Session plumbing ---------------------------------------------------

  Future<Map<String, dynamic>> _unauthed(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      _uri(path),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    final decoded = _decode(res);
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, _errorMessage(decoded), _errorCode(decoded));
    }
    return decoded as Map<String, dynamic>;
  }

  Future<bool> _refresh() async {
    try {
      final res = await http.post(
        _uri('/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh_token': _refreshToken}),
      );
      if (res.statusCode >= 400) {
        await _clear();
        return false;
      }
      await _persist((_decode(res) as Map<String, dynamic>)['session'] as Map<String, dynamic>);
      return true;
    } catch (_) {
      await _clear();
      return false;
    }
  }

  Future<void> _persist(Map<String, dynamic> session) async {
    _accessToken = session['access_token'] as String?;
    _refreshToken = session['refresh_token'] as String?;
    if (_accessToken != null) await _storage.write(key: _accessKey, value: _accessToken);
    if (_refreshToken != null) await _storage.write(key: _refreshKey, value: _refreshToken);
    isAuthenticated.value = _accessToken != null;
  }

  Future<void> _clear() async {
    _accessToken = null;
    _refreshToken = null;
    _currentEmail = null;
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    isAuthenticated.value = false;
  }

  dynamic _decode(http.Response res) {
    if (res.body.isEmpty) return <String, dynamic>{};
    return jsonDecode(res.body);
  }

  String _errorMessage(dynamic body) {
    if (body is Map && body['error'] is Map && body['error']['message'] is String) {
      return body['error']['message'] as String;
    }
    return 'Request failed';
  }

  String? _errorCode(dynamic body) {
    if (body is Map && body['error'] is Map && body['error']['code'] is String) {
      return body['error']['code'] as String;
    }
    return null;
  }
}

/// Convenience accessor mirroring the old `supabase` global.
ApiClient get api => ApiClient.instance;
