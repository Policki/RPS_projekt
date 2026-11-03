<?php
require_once __DIR__ . '/bootstrap.php';

if (method() !== 'POST') {
    fail('Metoda ni dovoljena.', 405);
}

$in    = read_json();
$email = mb_strtolower(str_field($in, 'email', 190));
$pass  = isset($in['password']) ? (string)$in['password'] : '';
$ip    = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

if ($email === '' || $pass === '') {
    fail('Vnesi e-pošto in geslo.', 422);
}

// Zaščita pred ugibanjem gesel: največ 5 napačnih poskusov v 15 minutah
q('DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY');
$recent = (int)q(
    'SELECT COUNT(*) FROM login_attempts
     WHERE (email = ? OR ip = ?) AND attempted_at > NOW() - INTERVAL 15 MINUTE',
    [$email, $ip]
)->fetchColumn();
if ($recent >= 5) {
    fail('Preveč neuspelih poskusov. Poskusi znova čez 15 minut.', 429);
}

$st   = q("SELECT id, password_hash, role, status FROM users WHERE email = ? AND role = 'admin'", [$email]);
$user = $st->fetch();

// Pri neobstoječem računu opravimo enako drago operacijo, da odzivni čas ne razkrije obstoja računa
if ($user) {
    $ok = password_verify($pass, $user['password_hash']);
} else {
    password_hash($pass, PASSWORD_DEFAULT);
    $ok = false;
}

if (!$user || !$ok || $user['status'] === 'povabljen') {
    q('INSERT INTO login_attempts (email, ip) VALUES (?, ?)', [$email, $ip]);
    fail('Napačna e-pošta ali geslo.', 401);
}

q('DELETE FROM login_attempts WHERE email = ?', [$email]);

if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
    q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $user['id']]);
}

start_session();
session_regenerate_id(true);
$_SESSION['uid']  = (int)$user['id'];
$_SESSION['last'] = time();
$_SESSION['csrf'] = bin2hex(random_bytes(32));

q('UPDATE users SET last_login = NOW() WHERE id = ?', [$user['id']]);

json_out(['ok' => true]);
