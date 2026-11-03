<?php
require_once __DIR__ . '/bootstrap.php';

require_admin();

$BOOLS = ['auto', 'rocnaPotrditev', 'starsi', 'novaPrijava'];
$SEJE  = ['30 minut', '1 ura', '4 ure'];
$FREQ  = ['dnevno', 'tedensko'];

function settings_payload($BOOLS)
{
    $s = settings_all();
    $out = [
        'ime'  => $s['ime']  ?? '',
        'mail' => $s['mail'] ?? '',
        'leto' => $s['leto'] ?? '2026/2027',
        'cas'  => $s['cas']  ?? 'Europe/Ljubljana',
        'seja' => $s['seja'] ?? '30 minut',
        'freq' => $s['freq'] ?? 'dnevno',
    ];
    foreach ($BOOLS as $b) {
        $out[$b] = ($s[$b] ?? '0') === '1';
    }
    $total = @disk_total_space(__DIR__);
    $free  = @disk_free_space(__DIR__);
    $last  = q('SELECT MAX(created_at) FROM backups')->fetchColumn();
    return [
        'settings'    => $out,
        'lastBackup'  => iso($last),
        'diskUsedPct' => ($total && $free !== false) ? (int)round((1 - $free / $total) * 100) : 0,
    ];
}

if (method() === 'GET') {
    json_out(settings_payload($BOOLS));
}

if (method() === 'PUT') {
    $in = read_json();

    $ime  = str_field($in, 'ime', 120);
    $mail = str_field($in, 'mail', 190);
    $leto = str_field($in, 'leto', 9);
    $cas  = str_field($in, 'cas', 60);
    $seja = str_field($in, 'seja', 20);
    $freq = str_field($in, 'freq', 20);

    if ($mail !== '' && !filter_var($mail, FILTER_VALIDATE_EMAIL)) {
        fail('Vnesi veljaven e-poštni naslov šole.', 422);
    }
    if (!preg_match('/^\d{4}\/\d{4}$/', $leto)) {
        fail('Neveljavno šolsko leto.', 422);
    }
    if (!in_array($cas, DateTimeZone::listIdentifiers(), true)) {
        fail('Neveljaven časovni pas.', 422);
    }
    if (!in_array($seja, $SEJE, true)) {
        fail('Neveljaven potek seje.', 422);
    }
    if (!in_array($freq, $FREQ, true)) {
        fail('Neveljavna pogostost kopij.', 422);
    }

    db()->beginTransaction();
    try {
        set_setting('ime', $ime);
        set_setting('mail', $mail);
        set_setting('leto', $leto);
        set_setting('cas', $cas);
        set_setting('seja', $seja);
        set_setting('freq', $freq);
        foreach ($BOOLS as $b) {
            set_setting($b, !empty($in[$b]) ? '1' : '0');
        }
        db()->commit();
    } catch (Exception $e) {
        db()->rollBack();
        throw $e;
    }
    json_out(settings_payload($BOOLS));
}

fail('Metoda ni dovoljena.', 405);
