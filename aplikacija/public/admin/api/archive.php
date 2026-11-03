<?php
require_once __DIR__ . '/bootstrap.php';

$admin = require_admin();
if (method() !== 'POST') {
    fail('Metoda ni dovoljena.', 405);
}

$leto = setting('leto', '');
db()->beginTransaction();
try {
    $st = q('UPDATE classes SET active = 0 WHERE active = 1 AND school_year = ?', [$leto]);
    $closed = $st->rowCount();
    q('INSERT INTO archive_log (school_year, classes_closed, archived_by) VALUES (?, ?, ?)',
      [$leto, $closed, $admin['id']]);
    db()->commit();
} catch (Exception $e) {
    db()->rollBack();
    throw $e;
}
json_out(['ok' => true, 'closed' => $closed, 'leto' => $leto]);
