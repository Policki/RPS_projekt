<?php
require_once __DIR__ . '/bootstrap.php';

$admin = require_admin();
$ROLES    = ['dijak', 'ucitelj', 'stars'];
$STATUSES = ['aktiven', 'caka', 'povabljen'];

/* ---------- pomožne ---------- */
function user_rows($where, $params, $limit = 0, $offset = 0)
{
    $sql = "
        SELECT u.id, u.ime, u.priimek, u.email, u.role, u.status, u.last_login, u.class_id,
               c.name AS class_name,
               (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ')
                  FROM subjects s WHERE s.teacher_id = u.id) AS subjects,
               (SELECT GROUP_CONCAT(TRIM(CONCAT(ch.ime, ' ', ch.priimek)) ORDER BY ch.ime SEPARATOR ', ')
                  FROM parent_student ps JOIN users ch ON ch.id = ps.student_id
                 WHERE ps.parent_id = u.id) AS children,
               (SELECT ps2.student_id FROM parent_student ps2
                 WHERE ps2.parent_id = u.id ORDER BY ps2.student_id LIMIT 1) AS child_id
          FROM users u
          LEFT JOIN classes c ON c.id = u.class_id
         WHERE u.role <> 'admin' $where
         ORDER BY u.created_at DESC, u.id DESC";
    if ($limit > 0) {
        $sql .= ' LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset;
    }
    $out = [];
    foreach (q($sql, $params)->fetchAll() as $r) {
        if ($r['role'] === 'dijak') {
            $detail = $r['class_name'] ?: '—';
        } elseif ($r['role'] === 'ucitelj') {
            $detail = $r['subjects'] ?: '—';
        } else {
            $detail = $r['children'] ? 'Otrok: ' . $r['children'] : '—';
        }
        $out[] = [
            'id'       => (int)$r['id'],
            'ime'      => $r['ime'],
            'priimek'  => $r['priimek'],
            'name'     => full_name($r['ime'], $r['priimek']),
            'email'    => $r['email'],
            'role'     => $r['role'],
            'detail'   => $detail,
            'class_id' => $r['class_id'] !== null ? (int)$r['class_id'] : null,
            'child_id' => $r['child_id'] !== null ? (int)$r['child_id'] : null,
            'last'     => iso($r['last_login']),
            'status'   => $r['status'],
        ];
    }
    return $out;
}

function validate_user_input($in, $isCreate, $ROLES, $STATUSES)
{
    $d = [];
    $d['ime']     = str_field($in, 'ime', 60);
    $d['priimek'] = str_field($in, 'priimek', 60);
    $d['email']   = mb_strtolower(str_field($in, 'email', 190));
    if ($d['ime'] === '') {
        fail('Vnesi ime.', 422);
    }
    if (!filter_var($d['email'], FILTER_VALIDATE_EMAIL)) {
        fail('Vnesi veljaven e-poštni naslov.', 422);
    }
    $d['role'] = isset($in['role']) ? (string)$in['role'] : '';
    if ($isCreate && !in_array($d['role'], $ROLES, true)) {
        fail('Izberi vlogo.', 422);
    }
    $d['status'] = isset($in['status']) ? (string)$in['status'] : 'povabljen';
    if (!in_array($d['status'], $STATUSES, true)) {
        fail('Neveljaven status.', 422);
    }
    $d['class_id'] = (isset($in['class_id']) && $in['class_id'] !== '') ? (int)$in['class_id'] : null;
    $d['child_id'] = (isset($in['child_id']) && $in['child_id'] !== '') ? (int)$in['child_id'] : null;
    $d['password'] = isset($in['password']) ? (string)$in['password'] : '';
    if ($d['password'] !== '' && mb_strlen($d['password']) < 8) {
        fail('Geslo mora imeti vsaj 8 znakov.', 422);
    }
    return $d;
}

