<?php
require_once __DIR__ . '/bootstrap.php';

$u = require_admin(false);
json_out([
    'id'      => (int)$u['id'],
    'ime'     => $u['ime'],
    'priimek' => $u['priimek'],
    'name'    => full_name($u['ime'], $u['priimek']),
    'email'   => $u['email'],
    'csrf'    => $_SESSION['csrf'],
]);
