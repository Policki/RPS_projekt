<?php
// Skupna koda za vse API-je: povezava z bazo, seja, JSON odgovori, zaščita.
require_once __DIR__ . '/config.php';

date_default_timezone_set(APP_TIMEZONE);
mb_internal_encoding('UTF-8');

/* ---------- JSON odgovori ---------- */
function json_out($data, $code = 200)
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($message, $code = 400, $extra = [])
{
    json_out(array_merge(['error' => $message], $extra), $code);
}

set_exception_handler(function ($e) {
    error_log('[sola-admin] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $msg = APP_DEBUG ? $e->getMessage() : 'Napaka na strežniku.';
    if (!headers_sent()) {
        json_out(['error' => $msg], 500);
    }
});

/* ---------- Baza ---------- */
function db()
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        // MySQL naj uporablja isti časovni pas kot PHP (da se NOW() ujema)
        $pdo->exec("SET time_zone = '" . (new DateTime('now'))->format('P') . "'");
    }
    return $pdo;
}

function q($sql, $params = [])
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

/* ---------- Nastavitve ---------- */
function settings_all()
{
    $out = [];
    foreach (q('SELECT skey, svalue FROM settings')->fetchAll() as $r) {
        $out[$r['skey']] = $r['svalue'];
    }
    return $out;
}

function setting($key, $default = '')
{
    $st = q('SELECT svalue FROM settings WHERE skey = ?', [$key]);
    $v = $st->fetchColumn();
    return $v === false ? $default : $v;
}

function set_setting($key, $value)
{
    q('INSERT INTO settings (skey, svalue) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)', [$key, (string)$value]);
}

/* ---------- Seja ---------- */
function start_session()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_name('SOLA_ADMIN');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function session_timeout_seconds()
{
    switch (setting('seja', '30 minut')) {
        case '1 ura':  return 3600;
        case '4 ure':  return 14400;
        default:       return 1800;
    }
}

/* Vrne podatke prijavljenega skrbnika ali prekine zahtevo z 401. */
function require_admin($checkCsrf = null)
{
    start_session();
    if (empty($_SESSION['uid'])) {
        fail('Nisi prijavljen.', 401);
    }
    if (isset($_SESSION['last']) && (time() - $_SESSION['last']) > session_timeout_seconds()) {
        $_SESSION = [];
        session_destroy();
        fail('Seja je potekla zaradi nedejavnosti.', 401);
    }
    $_SESSION['last'] = time();

    $st = q("SELECT id, ime, priimek, email, role, status FROM users WHERE id = ?", [$_SESSION['uid']]);
    $u = $st->fetch();
    if (!$u || $u['role'] !== 'admin' || $u['status'] === 'povabljen') {
        $_SESSION = [];
        session_destroy();
        fail('Nisi prijavljen.', 401);
    }

    if ($checkCsrf === null) {
        $checkCsrf = !in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD', 'OPTIONS'], true);
    }
    if ($checkCsrf) {
        $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
            fail('Neveljaven varnostni žeton. Osveži stran.', 403);
        }
    }
    return $u;
}

/* ---------- Vhodni podatki ---------- */
function read_json()
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    if (strlen($raw) > 1048576) {
        fail('Zahteva je prevelika.', 413);
    }
    $d = json_decode($raw, true);
    if (!is_array($d)) {
        fail('Neveljaven JSON.', 400);
    }
    return $d;
}

function method()
{
    return $_SERVER['REQUEST_METHOD'];
}

function str_field($arr, $key, $max = 255)
{
    $v = isset($arr[$key]) ? trim((string)$arr[$key]) : '';
    if (mb_strlen($v) > $max) {
        fail('Vrednost polja je predolga.', 422);
    }
    return $v;
}

function full_name($ime, $priimek)
{
    return trim($ime . ' ' . $priimek);
}

function iso($dt)
{
    return $dt ? date('c', strtotime($dt)) : null;
}

function like_escape($s)
{
    return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $s);
}
