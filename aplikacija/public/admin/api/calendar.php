<?php
require_once __DIR__ . '/bootstrap.php';

$admin = require_admin();
$uid   = (int)$admin['id'];
$CATEGORIES = ['matematika', 'informatika', 'fizika', 'slovenscina', 'anglescina', 'zgodovina'];

function event_row($r)
{
    return [
        'id'       => (int)$r['id'],
        'title'    => $r['title'],
        'date'     => $r['event_date'],
        'category' => $r['category'],
    ];
}

if (method() === 'GET') {
    $rows = q('SELECT id, title, event_date, category FROM events
                WHERE user_id = ? ORDER BY event_date, id LIMIT 3000', [$uid])->fetchAll();
    json_out(['events' => array_map('event_row', $rows)]);
}

if (method() === 'POST') {
    $in    = read_json();
    $title = str_field($in, 'title', 60);
    $date  = str_field($in, 'date', 10);
    $cat   = str_field($in, 'category', 30);

    if ($title === '') {
        fail('Vnesi ime dogodka.', 422);
    }
    $d = DateTime::createFromFormat('Y-m-d', $date);
    if (!$d || $d->format('Y-m-d') !== $date) {
        fail('Neveljaven datum.', 422);
    }
    if (!in_array($cat, $CATEGORIES, true)) {
        fail('Neveljaven predmet.', 422);
    }
    q('INSERT INTO events (user_id, title, event_date, category) VALUES (?, ?, ?, ?)', [$uid, $title, $date, $cat]);
    $id  = (int)db()->lastInsertId();
    $row = q('SELECT id, title, event_date, category FROM events WHERE id = ?', [$id])->fetch();
    json_out(['event' => event_row($row)], 201);
}

if (method() === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    $st = q('DELETE FROM events WHERE id = ? AND user_id = ?', [$id, $uid]);
    if ($st->rowCount() === 0) {
        fail('Dogodek ne obstaja.', 404);
    }
    json_out(['ok' => true]);
}

fail('Metoda ni dovoljena.', 405);
