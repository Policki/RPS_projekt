<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib_backup.php';

require_admin();
if (method() !== 'POST') {
    fail('Metoda ni dovoljena.', 405);
}
$r = make_backup('rocno');
json_out(['ok' => true, 'lastBackup' => $r['created_at']]);
