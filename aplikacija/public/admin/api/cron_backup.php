<?php
// Samodejne kopije – zaženi iz urnika opravil (cron / Windows Task Scheduler):
//   php /pot/do/admin/api/cron_backup.php
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Samo iz ukazne vrstice.');
}
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib_backup.php';

if (setting('auto', '1') !== '1') {
    echo "Samodejne kopije so izklopljene.\n";
    exit(0);
}
$interval = setting('freq', 'dnevno') === 'tedensko' ? 7 * 86400 : 86400;
$last = q('SELECT MAX(created_at) FROM backups')->fetchColumn();
if ($last && (time() - strtotime($last)) < $interval - 3600) {
    echo "Kopija še ni potrebna.\n";
    exit(0);
}
$r = make_backup('samodejno');
echo "Narejeno: {$r['filename']}\n";
