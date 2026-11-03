<?php
require_once __DIR__ . '/bootstrap.php';

require_admin();
if (method() !== 'GET') {
    fail('Metoda ni dovoljena.', 405);
}

// Gesel (zgoščenk) ne izvozimo.
$data = [
    'exported'       => date('c'),
    'settings'       => settings_all(),
    'classes'        => q('SELECT id, year, letter, name, school_year, active FROM classes ORDER BY id')->fetchAll(),
    'users'          => q('SELECT id, ime, priimek, email, role, status, telefon, class_id, last_login, created_at
                             FROM users ORDER BY id')->fetchAll(),
    'parent_student'    => q('SELECT parent_id, student_id FROM parent_student')->fetchAll(),
    'subjects'       => q('SELECT id, name, teacher_id FROM subjects ORDER BY id')->fetchAll(),
    'subject_classes' => q('SELECT subject_id, class_id FROM subject_classes')->fetchAll(),
    'reports'        => q('SELECT id, title, created_at FROM reports ORDER BY id')->fetchAll(),
];
// skrivnih nastavitev ni, a za vsak primer ne izvažamo ničesar, kar bi zvenelo kot geslo
foreach (array_keys($data['settings']) as $k) {
    if (stripos($k, 'pass') !== false || stripos($k, 'secret') !== false) {
        unset($data['settings'][$k]);
    }
}
json_out($data);
