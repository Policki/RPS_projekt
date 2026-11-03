-- ============================================================
--  Skrbniška plošča šole – shema baze (MySQL 5.7+ / MariaDB 10.3+)
--  Uvoz: phpMyAdmin -> Uvozi -> izberi to datoteko
--  ALI:  mysql -u root -p < db/schema.sql
--  Skrbnika ustvariš z odpiranjem setup.php v brskalniku.
-- ============================================================

CREATE DATABASE IF NOT EXISTS sola_admin
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sola_admin;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS archive_log, reports, login_attempts, backups, settings,
    events, parent_student, subject_classes, subjects, users, classes;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------- razredi ----------
CREATE TABLE classes (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    year        TINYINT UNSIGNED NOT NULL,          -- letnik 1-4
    letter      CHAR(1) NOT NULL,                   -- oddelek A-D
    name        VARCHAR(10) NOT NULL,               -- npr. 3.A
    school_year VARCHAR(9) NOT NULL,                -- npr. 2026/2027
    active      TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_class (name, school_year)
) ENGINE=InnoDB;

-- ---------- uporabniki (skrbniki, učitelji, dijaki, starši) ----------
CREATE TABLE users (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ime           VARCHAR(60)  NOT NULL,
    priimek       VARCHAR(60)  NOT NULL DEFAULT '',
    email         VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,            -- '!' = brez možnosti prijave
    role          ENUM('admin','ucitelj','dijak','stars') NOT NULL,
    status        ENUM('aktiven','caka','povabljen') NOT NULL DEFAULT 'aktiven',
    telefon       VARCHAR(40)  NULL,
    jezik         ENUM('sl','en') NOT NULL DEFAULT 'sl',
    prefs         TEXT NULL,                        -- JSON z osebnimi stikali (profil)
    class_id      INT UNSIGNED NULL,                -- samo za dijake
    last_login    DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_email (email),
    KEY idx_role_status (role, status),
    CONSTRAINT fk_user_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- starš <-> otrok ----------
CREATE TABLE parent_student (
    parent_id  INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (parent_id, student_id),
    CONSTRAINT fk_ps_parent  FOREIGN KEY (parent_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ps_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- predmeti ----------
CREATE TABLE subjects (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(80) NOT NULL,
    teacher_id INT UNSIGNED NULL,
    UNIQUE KEY uq_subject_name (name),
    CONSTRAINT fk_subject_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE subject_classes (
    subject_id INT UNSIGNED NOT NULL,
    class_id   INT UNSIGNED NOT NULL,
    PRIMARY KEY (subject_id, class_id),
    CONSTRAINT fk_sc_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_sc_class   FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- koledar (dogodki skrbnika) ----------
CREATE TABLE events (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    title      VARCHAR(60) NOT NULL,
    event_date DATE NOT NULL,
    category   VARCHAR(30) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_user_date (user_id, event_date),
    CONSTRAINT fk_event_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- nastavitve sistema ----------
CREATE TABLE settings (
    skey   VARCHAR(60)  NOT NULL PRIMARY KEY,
    svalue VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB;

-- ---------- varnostne kopije ----------
CREATE TABLE backups (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    filename   VARCHAR(120) NOT NULL,
    size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
    kind       ENUM('rocno','samodejno') NOT NULL DEFAULT 'rocno',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- poskusi prijave (zaščita pred ugibanjem gesel) ----------
CREATE TABLE login_attempts (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email        VARCHAR(190) NOT NULL,
    ip           VARCHAR(45)  NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_email_time (email, attempted_at),
    KEY idx_ip_time (ip, attempted_at)
) ENGINE=InnoDB;

-- ---------- poročila (kartica na nadzorni plošči) ----------
CREATE TABLE reports (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(120) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- dnevnik arhiviranja šolskih let ----------
CREATE TABLE archive_log (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    school_year    VARCHAR(9) NOT NULL,
    classes_closed INT UNSIGNED NOT NULL DEFAULT 0,
    archived_by    INT UNSIGNED NULL,
    archived_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
--  ZAČETNI PODATKI
-- ============================================================

INSERT INTO settings (skey, svalue) VALUES
    ('ime',            'Naša šola'),
    ('mail',           'tajnistvo@sola.example'),
    ('leto',           '2026/2027'),
    ('cas',            'Europe/Ljubljana'),
    ('seja',           '30 minut'),
    ('freq',           'dnevno'),
    ('auto',           '1'),
    ('rocnaPotrditev', '1'),
    ('starsi',         '1'),
    ('novaPrijava',    '0'),
    ('uptimePct',      '99.9');

-- 16 razredov: 4 letniki x 4 oddelki
INSERT INTO classes (year, letter, name, school_year) VALUES
    (1,'A','1.A','2026/2027'),(1,'B','1.B','2026/2027'),(1,'C','1.C','2026/2027'),(1,'D','1.D','2026/2027'),
    (2,'A','2.A','2026/2027'),(2,'B','2.B','2026/2027'),(2,'C','2.C','2026/2027'),(2,'D','2.D','2026/2027'),
    (3,'A','3.A','2026/2027'),(3,'B','3.B','2026/2027'),(3,'C','3.C','2026/2027'),(3,'D','3.D','2026/2027'),
    (4,'A','4.A','2026/2027'),(4,'B','4.B','2026/2027'),(4,'C','4.C','2026/2027'),(4,'D','4.D','2026/2027');

-- Primeri uporabnikov (geslo '!' = prijava ni mogoča, dokler ne nastaviš gesla)
INSERT INTO users (ime, priimek, email, password_hash, role, status, class_id, last_login, created_at) VALUES
 ('Nina',   'Kovač',    'nina.kovac@sola.example',    '!', 'dijak',   'aktiven',   (SELECT id FROM classes WHERE name='3.A'), NOW() - INTERVAL 2 HOUR,  NOW() - INTERVAL 90 DAY),
 ('Maja',   'Horvat',   'maja.horvat@sola.example',   '!', 'ucitelj', 'aktiven',   NULL,                                      NOW() - INTERVAL 3 HOUR,  NOW() - INTERVAL 400 DAY),
 ('Luka',   'Novak',    'luka.novak@sola.example',    '!', 'dijak',   'aktiven',   (SELECT id FROM classes WHERE name='2.B'), NOW() - INTERVAL 1 DAY,   NOW() - INTERVAL 120 DAY),
 ('Ana',    'Zupan',    'ana.zupan@sola.example',     '!', 'stars',   'aktiven',   NULL,                                      NOW() - INTERVAL 4 HOUR,  NOW() - INTERVAL 150 DAY),
 ('Tomaž',  'Vidmar',   'tomaz.vidmar@sola.example',  '!', 'ucitelj', 'aktiven',   NULL,                                      NOW() - INTERVAL 1 DAY,   NOW() - INTERVAL 500 DAY),
 ('Jan',    'Krajnc',   'jan.krajnc@sola.example',    '!', 'dijak',   'aktiven',   (SELECT id FROM classes WHERE name='4.A'), NOW() - INTERVAL 3 DAY,   NOW() - INTERVAL 200 DAY),
 ('Eva',    'Potočnik', 'eva.potocnik@sola.example',  '!', 'dijak',   'caka',      (SELECT id FROM classes WHERE name='1.C'), NULL,                     NOW() - INTERVAL 1 DAY),
 ('Marko',  'Kos',      'marko.kos@sola.example',     '!', 'stars',   'povabljen', NULL,                                      NULL,                     NOW() - INTERVAL 1 DAY),
 ('Sara',   'Kolar',    'sara.kolar@sola.example',    '!', 'ucitelj', 'aktiven',   NULL,                                      NOW() - INTERVAL 1 HOUR,  NOW() - INTERVAL 300 DAY),
 ('Žan',    'Mlakar',   'zan.mlakar@sola.example',    '!', 'dijak',   'aktiven',   (SELECT id FROM classes WHERE name='2.A'), NOW() - INTERVAL 1 DAY,   NOW() - INTERVAL 80 DAY),
 ('Peter',  'Zajc',     'peter.zajc@sola.example',    '!', 'ucitelj', 'aktiven',   NULL,                                      NOW() - INTERVAL 2 DAY,   NOW() - INTERVAL 600 DAY),
 ('Matej',  'Golob',    'matej.golob@sola.example',   '!', 'ucitelj', 'aktiven',   NULL,                                      NOW() - INTERVAL 2 DAY,   NOW() - INTERVAL 600 DAY),
 ('Katja',  'Rozman',   'katja.rozman@sola.example',  '!', 'ucitelj', 'aktiven',   NULL,                                      NOW() - INTERVAL 5 DAY,   NOW() - INTERVAL 600 DAY),
 ('Urša',   'Pirc',     'ursa.pirc@sola.example',     '!', 'ucitelj', 'aktiven',   NULL,                                      NOW() - INTERVAL 1 DAY,   NOW() - INTERVAL 600 DAY),
 ('Boštjan','Oražem',   'bostjan.orazem@sola.example','!', 'ucitelj', 'aktiven',   NULL,                                      NOW() - INTERVAL 3 DAY,   NOW() - INTERVAL 600 DAY);

INSERT INTO parent_student (parent_id, student_id) VALUES
 ((SELECT id FROM users WHERE email='ana.zupan@sola.example'),  (SELECT id FROM users WHERE email='jan.krajnc@sola.example')),
 ((SELECT id FROM users WHERE email='marko.kos@sola.example'),  (SELECT id FROM users WHERE email='eva.potocnik@sola.example'));

INSERT INTO subjects (name, teacher_id) VALUES
 ('Matematika',     (SELECT id FROM users WHERE email='maja.horvat@sola.example')),
 ('Slovenščina',    (SELECT id FROM users WHERE email='tomaz.vidmar@sola.example')),
 ('Angleščina',     (SELECT id FROM users WHERE email='sara.kolar@sola.example')),
 ('Zgodovina',      (SELECT id FROM users WHERE email='peter.zajc@sola.example')),
 ('Fizika',         (SELECT id FROM users WHERE email='matej.golob@sola.example')),
 ('Biologija',      (SELECT id FROM users WHERE email='katja.rozman@sola.example')),
 ('Kemija',         (SELECT id FROM users WHERE email='ursa.pirc@sola.example')),
 ('Geografija',     NULL),
 ('Športna vzgoja', (SELECT id FROM users WHERE email='bostjan.orazem@sola.example'));

-- povezave predmet <-> razred
INSERT INTO subject_classes (subject_id, class_id)
SELECT s.id, c.id FROM subjects s JOIN classes c ON (
    (s.name='Matematika'     AND c.name IN ('1.A','2.A','3.A','4.A')) OR
    (s.name='Slovenščina'    AND c.name IN ('1.B','2.B','3.B','4.B')) OR
    (s.name='Angleščina'     AND c.name IN ('1.C','2.C','3.C')) OR
    (s.name='Zgodovina'      AND c.name IN ('2.D','3.D')) OR
    (s.name='Fizika'         AND c.name IN ('3.A','4.A')) OR
    (s.name='Biologija'      AND c.name IN ('2.A','2.B')) OR
    (s.name='Kemija'         AND c.name IN ('3.B','3.C')) OR
    (s.name='Geografija'     AND c.name IN ('3.C')) OR
    (s.name='Športna vzgoja' AND c.name IN ('1.A','1.B','1.C','1.D'))
);
