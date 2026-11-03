<?php
require_once __DIR__ . '/bootstrap.php';

$admin = require_admin();
$id    = (int)$admin['id'];

$PREF_DEFAULTS = ['twofa' => true, 'novi_vpisi' => true, 'sistemska' => true, 'povzetek' => false];

function profile_payload($id, $PREF_DEFAULTS)
{
    $u = q('SELECT ime, priimek, email, telefon, jezik, prefs FROM users WHERE id = ?', [$id])->fetch();
    $prefs = $PREF_DEFAULTS;
    $saved = $u['prefs'] ? json_decode($u['prefs'], true) : null;
    if (is_array($saved)) {
        foreach ($PREF_DEFAULTS as $k => $_) {
            if (isset($saved[$k])) {
                $prefs[$k] = (bool)$saved[$k];
            }
        }
    }
    return [
        'profile' => [
            'ime'     => $u['ime'],
            'priimek' => $u['priimek'],
            'eposta'  => $u['email'],
            'telefon' => (string)$u['telefon'],
            'jezik'   => $u['jezik'],
        ],
        'switches' => $prefs,
    ];
}

if (method() === 'GET') {
    json_out(profile_payload($id, $PREF_DEFAULTS));
}

if (method() === 'PUT') {
    $in = read_json();

    $ime     = str_field($in, 'ime', 60);
    $priimek = str_field($in, 'priimek', 60);
    $email   = mb_strtolower(str_field($in, 'eposta', 190));
    $telefon = str_field($in, 'telefon', 40);
    $jezik   = str_field($in, 'jezik', 2);

    if ($ime === '') {
        fail('Vnesi ime.', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Vnesi veljaven e-poštni naslov.', 422);
    }
    if ($telefon !== '' && !preg_match('/^[0-9 +()\/.-]{5,40}$/', $telefon)) {
        fail('Neveljavna telefonska številka.', 422);
    }
    if (!in_array($jezik, ['sl', 'en'], true)) {
        fail('Neveljaven jezik.', 422);
    }
    if (q('SELECT 1 FROM users WHERE email = ? AND id <> ?', [$email, $id])->fetchColumn()) {
        fail('Ta e-poštni naslov že uporablja drug račun.', 409);
    }

    $prefs = [];
    $incoming = (isset($in['switches']) && is_array($in['switches'])) ? $in['switches'] : [];
    foreach ($PREF_DEFAULTS as $k => $def) {
        $prefs[$k] = array_key_exists($k, $incoming) ? (bool)$incoming[$k] : $def;
    }

    q('UPDATE users SET ime = ?, priimek = ?, email = ?, telefon = ?, jezik = ?, prefs = ? WHERE id = ?',
      [$ime, $priimek, $email, $telefon === '' ? null : $telefon, $jezik, json_encode($prefs), $id]);

    json_out(profile_payload($id, $PREF_DEFAULTS));
}

fail('Metoda ni dovoljena.', 405);