function check_links($role, $d)
{
    if ($role === 'dijak' && $d['class_id'] !== null) {
        if (!q('SELECT 1 FROM classes WHERE id = ? AND active = 1', [$d['class_id']])->fetchColumn()) {
            fail('Izbrani razred ne obstaja.', 422);
        }
    }
    if ($role === 'stars' && $d['child_id'] !== null) {
        if (!q("SELECT 1 FROM users WHERE id = ? AND role = 'dijak'", [$d['child_id']])->fetchColumn()) {
            fail('Izbrani dijak ne obstaja.', 422);
        }
    }
}

function set_child($parentId, $childId)
{
    q('DELETE FROM parent_student WHERE parent_id = ?', [$parentId]);
    if ($childId !== null) {
        q('INSERT INTO parent_student (parent_id, student_id) VALUES (?, ?)', [$parentId, $childId]);
    }
}

/* ---------- GET: seznam ---------- */
if (method() === 'GET') {

    // CSV izvoz
    if (($_GET['export'] ?? '') === 'csv') {
        $rows = user_rows('', []);
        $labels = ['dijak' => 'Dijak', 'ucitelj' => 'Učitelj', 'stars' => 'Starš'];
        $stat   = ['aktiven' => 'Aktiven', 'caka' => 'Čaka potrditev', 'povabljen' => 'Povabljen'];
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="uporabniki-' . date('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF"); // BOM za pravilne šumnike v Excelu
        $csvSafe = function ($v) {
            $v = (string)$v;
            // zaščita pred "CSV injection" v Excelu
            return (strlen($v) && strpos("=+-@\t\r", $v[0]) !== false) ? "'" . $v : $v;
        };
        fputcsv($out, ['Ime in priimek', 'E-pošta', 'Vloga', 'Povezava', 'Zadnja prijava', 'Status'], ';', '"', '\\');
        foreach ($rows as $r) {
            fputcsv($out, [
                $csvSafe($r['name']), $csvSafe($r['email']), $labels[$r['role']], $csvSafe($r['detail']),
                $r['last'] ? date('d.m.Y H:i', strtotime($r['last'])) : '', $stat[$r['status']],
            ], ';', '"', '\\');
        }
        fclose($out);
        exit;
    }

    $role = $_GET['role'] ?? 'vsi';
    $qs   = trim((string)($_GET['q'] ?? ''));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $per  = min(50, max(5, (int)($_GET['per'] ?? 10)));

    $where  = '';
    $params = [];
    if (in_array($role, $ROLES, true)) {
        $where .= ' AND u.role = ?';
        $params[] = $role;
    }
    if ($qs !== '') {
        $where .= " AND (CONCAT(u.ime, ' ', u.priimek) LIKE ? OR u.email LIKE ?)";
        $like = '%' . like_escape(mb_substr($qs, 0, 80)) . '%';
        $params[] = $like;
        $params[] = $like;
    }

    $total = (int)q("SELECT COUNT(*) FROM users u WHERE u.role <> 'admin' $where", $params)->fetchColumn();
    $pages = max(1, (int)ceil($total / $per));
    $page  = min($page, $pages);

    $counts = ['vsi' => 0, 'dijak' => 0, 'ucitelj' => 0, 'stars' => 0];
    foreach (q("SELECT role, COUNT(*) n FROM users WHERE role <> 'admin' GROUP BY role")->fetchAll() as $r) {
        $counts[$r['role']] = (int)$r['n'];
        $counts['vsi'] += (int)$r['n'];
    }
    $summary = [
        'active'  => (int)q("SELECT COUNT(*) FROM users WHERE role <> 'admin' AND status = 'aktiven'")->fetchColumn(),
        'newWeek' => (int)q("SELECT COUNT(*) FROM users WHERE role <> 'admin' AND created_at >= NOW() - INTERVAL 7 DAY")->fetchColumn(),
        'activeTeachers' => (int)q("SELECT COUNT(*) FROM users WHERE role = 'ucitelj' AND status = 'aktiven'")->fetchColumn(),
        'linkedParents'  => (int)q("SELECT COUNT(DISTINCT parent_id) FROM parent_student")->fetchColumn(),
    ];

    // seznami za obrazec (razredi, dijaki)
    $classes = q("SELECT id, name FROM classes WHERE active = 1 ORDER BY year, letter")->fetchAll();
    $studentsList = [];
    foreach (q("SELECT id, ime, priimek FROM users WHERE role = 'dijak' ORDER BY priimek, ime")->fetchAll() as $s) {
        $studentsList[] = ['id' => (int)$s['id'], 'name' => full_name($s['ime'], $s['priimek'])];
    }

    json_out([
        'users'    => user_rows($where, $params, $per, ($page - 1) * $per),
        'total'    => $total,
        'page'     => $page,
        'pages'    => $pages,
        'per'      => $per,
        'counts'   => $counts,
        'summary'  => $summary,
        'classes'  => $classes,
        'students' => $studentsList,
    ]);
}

