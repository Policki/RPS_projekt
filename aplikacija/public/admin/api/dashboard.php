<?php
require_once __DIR__ . '/bootstrap.php';

$admin = require_admin();
if (method() !== 'GET') {
    fail('Metoda ni dovoljena.', 405);
}

$one = function ($sql, $params = []) {
    return (int)q($sql, $params)->fetchColumn();
};

$pending  = $one("SELECT COUNT(*) FROM users WHERE role = 'dijak' AND status = 'caka'");
$students = $one("SELECT COUNT(*) FROM users WHERE role = 'dijak' AND status = 'aktiven'");
$teachers = $one("SELECT COUNT(*) FROM users WHERE role = 'ucitelj' AND status = 'aktiven'");
$accounts = $one("SELECT COUNT(*) FROM users WHERE role <> 'admin' AND status = 'aktiven'");
$newWeek  = $one("SELECT COUNT(*) FROM users WHERE role <> 'admin' AND created_at >= NOW() - INTERVAL 7 DAY");
$classes  = $one("SELECT COUNT(*) FROM classes WHERE active = 1");
$noTeach  = $one("SELECT COUNT(*) FROM subjects WHERE teacher_id IS NULL");

$reportsNew  = $one("SELECT COUNT(*) FROM reports WHERE created_at >= NOW() - INTERVAL 7 DAY");
$lastReport  = q("SELECT MAX(created_at) FROM reports")->fetchColumn();

// Disk
$total = @disk_total_space(__DIR__);
$free  = @disk_free_space(__DIR__);
$diskPct = ($total && $free !== false) ? (int)round((1 - $free / $total) * 100) : 0;

// Zadnja varnostna kopija
$lastBackup = q("SELECT MAX(created_at) FROM backups")->fetchColumn();

// Sistemska obvestila: disk skoraj poln, ali kopija starejša od 2 dni / ne obstaja
$notices = 0;
if ($diskPct >= 85) {
    $notices++;
}
if (setting('auto', '1') === '1' && (!$lastBackup || strtotime($lastBackup) < time() - 2 * 86400)) {
    $notices++;
}

json_out([
    'admin'                 => $admin['ime'],
    'pendingEnrollments'    => $pending,
    'systemNotices'         => $notices,
    'students'              => $students,
    'teachers'              => $teachers,
    'accounts'              => $accounts,
    'newThisWeek'           => $newWeek,
    'classes'               => $classes,
    'classesWithoutTeacher' => $noTeach,
    'newReports'            => $reportsNew,
    'lastReport'            => iso($lastReport),
    'diskUsedPct'           => $diskPct,
    'lastBackup'            => iso($lastBackup),
    'uptimePct'             => (float)setting('uptimePct', '99.9'),
]);
