<?php
// Enkratna namestitev: ustvari prvega skrbnika.
// Ko je skrbnik ustvarjen, ta stran ne dela več – datoteko lahko tudi izbrišeš.
require_once __DIR__ . '/api/bootstrap.php';

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

header('Content-Type: text/html; charset=utf-8');

$error = '';
$done  = false;
$exists = false;

try {
    $exists = (bool)q("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1")->fetchColumn();
} catch (Exception $e) {
    $error = 'Povezava z bazo ni uspela ali tabele ne obstajajo. Najprej uvozi db/schema.sql in preveri api/config.php.';
    if (APP_DEBUG) { $error .= ' (' . $e->getMessage() . ')'; }
    $exists = true; // prepreči prikaz obrazca
}

$ime = ''; $email = '';
if (!$exists && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $ime   = trim((string)($_POST['ime'] ?? ''));
    $email = mb_strtolower(trim((string)($_POST['email'] ?? '')));
    $p1    = (string)($_POST['password'] ?? '');
    $p2    = (string)($_POST['password2'] ?? '');

    if ($ime === '') {
        $error = 'Vnesi ime.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Vnesi veljaven e-poštni naslov.';
    } elseif (mb_strlen($p1) < 10) {
        $error = 'Geslo mora imeti vsaj 10 znakov.';
    } elseif ($p1 !== $p2) {
        $error = 'Gesli se ne ujemata.';
    } else {
        q("INSERT INTO users (ime, priimek, email, password_hash, role, status)
           VALUES (?, '', ?, ?, 'admin', 'aktiven')", [$ime, $email, password_hash($p1, PASSWORD_DEFAULT)]);
        $done = true;
        $exists = true;
    }
}
?><!DOCTYPE html>
<html lang="sl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Namestitev</title>
<link rel="stylesheet" href="admin-prijava.css">
</head>
<body class="auth">
<main class="auth-card">
    <h1>Namestitev <span>sistema.</span></h1>
<?php if ($done): ?>
    <p class="auth-sub">Skrbnik je ustvarjen. Zaradi varnosti izbriši datoteko <code>setup.php</code> s strežnika.</p>
    <a class="btn btn-primary" href="admin-prijava.html">Na prijavo</a>
<?php elseif ($exists && $error === ''): ?>
    <p class="auth-sub">Skrbnik že obstaja, namestitev je zaključena. Datoteko <code>setup.php</code> lahko izbrišeš.</p>
    <a class="btn" href="admin-prijava.html">Na prijavo</a>
<?php elseif ($error !== '' && $exists): ?>
    <p class="auth-error"><?= h($error) ?></p>
<?php else: ?>
    <p class="auth-sub">Ustvari prvi skrbniški račun.</p>
    <?php if ($error !== ''): ?><p class="auth-error"><?= h($error) ?></p><?php endif; ?>
    <form method="post" autocomplete="off">
        <div class="field"><label for="ime">Ime</label>
            <input id="ime" name="ime" type="text" value="<?= h($ime) ?>" required></div>
        <div class="field"><label for="email">E-pošta</label>
            <input id="email" name="email" type="email" value="<?= h($email) ?>" required></div>
        <div class="field"><label for="password">Geslo (vsaj 10 znakov)</label>
            <input id="password" name="password" type="password" minlength="10" required></div>
        <div class="field"><label for="password2">Ponovi geslo</label>
            <input id="password2" name="password2" type="password" minlength="10" required></div>
        <button class="btn btn-primary" type="submit">Ustvari skrbnika</button>
    </form>
<?php endif; ?>
</main>
</body>
</html>