/* ---------- POST: nov uporabnik ---------- */
if (method() === 'POST') {
    $in = read_json();
    $d  = validate_user_input($in, true, $ROLES, $STATUSES);
    check_links($d['role'], $d);

    if (q('SELECT 1 FROM users WHERE email = ?', [$d['email']])->fetchColumn()) {
        fail('Uporabnik s tem e-poštnim naslovom že obstaja.', 409);
    }
    $hash = $d['password'] !== '' ? password_hash($d['password'], PASSWORD_DEFAULT) : '!';
    $classId = $d['role'] === 'dijak' ? $d['class_id'] : null;

    db()->beginTransaction();
    try {
        q('INSERT INTO users (ime, priimek, email, password_hash, role, status, class_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)',
          [$d['ime'], $d['priimek'], $d['email'], $hash, $d['role'], $d['status'], $classId]);
        $id = (int)db()->lastInsertId();
        if ($d['role'] === 'stars') {
            set_child($id, $d['child_id']);
        }
        db()->commit();
    } catch (Exception $e) {
        db()->rollBack();
        throw $e;
    }
    $row = user_rows(' AND u.id = ?', [$id]);
    json_out(['user' => $row[0]], 201);
}

/* ---------- PUT: urejanje ---------- */
if (method() === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    $cur = q("SELECT id, role FROM users WHERE id = ? AND role <> 'admin'", [$id])->fetch();
    if (!$cur) {
        fail('Uporabnik ne obstaja.', 404);
    }
    $in = read_json();

    // hitra akcija: potrditev vpisa
    if (($in['action'] ?? '') === 'approve') {
        q("UPDATE users SET status = 'aktiven' WHERE id = ?", [$id]);
        $row = user_rows(' AND u.id = ?', [$id]);
        json_out(['user' => $row[0]]);
    }

    $in['role'] = $cur['role']; // vloge ne spreminjamo
    $d = validate_user_input($in, false, $ROLES, $STATUSES);
    check_links($cur['role'], $d);

    if (q('SELECT 1 FROM users WHERE email = ? AND id <> ?', [$d['email'], $id])->fetchColumn()) {
        fail('Uporabnik s tem e-poštnim naslovom že obstaja.', 409);
    }

    db()->beginTransaction();
    try {
        q('UPDATE users SET ime = ?, priimek = ?, email = ?, status = ?, class_id = ? WHERE id = ?',
          [$d['ime'], $d['priimek'], $d['email'], $d['status'],
           $cur['role'] === 'dijak' ? $d['class_id'] : null, $id]);
        if ($d['password'] !== '') {
            q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($d['password'], PASSWORD_DEFAULT), $id]);
        }
        if ($cur['role'] === 'stars') {
            set_child($id, $d['child_id']);
        }
        db()->commit();
    } catch (Exception $e) {
        db()->rollBack();
        throw $e;
    }
    $row = user_rows(' AND u.id = ?', [$id]);
    json_out(['user' => $row[0]]);
}

/* ---------- DELETE ---------- */
if (method() === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    $st = q("DELETE FROM users WHERE id = ? AND role <> 'admin'", [$id]);
    if ($st->rowCount() === 0) {
        fail('Uporabnik ne obstaja.', 404);
    }
    json_out(['ok' => true]);
}

fail('Metoda ni dovoljena.', 405);
