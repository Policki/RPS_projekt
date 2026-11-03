<?php
require_once __DIR__ . '/bootstrap.php';

if (method() !== 'POST') {
    fail('Metoda ni dovoljena.', 405);
}
start_session();
$sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $sent)) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
json_out(['ok' => true]);
