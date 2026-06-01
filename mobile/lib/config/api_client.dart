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
/// Holds the session in secure storage, attaches the Bearer token to every
/// request, and transparently refreshes once on a 401. [isAuthenticated] drives
/// the auth gate; the current user's profile (role/name) is loaded from
/// /auth/me after login and on restore.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _accessKey = 'sb-access-token';
  static const _refreshKey = 'sb-refresh-token';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  String? _accessToken;
  String? _refreshToken;

  String? _currentEmail;
  String? _currentUserId;
  String? _currentFullName;
  String _role = 'member';

  /// Whether a session is currently active. The auth gate listens to this.
  final ValueNotifier<bool> isAuthenticated = ValueNotifier<bool>(false);

  String? get currentEmail => _currentEmail;
  String? get currentUserId => _currentUserId;
  String? get currentFullName => _currentFullName;
  String get role => _role;
  bool get isAdmin => _role == 'admin';

  String get _baseUrl => dotenv.env['API_URL'] ?? 'http://10.0.2.2:4000';

  Uri _uri(String path) => Uri.parse('$_baseUrl$path');

  Map<String, String> _headers({bool json = false}) => {
        if (json) 'Content-Type': 'application/json',
        if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
      };

  /// Restore a persisted session at startup and load the profile.
  Future<void> restore() async {
    _accessToken = await _storage.read(key: _accessKey);
    _refreshToken = await _storage.read(key: _refreshKey);
    if (_accessToken != null) {
      await _loadMe();
      isAuthenticated.value = true;
    } else {
      isAuthenticated.value = false;
    }
  }

  // --- Auth ---------------------------------------------------------------

  Future<void> login(String email, String password) async {
    final body = await _unauthed('/auth/login', {
      'email': email,
      'password': password,
    });
    await _persist(body['session'] as Map<String, dynamic>);
    await _loadMe(); // load role before the shell reads it
    isAuthenticated.value = true;
  }

  /// Returns true if signup logged the user straight in.
  Future<bool> signup(String email, String password, String fullName) async {
    final body = await _unauthed('/auth/signup', {
      'email': email,
      'password': password,
      'full_name': fullName,
    });
    final session = body['session'];
    if (session is Map<String, dynamic>) {
      await _persist(session);
      await _loadMe();
      isAuthenticated.value = true;
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
      // Best effort.
    }
    await _clear();
  }

  Future<void> _loadMe() async {
    try {
      final me = await get('/auth/me') as Map<String, dynamic>;
      final user = me['user'] as Map<String, dynamic>?;
      final profile = me['profile'] as Map<String, dynamic>?;
      _currentEmail = user?['email'] as String?;
      _currentUserId = user?['id'] as String?;
      _currentFullName = profile?['full_name'] as String?;
      _role = (profile?['role'] as String?) ?? 'member';
    } catch (_) {
      // Leave defaults; a failed refresh path clears the session.
    }
  }

  /// Update the signed-in user's own display name and/or email. Email changes
  /// require the API's service-role key (server enforces). Refreshes the cached
  /// name/email from the response.
  Future<void> updateProfile({String? fullName, String? email}) async {
    final body = <String, dynamic>{
      if (fullName != null) 'full_name': fullName,
      if (email != null) 'email': email,
    };
    final res = await patch('/profiles/me', body) as Map<String, dynamic>;
    _currentFullName = res['full_name'] as String? ?? _currentFullName;
    _currentEmail = res['email'] as String? ?? _currentEmail;
  }

  /// Change the signed-in user's password. The server verifies [current]
  /// before applying [next].
  Future<void> changePassword(String current, String next) async {
    await post('/auth/change-password', {
      'current_password': current,
      'new_password': next,
    });
  }

  // --- Generic requests ---------------------------------------------------

  Future<dynamic> get(String path) => _request('GET', path);
  Future<dynamic> post(String path, [Map<String, dynamic>? body]) =>
      _request('POST', path, body);
  Future<dynamic> patch(String path, [Map<String, dynamic>? body]) =>
      _request('PATCH', path, body);
  Future<dynamic> delete(String path) => _request('DELETE', path);

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
    final encoded = body != null ? jsonEncode(body) : null;
    switch (method) {
      case 'POST':
        return http.post(uri, headers: headers, body: encoded);
      case 'PATCH':
        return http.patch(uri, headers: headers, body: encoded);
      case 'DELETE':
        return http.delete(uri, headers: headers);
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
    // isAuthenticated is flipped by callers after the profile is loaded.
  }

  Future<void> _clear() async {
    _accessToken = null;
    _refreshToken = null;
    _currentEmail = null;
    _currentUserId = null;
    _currentFullName = null;
    _role = 'member';
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

/// Convenience accessor.
ApiClient get api => ApiClient.instance;
