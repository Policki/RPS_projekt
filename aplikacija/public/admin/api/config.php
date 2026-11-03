<?php
const DB_HOST = '127.0.0.1';
const DB_NAME = 'sola_admin';
const DB_USER = 'root';
const DB_PASS = '';          // XAMPP: prazno geslo. Na pravem strežniku NUJNO nastavi!

const APP_TIMEZONE = 'Europe/Ljubljana';
const APP_DEBUG    = false;  // true = podrobne napake v odgovoru (samo med razvojem)

// Mapa za varnostne kopije (zunaj javnega dela je še bolje)
const BACKUP_DIR = __DIR__ . '/../backups';
