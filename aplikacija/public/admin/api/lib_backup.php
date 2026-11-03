<?php
// Varnostna kopija baze v čistem PHP (ne potrebuje mysqldump).
require_once __DIR__ . '/bootstrap.php';

function make_backup($kind = 'rocno')
{
    $dir = BACKUP_DIR;
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
        throw new RuntimeException('Mape za kopije ni mogoče ustvariti.');
    }
    // zaščita mape pred javnim dostopom (Apache)
    $ht = $dir . '/.htaccess';
    if (!file_exists($ht)) {
        file_put_contents($ht, "Require all denied\nDeny from all\n");
    }

    $filename = 'sola-' . date('Y-m-d_His') . '.sql';
    $path     = $dir . '/' . $filename;
    $fh = fopen($path, 'wb');
    if (!$fh) {
        throw new RuntimeException('Datoteke za kopijo ni mogoče ustvariti.');
    }

    $pdo = db();
    fwrite($fh, "-- Varnostna kopija " . DB_NAME . " – " . date('c') . "\n");
    fwrite($fh, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n");

    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $t) {
        $create = $pdo->query('SHOW CREATE TABLE `' . str_replace('`', '``', $t) . '`')->fetch(PDO::FETCH_NUM);
        fwrite($fh, "DROP TABLE IF EXISTS `$t`;\n" . $create[1] . ";\n\n");

        if ($t === 'login_attempts') {
            continue; // podatkov o poskusih prijave ne shranjujemo
        }
        $st = $pdo->query('SELECT * FROM `' . str_replace('`', '``', $t) . '`');
        $batch = [];
        while ($row = $st->fetch(PDO::FETCH_NUM)) {
            $vals = [];
            foreach ($row as $v) {
                $vals[] = $v === null ? 'NULL' : $pdo->quote((string)$v);
            }
            $batch[] = '(' . implode(',', $vals) . ')';
            if (count($batch) >= 100) {
                fwrite($fh, "INSERT INTO `$t` VALUES\n" . implode(",\n", $batch) . ";\n");
                $batch = [];
            }
        }
        if ($batch) {
            fwrite($fh, "INSERT INTO `$t` VALUES\n" . implode(",\n", $batch) . ";\n");
        }
        fwrite($fh, "\n");
    }
    fwrite($fh, "SET FOREIGN_KEY_CHECKS = 1;\n");
    fclose($fh);

    q('INSERT INTO backups (filename, size_bytes, kind) VALUES (?, ?, ?)', [$filename, (int)filesize($path), $kind]);

    // obdrži samo zadnjih 14 kopij
    $old = q('SELECT id, filename FROM backups ORDER BY created_at DESC, id DESC LIMIT 1000 OFFSET 14')->fetchAll();
    foreach ($old as $o) {
        $f = $dir . '/' . basename($o['filename']);
        if (is_file($f)) {
            @unlink($f);
        }
        q('DELETE FROM backups WHERE id = ?', [$o['id']]);
    }

    return ['filename' => $filename, 'created_at' => date('c')];
}
