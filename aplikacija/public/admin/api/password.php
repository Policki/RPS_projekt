<?php
require_once __DIR__ . '/bootstrap.php';

$admin = require_admin();
if (method() !== 'POST') {
    fail('Metoda ni dovoljena.', 405);
}

$in      = read_json();
$current = isset($in['current']) ? (string)$in['current'] : '';
$new     = isset($in['new']) ? (string)$in['new'] : '';

if (mb_strlen($new) < 10) {
    fail('Novo geslo mora imeti vsaj 10 znakov.', 422);
}
$hash = q('SELECT password_hash FROM users WHERE id = ?', [$admin['id']])->fetchColumn();
if (!password_verify($current, (string)$hash)) {
    fail('Trenutno geslo ni pravilno.', 403);
}
q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $admin['id']]);

session_regenerate_id(true);
json_out(['ok' => true]);
