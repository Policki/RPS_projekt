<?php
require_once __DIR__ . '/bootstrap.php';

require_admin();

function subjects_payload()
{
    $subjects = [];
    $rows = q("SELECT s.id, s.name, s.teacher_id, u.ime, u.priimek
                 FROM subjects s LEFT JOIN users u ON u.id = s.teacher_id
                ORDER BY s.id")->fetchAll();
    $cls = [];
    foreach (q("SELECT sc.subject_id, c.id, c.name
                  FROM subject_classes sc JOIN classes c ON c.id = sc.class_id
                 WHERE c.active = 1 ORDER BY c.year, c.letter")->fetchAll() as $r) {
        $cls[(int)$r['subject_id']][] = ['id' => (int)$r['id'], 'name' => $r['name']];
    }
    foreach ($rows as $r) {
        $sid = (int)$r['id'];
        $list = isset($cls[$sid]) ? $cls[$sid] : [];
        $subjects[] = [
            'id'         => $sid,
            'name'       => $r['name'],
            'teacher_id' => $r['teacher_id'] !== null ? (int)$r['teacher_id'] : null,
            'teacher'    => $r['teacher_id'] !== null ? full_name($r['ime'], $r['priimek']) : null,
            'class_ids'  => array_column($list, 'id'),
            'classes'    => array_column($list, 'name'),
        ];
    }

    $teachers = [];
    foreach (q("SELECT id, ime, priimek FROM users WHERE role = 'ucitelj' ORDER BY priimek, ime")->fetchAll() as $t) {
        $teachers[] = ['id' => (int)$t['id'], 'name' => full_name($t['ime'], $t['priimek'])];
    }

    $classes = [];
    foreach (q("SELECT id, year, letter, name FROM classes WHERE active = 1 ORDER BY year, letter")->fetchAll() as $c) {
        $classes[] = ['id' => (int)$c['id'], 'year' => (int)$c['year'], 'letter' => $c['letter'], 'name' => $c['name']];
    }

    $years   = (int)q("SELECT COUNT(DISTINCT year)   FROM classes WHERE active = 1")->fetchColumn();
    $letters = (int)q("SELECT COUNT(DISTINCT letter) FROM classes WHERE active = 1")->fetchColumn();

    return [
        'subjects' => $subjects,
        'teachers' => $teachers,
        'classes'  => $classes,
        'stats'    => [
            'classes'    => count($classes),
            'years'      => $years,
            'sections'   => $letters,
            'subjects'   => count($subjects),
            'unassigned' => count(array_filter($subjects, function ($s) { return $s['teacher_id'] === null; })),
        ],
    ];
}

function clean_class_ids($in)
{
    $ids = [];
    if (isset($in['class_ids']) && is_array($in['class_ids'])) {
        foreach ($in['class_ids'] as $v) {
            $ids[(int)$v] = true;
        }
    }
    $ids = array_keys($ids);
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $found = (int)q("SELECT COUNT(*) FROM classes WHERE active = 1 AND id IN ($ph)", $ids)->fetchColumn();
        if ($found !== count($ids)) {
            fail('Izbran je neveljaven razred.', 422);
        }
    }
    return $ids;
}

function clean_teacher($in)
{
    if (!isset($in['teacher_id']) || $in['teacher_id'] === '' || $in['teacher_id'] === null) {
        return null;
    }
    $tid = (int)$in['teacher_id'];
    if (!q("SELECT 1 FROM users WHERE id = ? AND role = 'ucitelj'", [$tid])->fetchColumn()) {
        fail('Izbrani učitelj ne obstaja.', 422);
    }
    return $tid;
}

function save_classes($subjectId, $ids)
{
    q('DELETE FROM subject_classes WHERE subject_id = ?', [$subjectId]);
    foreach ($ids as $cid) {
        q('INSERT INTO subject_classes (subject_id, class_id) VALUES (?, ?)', [$subjectId, $cid]);
    }
}

if (method() === 'GET') {
    json_out(subjects_payload());
}

if (method() === 'POST') {
    $in   = read_json();
    $name = str_field($in, 'name', 80);
    if ($name === '') {
        fail('Vnesi ime predmeta.', 422);
    }
    if (q('SELECT 1 FROM subjects WHERE name = ?', [$name])->fetchColumn()) {
        fail('Predmet s tem imenom že obstaja.', 409);
    }
    $teacher = clean_teacher($in);
    $ids     = clean_class_ids($in);

    db()->beginTransaction();
    try {
        q('INSERT INTO subjects (name, teacher_id) VALUES (?, ?)', [$name, $teacher]);
        save_classes((int)db()->lastInsertId(), $ids);
        db()->commit();
    } catch (Exception $e) {
        db()->rollBack();
        throw $e;
    }
    json_out(subjects_payload(), 201);
}

if (method() === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if (!q('SELECT 1 FROM subjects WHERE id = ?', [$id])->fetchColumn()) {
        fail('Predmet ne obstaja.', 404);
    }
    $in = read_json();

    db()->beginTransaction();
    try {
        if (array_key_exists('teacher_id', $in)) {
            q('UPDATE subjects SET teacher_id = ? WHERE id = ?', [clean_teacher($in), $id]);
        }
        if (array_key_exists('name', $in)) {
            $name = str_field($in, 'name', 80);
            if ($name === '') {
                fail('Vnesi ime predmeta.', 422);
            }
            if (q('SELECT 1 FROM subjects WHERE name = ? AND id <> ?', [$name, $id])->fetchColumn()) {
                fail('Predmet s tem imenom že obstaja.', 409);
            }
            q('UPDATE subjects SET name = ? WHERE id = ?', [$name, $id]);
        }
        if (array_key_exists('class_ids', $in)) {
            save_classes($id, clean_class_ids($in));
        }
        db()->commit();
    } catch (Exception $e) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        throw $e;
    }
    json_out(subjects_payload());
}

if (method() === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    $st = q('DELETE FROM subjects WHERE id = ?', [$id]);
    if ($st->rowCount() === 0) {
        fail('Predmet ne obstaja.', 404);
    }
    json_out(subjects_payload());
}

fail('Metoda ni dovoljena.', 405);
