-- SOLSKI SISTEM - MariaDB
-- Skripto zazeni enkrat v prazni bazi. Vsebuje strukturo in testne podatke.
-- Geslo vseh testnih racunov je Geslo123! (v tabeli je shranjen bcrypt hash).
-- Uporabniska imena: profesor01 do profesor20, dijak001 do dijak100, admin.

CREATE DATABASE IF NOT EXISTS sola_is
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE sola_is;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- 1. UPORABNIKI IN PROFILI

CREATE TABLE Uporabnik (
    id_uporabnik INT PRIMARY KEY AUTO_INCREMENT,
    uporabnisko_ime VARCHAR(50) NOT NULL UNIQUE,
    ime VARCHAR(50) NOT NULL,
    priimek VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    geslo_hash VARCHAR(255) NOT NULL,
    vloga VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'caka',
    telefon VARCHAR(32),
    opis TEXT,
    avatar_kljuc VARCHAR(255),
    jezik VARCHAR(5) NOT NULL DEFAULT 'sl',
    zadnja_prijava DATETIME,
    ustvarjeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_uporabnik_ime CHECK (CHAR_LENGTH(TRIM(ime)) > 0),
    CONSTRAINT ck_uporabnik_priimek CHECK (CHAR_LENGTH(TRIM(priimek)) > 0),
    CONSTRAINT ck_uporabnik_ime_prijava CHECK (CHAR_LENGTH(TRIM(uporabnisko_ime)) > 0),
    CONSTRAINT ck_uporabnik_email CHECK (CHAR_LENGTH(TRIM(email)) > 0),
    CONSTRAINT ck_uporabnik_vloga CHECK (vloga IN ('dijak', 'profesor', 'administrator')),
    CONSTRAINT ck_uporabnik_status CHECK (status IN ('caka', 'aktiven', 'onemogocen')),
    CONSTRAINT ck_uporabnik_jezik CHECK (jezik IN ('sl', 'en'))
) ENGINE=InnoDB;

CREATE TABLE Dijak (
    id_dijak INT PRIMARY KEY AUTO_INCREMENT,
    id_uporabnik INT NOT NULL UNIQUE,
    CONSTRAINT fk_dijak_uporabnik FOREIGN KEY (id_uporabnik) REFERENCES Uporabnik(id_uporabnik)
) ENGINE=InnoDB;

CREATE TABLE Profesor (
    id_profesor INT PRIMARY KEY AUTO_INCREMENT,
    id_uporabnik INT NOT NULL UNIQUE,
    CONSTRAINT fk_profesor_uporabnik FOREIGN KEY (id_uporabnik) REFERENCES Uporabnik(id_uporabnik)
) ENGINE=InnoDB;

-- 2. PROGRAMI, RAZREDI IN PREDMETI

CREATE TABLE Program (
    id_program INT PRIMARY KEY AUTO_INCREMENT,
    oznaka VARCHAR(20) NOT NULL UNIQUE,
    naziv VARCHAR(150) NOT NULL,
    aktiven BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT ck_program_naziv CHECK (CHAR_LENGTH(TRIM(naziv)) > 0),
    CONSTRAINT ck_program_aktiven CHECK (aktiven IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE Solsko_leto (
    id_solsko_leto INT PRIMARY KEY AUTO_INCREMENT,
    zacetno_leto INT NOT NULL UNIQUE,
    datum_zacetka DATE NOT NULL,
    datum_konca DATE NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'odprto',
    CONSTRAINT ck_leto_datuma CHECK (datum_konca > datum_zacetka),
    CONSTRAINT ck_leto_status CHECK (status IN ('odprto', 'arhivirano'))
) ENGINE=InnoDB;

CREATE TABLE Razred (
    id_razred INT PRIMARY KEY AUTO_INCREMENT,
    id_program INT NOT NULL,
    id_solsko_leto INT NOT NULL,
    letnik INT NOT NULL,
    oznaka VARCHAR(10) NOT NULL,
    id_razrednik INT,

    CONSTRAINT fk_razred_program FOREIGN KEY (id_program) REFERENCES Program(id_program),
    CONSTRAINT fk_razred_leto FOREIGN KEY (id_solsko_leto) REFERENCES Solsko_leto(id_solsko_leto),
    CONSTRAINT fk_razred_razrednik FOREIGN KEY (id_razrednik) REFERENCES Profesor(id_profesor) ON DELETE SET NULL,
    CONSTRAINT uq_razred UNIQUE (id_program, id_solsko_leto, letnik, oznaka),
    CONSTRAINT uq_razred_leto UNIQUE (id_razred, id_solsko_leto),
    CONSTRAINT ck_razred_letnik CHECK (letnik BETWEEN 1 AND 4),
    CONSTRAINT ck_razred_oznaka CHECK (CHAR_LENGTH(TRIM(oznaka)) > 0)
) ENGINE=InnoDB;

-- Dijak ima v enem solskem letu en razred.
-- Sestavljeni tuji kljuc preveri tudi, da je razred iz pravega leta.
CREATE TABLE Vpis_v_razred (
    id_dijak INT NOT NULL,
    id_solsko_leto INT NOT NULL,
    id_razred INT NOT NULL,
    ustvarjeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_dijak, id_solsko_leto),
    CONSTRAINT fk_vpis_dijak FOREIGN KEY (id_dijak) REFERENCES Dijak(id_dijak),
    CONSTRAINT fk_vpis_razred_leto FOREIGN KEY (id_razred, id_solsko_leto)
        REFERENCES Razred(id_razred, id_solsko_leto)
) ENGINE=InnoDB;

CREATE TABLE Predmet (
    id_predmet INT PRIMARY KEY AUTO_INCREMENT,
    sifra VARCHAR(20) NOT NULL UNIQUE,
    naziv VARCHAR(100) NOT NULL UNIQUE,
    opis TEXT,
    barva CHAR(7) NOT NULL DEFAULT '#7b9058',
    aktiven BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT ck_predmet_naziv CHECK (CHAR_LENGTH(TRIM(naziv)) > 0),
    CONSTRAINT ck_predmet_aktiven CHECK (aktiven IN (0, 1))
) ENGINE=InnoDB;

-- Predmet je npr. Matematika, izvedba pa Matematika za 3. RAC v dolocenem letu.
CREATE TABLE Izvedba_predmeta (
    id_izvedba INT PRIMARY KEY AUTO_INCREMENT,
    id_predmet INT NOT NULL,
    id_razred INT NOT NULL,
    aktivna BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT fk_izvedba_predmet FOREIGN KEY (id_predmet) REFERENCES Predmet(id_predmet),
    CONSTRAINT fk_izvedba_razred FOREIGN KEY (id_razred) REFERENCES Razred(id_razred),
    CONSTRAINT uq_izvedba UNIQUE (id_predmet, id_razred),
    CONSTRAINT ck_izvedba_aktivna CHECK (aktivna IN (0, 1))
) ENGINE=InnoDB;

-- Povezava M:N: izvedba ima vec profesorjev, profesor vec izvedb.
CREATE TABLE Profesor_izvedba (
    id_profesor INT NOT NULL,
    id_izvedba INT NOT NULL,
    aktivna BOOLEAN NOT NULL DEFAULT 1,
    PRIMARY KEY (id_profesor, id_izvedba),
    CONSTRAINT fk_pi_profesor FOREIGN KEY (id_profesor) REFERENCES Profesor(id_profesor),
    CONSTRAINT fk_pi_izvedba FOREIGN KEY (id_izvedba) REFERENCES Izvedba_predmeta(id_izvedba),
    CONSTRAINT ck_pi_aktivna CHECK (aktivna IN (0, 1))
) ENGINE=InnoDB;

-- Povezava M:N: tukaj je zapisano, katere predmete dijak dejansko obiskuje.
CREATE TABLE Dijak_izvedba (
    id_dijak INT NOT NULL,
    id_izvedba INT NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'caka',
    ustvarjeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_dijak, id_izvedba),
    CONSTRAINT fk_di_dijak FOREIGN KEY (id_dijak) REFERENCES Dijak(id_dijak),
    CONSTRAINT fk_di_izvedba FOREIGN KEY (id_izvedba) REFERENCES Izvedba_predmeta(id_izvedba),
    CONSTRAINT ck_di_status CHECK (status IN ('caka', 'aktiven', 'izpisan'))
) ENGINE=InnoDB;

-- 3. DATOTEKE, GRADIVA, NALOGE IN ODDAJE

-- V bazi so podatki o datoteki, sama datoteka je v zasciteni mapi na strezniku.
CREATE TABLE Datoteka (
    id_datoteka INT PRIMARY KEY AUTO_INCREMENT,
    id_lastnik INT NOT NULL,
    izvorno_ime VARCHAR(255) NOT NULL,
    shranjeno_ime VARCHAR(255) NOT NULL,
    storage_kljuc VARCHAR(255) NOT NULL UNIQUE,
    mime_tip VARCHAR(127) NOT NULL,
    velikost_bajtov BIGINT NOT NULL,
    ustvarjeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_datoteka_lastnik FOREIGN KEY (id_lastnik) REFERENCES Uporabnik(id_uporabnik),
    CONSTRAINT ck_datoteka_velikost CHECK (velikost_bajtov > 0)
) ENGINE=InnoDB;

CREATE TABLE Gradivo (
    id_gradivo INT PRIMARY KEY AUTO_INCREMENT,
    id_izvedba INT NOT NULL,
    id_profesor INT NOT NULL,
    naslov VARCHAR(200) NOT NULL,
    opis TEXT,
    vrsta VARCHAR(20) NOT NULL,
    id_datoteka INT,
    url VARCHAR(2048),
    trajanje_sekund INT,
    objavljeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    aktivno BOOLEAN NOT NULL DEFAULT 1,

    CONSTRAINT fk_gradivo_izvedba FOREIGN KEY (id_izvedba) REFERENCES Izvedba_predmeta(id_izvedba),
    CONSTRAINT fk_gradivo_ucitelj FOREIGN KEY (id_profesor, id_izvedba)
        REFERENCES Profesor_izvedba(id_profesor, id_izvedba),
    CONSTRAINT fk_gradivo_datoteka FOREIGN KEY (id_datoteka) REFERENCES Datoteka(id_datoteka),
    CONSTRAINT ck_gradivo_naslov CHECK (CHAR_LENGTH(TRIM(naslov)) > 0),
    CONSTRAINT ck_gradivo_vrsta CHECK (vrsta IN ('dokument', 'predstavitev', 'video', 'povezava')),
    CONSTRAINT ck_gradivo_vir CHECK (
        (id_datoteka IS NOT NULL AND url IS NULL)
        OR (id_datoteka IS NULL AND url IS NOT NULL AND CHAR_LENGTH(TRIM(url)) > 0)
    ),
    CONSTRAINT ck_gradivo_tip_vira CHECK (
        (vrsta IN ('dokument', 'predstavitev') AND id_datoteka IS NOT NULL)
        OR (vrsta = 'povezava' AND url IS NOT NULL)
        OR vrsta = 'video'
    ),
    CONSTRAINT ck_gradivo_trajanje CHECK (
        trajanje_sekund IS NULL OR (vrsta = 'video' AND trajanje_sekund > 0)
    ),
    CONSTRAINT ck_gradivo_aktivno CHECK (aktivno IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE Naloga (
    id_naloga INT PRIMARY KEY AUTO_INCREMENT,
    id_izvedba INT NOT NULL,
    id_profesor INT NOT NULL,
    naslov VARCHAR(200) NOT NULL,
    opis TEXT NOT NULL,
    objavljeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rok_oddaje DATETIME NOT NULL,
    max_tock DECIMAL(6,2),
    max_velikost_bajtov BIGINT NOT NULL DEFAULT 10485760,
    dovoljena_pozna_oddaja BOOLEAN NOT NULL DEFAULT 0,
    aktivna BOOLEAN NOT NULL DEFAULT 1,

    CONSTRAINT fk_naloga_izvedba FOREIGN KEY (id_izvedba) REFERENCES Izvedba_predmeta(id_izvedba),
    CONSTRAINT fk_naloga_ucitelj FOREIGN KEY (id_profesor, id_izvedba)
        REFERENCES Profesor_izvedba(id_profesor, id_izvedba),
    CONSTRAINT uq_naloga_izvedba UNIQUE (id_naloga, id_izvedba),
    CONSTRAINT ck_naloga_naslov CHECK (CHAR_LENGTH(TRIM(naslov)) > 0),
    CONSTRAINT ck_naloga_opis CHECK (CHAR_LENGTH(TRIM(opis)) > 0),
    CONSTRAINT ck_naloga_rok CHECK (rok_oddaje >= objavljeno),
    CONSTRAINT ck_naloga_tocke CHECK (max_tock IS NULL OR max_tock > 0),
    CONSTRAINT ck_naloga_velikost CHECK (max_velikost_bajtov > 0),
    CONSTRAINT ck_naloga_pozna CHECK (dovoljena_pozna_oddaja IN (0, 1)),
    CONSTRAINT ck_naloga_aktivna CHECK (aktivna IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE Oddaja (
    id_oddaja INT PRIMARY KEY AUTO_INCREMENT,
    id_naloga INT NOT NULL,
    id_izvedba INT NOT NULL,
    id_dijak INT NOT NULL,
    id_datoteka INT NOT NULL,
    komentar_dijaka TEXT,
    oddano_prvic DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    oddano_zadnjic DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verzija INT NOT NULL DEFAULT 1,

    CONSTRAINT uq_oddaja UNIQUE (id_naloga, id_dijak),
    CONSTRAINT fk_oddaja_naloga FOREIGN KEY (id_naloga, id_izvedba)
        REFERENCES Naloga(id_naloga, id_izvedba),
    CONSTRAINT fk_oddaja_vpis FOREIGN KEY (id_dijak, id_izvedba)
        REFERENCES Dijak_izvedba(id_dijak, id_izvedba),
    CONSTRAINT fk_oddaja_datoteka FOREIGN KEY (id_datoteka) REFERENCES Datoteka(id_datoteka),
    CONSTRAINT ck_oddaja_datuma CHECK (oddano_zadnjic >= oddano_prvic),
    CONSTRAINT ck_oddaja_verzija CHECK (verzija > 0)
) ENGINE=InnoDB;

-- Ena trenutna ocena pripada eni oddaji. Nova oddaja potrebuje nov pregled.
CREATE TABLE Ocena_oddaje (
    id_oddaja INT PRIMARY KEY,
    id_profesor INT NOT NULL,
    tocke DECIMAL(6,2),
    ocena INT,
    komentar TEXT,
    ocenjena_verzija INT NOT NULL,
    ocenjeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ocena_oddaja FOREIGN KEY (id_oddaja) REFERENCES Oddaja(id_oddaja) ON DELETE CASCADE,
    CONSTRAINT fk_ocena_profesor FOREIGN KEY (id_profesor) REFERENCES Profesor(id_profesor),
    CONSTRAINT ck_ocena_tocke CHECK (tocke IS NULL OR tocke >= 0),
    CONSTRAINT ck_ocena_vrednost CHECK (ocena IS NULL OR ocena BETWEEN 1 AND 5),
    CONSTRAINT ck_ocena_verzija CHECK (ocenjena_verzija > 0),
    CONSTRAINT ck_ocena_rezultat CHECK (
        tocke IS NOT NULL OR ocena IS NOT NULL
        OR (komentar IS NOT NULL AND CHAR_LENGTH(TRIM(komentar)) > 0)
    )
) ENGINE=InnoDB;

-- 4. KOLEDAR IN NASTAVITVE

CREATE TABLE Dogodek (
    id_dogodek INT PRIMARY KEY AUTO_INCREMENT,
    id_uporabnik INT NOT NULL,
    id_predmet INT,
    naslov VARCHAR(200) NOT NULL,
    datum DATE NOT NULL,
    opis TEXT,
    ustvarjeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dogodek_uporabnik FOREIGN KEY (id_uporabnik) REFERENCES Uporabnik(id_uporabnik) ON DELETE CASCADE,
    CONSTRAINT fk_dogodek_predmet FOREIGN KEY (id_predmet) REFERENCES Predmet(id_predmet) ON DELETE SET NULL,
    CONSTRAINT ck_dogodek_naslov CHECK (CHAR_LENGTH(TRIM(naslov)) > 0)
) ENGINE=InnoDB;

CREATE TABLE Nastavitve_uporabnika (
    id_uporabnik INT PRIMARY KEY,
    nova_naloga BOOLEAN NOT NULL DEFAULT 1,
    opomnik_rok BOOLEAN NOT NULL DEFAULT 1,
    novo_gradivo BOOLEAN NOT NULL DEFAULT 1,
    novi_vpisi BOOLEAN NOT NULL DEFAULT 0,
    sistemska_obvestila BOOLEAN NOT NULL DEFAULT 0,
    tedenski_povzetek BOOLEAN NOT NULL DEFAULT 0,
    CONSTRAINT fk_nastavitve_uporabnik FOREIGN KEY (id_uporabnik) REFERENCES Uporabnik(id_uporabnik) ON DELETE CASCADE,
    CONSTRAINT ck_nastavitve_naloga CHECK (nova_naloga IN (0, 1)),
    CONSTRAINT ck_nastavitve_rok CHECK (opomnik_rok IN (0, 1)),
    CONSTRAINT ck_nastavitve_gradivo CHECK (novo_gradivo IN (0, 1)),
    CONSTRAINT ck_nastavitve_vpisi CHECK (novi_vpisi IN (0, 1)),
    CONSTRAINT ck_nastavitve_sistem CHECK (sistemska_obvestila IN (0, 1)),
    CONSTRAINT ck_nastavitve_povzetek CHECK (tedenski_povzetek IN (0, 1))
) ENGINE=InnoDB;

-- Pri projektu je ena sola, zato je v tej tabeli samo ena vrstica.
CREATE TABLE Nastavitve_sistema (
    id_nastavitve INT PRIMARY KEY,
    ime_sole VARCHAR(200) NOT NULL,
    email_sole VARCHAR(254) NOT NULL,
    casovni_pas VARCHAR(64) NOT NULL DEFAULT 'Europe/Ljubljana',
    id_trenutno_leto INT NOT NULL,
    rocna_potrditev BOOLEAN NOT NULL DEFAULT 1,
    obvestilo_nova_prijava BOOLEAN NOT NULL DEFAULT 0,
    potek_seje_minut INT NOT NULL DEFAULT 30,
    samodejne_kopije BOOLEAN NOT NULL DEFAULT 0,
    pogostost_kopij VARCHAR(10) NOT NULL DEFAULT 'dnevno',
    ura_kopije TIME NOT NULL DEFAULT '07:00:00',
    posodobljeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_sistem_ena_vrstica CHECK (id_nastavitve = 1),
    CONSTRAINT fk_sistem_leto FOREIGN KEY (id_trenutno_leto) REFERENCES Solsko_leto(id_solsko_leto),
    CONSTRAINT ck_sistem_ime CHECK (CHAR_LENGTH(TRIM(ime_sole)) > 0),
    CONSTRAINT ck_sistem_potrditev CHECK (rocna_potrditev IN (0, 1)),
    CONSTRAINT ck_sistem_prijava CHECK (obvestilo_nova_prijava IN (0, 1)),
    CONSTRAINT ck_sistem_seja CHECK (potek_seje_minut IN (30, 60, 240)),
    CONSTRAINT ck_sistem_kopije CHECK (samodejne_kopije IN (0, 1)),
    CONSTRAINT ck_sistem_pogostost CHECK (pogostost_kopij IN ('dnevno', 'tedensko'))
) ENGINE=InnoDB;

-- 5. PRIJAVA IN PONASTAVITEV GESLA
-- Tabele uporabi streznik pri prijavi. SQL sam ne izvaja prijave ali posiljanja e-poste.

CREATE TABLE Seja (
    id_seja INT PRIMARY KEY AUTO_INCREMENT,
    id_uporabnik INT NOT NULL,
    zeton_hash BINARY(32) NOT NULL UNIQUE,
    ustvarjeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    zadnja_aktivnost DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    potece DATETIME NOT NULL,
    preklicano DATETIME,
    CONSTRAINT fk_seja_uporabnik FOREIGN KEY (id_uporabnik) REFERENCES Uporabnik(id_uporabnik) ON DELETE CASCADE,
    CONSTRAINT ck_seja_potek CHECK (potece > ustvarjeno)
) ENGINE=InnoDB;

CREATE TABLE Zeton_ponastavitve_gesla (
    id_zeton INT PRIMARY KEY AUTO_INCREMENT,
    id_uporabnik INT NOT NULL,
    zeton_hash BINARY(32) NOT NULL UNIQUE,
    ustvarjeno DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    potece DATETIME NOT NULL,
    uporabljeno DATETIME,
    CONSTRAINT fk_zeton_uporabnik FOREIGN KEY (id_uporabnik) REFERENCES Uporabnik(id_uporabnik) ON DELETE CASCADE,
    CONSTRAINT ck_zeton_potek CHECK (potece > ustvarjeno)
) ENGINE=InnoDB;

CREATE TABLE Dnevnik_prijav (
    id_prijava INT PRIMARY KEY AUTO_INCREMENT,
    id_uporabnik INT,
    uspesna BOOLEAN NOT NULL,
    cas DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_naslov VARCHAR(45),
    uporabniski_agent VARCHAR(255),
    CONSTRAINT fk_prijava_uporabnik FOREIGN KEY (id_uporabnik) REFERENCES Uporabnik(id_uporabnik) ON DELETE SET NULL,
    CONSTRAINT ck_prijava_uspesna CHECK (uspesna IN (0, 1))
) ENGINE=InnoDB;

-- Nekaj indeksov za najpogostejse sezname in iskanje po datumih.
CREATE INDEX ix_uporabnik_vloga_status ON Uporabnik(vloga, status);
CREATE INDEX ix_pi_izvedba ON Profesor_izvedba(id_izvedba, aktivna);
CREATE INDEX ix_di_izvedba ON Dijak_izvedba(id_izvedba, status);
CREATE INDEX ix_naloga_rok ON Naloga(id_izvedba, aktivna, rok_oddaje);
CREATE INDEX ix_gradivo_datum ON Gradivo(id_izvedba, aktivno, objavljeno);
CREATE INDEX ix_oddaja_dijak ON Oddaja(id_dijak, oddano_zadnjic);
CREATE INDEX ix_dogodek_datum ON Dogodek(id_uporabnik, datum);
CREATE INDEX ix_seja_potek ON Seja(potece);
CREATE INDEX ix_zeton_potek ON Zeton_ponastavitve_gesla(potece);
CREATE INDEX ix_prijava_cas ON Dnevnik_prijav(uspesna, cas);

-- 6. TESTNI PODATKI
-- ID v spodnjih povezavah veljajo pri prvem zagonu v prazni bazi.
-- Hash je bil ustvarjen z bcrypt. SQL ne shranjuje navadnega gesla.
SET @testno_geslo = '$2b$12$P8V2PQ8wsp5ctknseW2kDOuFYNWmmOQNoMZNpVTrVvpJzTs6DCtGy';

INSERT INTO Uporabnik (uporabnisko_ime, ime, priimek, email, geslo_hash, vloga, status)
VALUES
('profesor01', 'Andraž', 'Pušnik', 'andraz.novak@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor02', 'Matic', 'Holobar', 'maja.kovac@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor03', 'Boštjan', 'Resinovič', 'peter.horvat@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor04', 'Borut', 'Slemenšek', 'nina.kranjc@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor05', 'Boštjan', 'Fidler', 'luka.zupan@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor06', 'Boštjan', 'Lubej', 'ana.mlakar@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor07', 'Martina', 'Omerzel', 'miha.kralj@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor08', 'Valentina', 'Hrastnik', 'tina.vidmar@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor09', 'Meta', 'Selič Turnšek', 'marko.kos@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor10', 'Eva', 'Boh', 'sara.potocnik@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor11', 'Rosana', 'Breznik', 'gregor.kastelic@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor12', 'Igor', 'Gobec', 'eva.bizjak@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor13', 'Mitja', 'Lukner', 'rok.turk@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor14', 'Sara', 'Padarič', 'petra.jereb@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor15', 'Matej', 'Kališek', 'matija.zajc@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor16', 'Katja', 'Kolar', 'katarina.erzen@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor17', 'Andrej', 'Rozman', 'andrej.rozman@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor18', 'Bojan', 'Herman', 'ursa.lah@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor19', 'Jaka', 'Koren', 'dejan.skerjanc@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('profesor20', 'Andraž', 'Pušeljc', 'barbara.marn@sola.si', @testno_geslo, 'profesor', 'aktiven'),
('dijak001', 'Luka', 'Novak', 'luka.novak@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak002', 'Ana', 'Kovač', 'ana.kovac@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak003', 'Marko', 'Horvat', 'marko.horvat@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak004', 'Nika', 'Kranjc', 'nika.kranjc@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak005', 'Žan', 'Zupan', 'zan.zupan@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak006', 'Eva', 'Mlakar', 'eva.mlakar@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak007', 'Filip', 'Kralj', 'filip.kralj@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak008', 'Mia', 'Vidmar', 'mia.vidmar@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak009', 'Tim', 'Kos', 'tim.kos@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak010', 'Sara', 'Potočnik', 'sara.potocnik@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak011', 'Jan', 'Kastelic', 'jan.kastelic@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak012', 'Lara', 'Bizjak', 'lara.bizjak@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak013', 'Nejc', 'Turk', 'nejc.turk@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak014', 'Tjaša', 'Jereb', 'tjasa.jereb@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak015', 'Žiga', 'Zajc', 'ziga.zajc@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak016', 'Kaja', 'Eržen', 'kaja.erzen@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak017', 'Matic', 'Rozman', 'matic.rozman@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak018', 'Ema', 'Lah', 'ema.lah@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak019', 'Tilen', 'Škerjanc', 'tilen.skerjanc@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak020', 'Maša', 'Marn', 'masa.marn@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak021', 'David', 'Novak', 'david.novak@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak022', 'Lea', 'Kovač', 'lea.kovac@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak023', 'Jure', 'Horvat', 'jure.horvat@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak024', 'Lina', 'Kranjc', 'lina.kranjc@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak025', 'Urban', 'Zupan', 'urban.zupan@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak026', 'Zala', 'Mlakar', 'zala.mlakar@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak027', 'Nik', 'Kralj', 'nik.kralj@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak028', 'Vita', 'Vidmar', 'vita.vidmar@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak029', 'Liam', 'Kos', 'liam.kos@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak030', 'Neli', 'Potočnik', 'neli.potocnik@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak031', 'Rok', 'Kastelic', 'rok.kastelic@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak032', 'Tina', 'Bizjak', 'tina.bizjak@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak033', 'Kris', 'Turk', 'kris.turk@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak034', 'Ela', 'Jereb', 'ela.jereb@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak035', 'Lan', 'Zajc', 'lan.zajc@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak036', 'Julija', 'Eržen', 'julija.erzen@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak037', 'Blaž', 'Rozman', 'blaz.rozman@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak038', 'Manca', 'Lah', 'manca.lah@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak039', 'Val', 'Škerjanc', 'val.skerjanc@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak040', 'Iza', 'Marn', 'iza.marn@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak041', 'Luka', 'Kralj', 'luka.kralj2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak042', 'Ana', 'Vidmar', 'ana.vidmar2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak043', 'Mark', 'Kos', 'mark.kos2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak044', 'Nina', 'Potočnik', 'nina.potocnik2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak045', 'Žan', 'Kastelic', 'zan.kastelic2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak046', 'Eva', 'Bizjak', 'eva.bizjak2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak047', 'Filip', 'Turk', 'filip.turk2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak048', 'Mia', 'Jereb', 'mia.jereb2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak049', 'Tim', 'Zajc', 'tim.zajc2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak050', 'Sara', 'Eržen', 'sara.erzen2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak051', 'Jan', 'Rozman', 'jan.rozman2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak052', 'Lara', 'Lah', 'lara.lah2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak053', 'Nejc', 'Škerjanc', 'nejc.skerjanc2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak054', 'Tjaša', 'Marn', 'tjasa.marn2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak055', 'Žiga', 'Novak', 'ziga.novak2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak056', 'Kaja', 'Kovač', 'kaja.kovac2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak057', 'Matic', 'Horvat', 'matic.horvat2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak058', 'Ema', 'Kranjc', 'ema.kranjc2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak059', 'Tilen', 'Zupan', 'tilen.zupan2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak060', 'Maša', 'Mlakar', 'masa.mlakar2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak061', 'David', 'Kralj', 'david.kralj2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak062', 'Lea', 'Vidmar', 'lea.vidmar2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak063', 'Jure', 'Kos', 'jure.kos2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak064', 'Lina', 'Potočnik', 'lina.potocnik2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak065', 'Urban', 'Kastelic', 'urban.kastelic2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak066', 'Zala', 'Bizjak', 'zala.bizjak2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak067', 'Nik', 'Turk', 'nik.turk2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak068', 'Vita', 'Jereb', 'vita.jereb2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak069', 'Liam', 'Zajc', 'liam.zajc2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak070', 'Neli', 'Eržen', 'neli.erzen2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak071', 'Rok', 'Rozman', 'rok.rozman2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak072', 'Tina', 'Lah', 'tina.lah2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak073', 'Kris', 'Škerjanc', 'kris.skerjanc2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak074', 'Ela', 'Marn', 'ela.marn2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak075', 'Lan', 'Novak', 'lan.novak2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak076', 'Julija', 'Kovač', 'julija.kovac2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak077', 'Blaž', 'Horvat', 'blaz.horvat2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak078', 'Manca', 'Kranjc', 'manca.kranjc2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak079', 'Val', 'Zupan', 'val.zupan2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak080', 'Iza', 'Mlakar', 'iza.mlakar2@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak081', 'Luka', 'Turk', 'luka.turk3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak082', 'Ana', 'Jereb', 'ana.jereb3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak083', 'Marko', 'Zajc', 'marko.zajc3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak084', 'Nika', 'Eržen', 'nika.erzen3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak085', 'Žan', 'Rozman', 'zan.rozman3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak086', 'Eva', 'Lah', 'eva.lah3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak087', 'Filip', 'Škerjanc', 'filip.skerjanc3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak088', 'Mia', 'Marn', 'mia.marn3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak089', 'Tim', 'Novak', 'tim.novak3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak090', 'Sara', 'Kovač', 'sara.kovac3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak091', 'Jan', 'Horvat', 'jan.horvat3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak092', 'Lara', 'Kranjc', 'lara.kranjc3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak093', 'Nejc', 'Zupan', 'nejc.zupan3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak094', 'Tjaša', 'Mlakar', 'tjasa.mlakar3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak095', 'Žiga', 'Kralj', 'ziga.kralj3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak096', 'Kaja', 'Vidmar', 'kaja.vidmar3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak097', 'Matic', 'Kos', 'matic.kos3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak098', 'Ema', 'Potočnik', 'ema.potocnik3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak099', 'Tilen', 'Kastelic', 'tilen.kastelic3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('dijak100', 'Maša', 'Bizjak', 'masa.bizjak3@dijak.si', @testno_geslo, 'dijak', 'aktiven'),
('admin', 'Admin', 'Sistema', 'admin@sola.si', @testno_geslo, 'administrator', 'aktiven');

-- Za vsak racun s pripadajoco vlogo ustvarimo tudi profil.
INSERT INTO Profesor (id_uporabnik)
SELECT id_uporabnik FROM Uporabnik WHERE vloga = 'profesor' ORDER BY id_uporabnik;

INSERT INTO Dijak (id_uporabnik)
SELECT id_uporabnik FROM Uporabnik WHERE vloga = 'dijak' ORDER BY id_uporabnik;

INSERT INTO Program (oznaka, naziv)
VALUES ('RAC', 'Tehnik računalništva');

INSERT INTO Solsko_leto (zacetno_leto, datum_zacetka, datum_konca, status)
VALUES
(2026, '2026-09-01', '2027-08-31', 'odprto'),
(2025, '2025-09-01', '2026-08-31', 'arhivirano');

INSERT INTO Razred (id_program, id_solsko_leto, letnik, oznaka, id_razrednik)
VALUES
(1, 1, 1, 'A', 1),
(1, 1, 2, 'A', 2),
(1, 1, 3, 'RAČ', 3),
(1, 1, 3, 'B', 4),
(1, 1, 4, 'A', 5);

-- Po dvajset dijakov je vpisanih v vsak testni razred.
INSERT INTO Vpis_v_razred (id_dijak, id_solsko_leto, id_razred)
VALUES
(1, 1, 1),
(2, 1, 1),
(3, 1, 1),
(4, 1, 1),
(5, 1, 1),
(6, 1, 1),
(7, 1, 1),
(8, 1, 1),
(9, 1, 1),
(10, 1, 1),
(11, 1, 1),
(12, 1, 1),
(13, 1, 1),
(14, 1, 1),
(15, 1, 1),
(16, 1, 1),
(17, 1, 1),
(18, 1, 1),
(19, 1, 1),
(20, 1, 1),
(21, 1, 2),
(22, 1, 2),
(23, 1, 2),
(24, 1, 2),
(25, 1, 2),
(26, 1, 2),
(27, 1, 2),
(28, 1, 2),
(29, 1, 2),
(30, 1, 2),
(31, 1, 2),
(32, 1, 2),
(33, 1, 2),
(34, 1, 2),
(35, 1, 2),
(36, 1, 2),
(37, 1, 2),
(38, 1, 2),
(39, 1, 2),
(40, 1, 2),
(41, 1, 3),
(42, 1, 3),
(43, 1, 3),
(44, 1, 3),
(45, 1, 3),
(46, 1, 3),
(47, 1, 3),
(48, 1, 3),
(49, 1, 3),
(50, 1, 3),
(51, 1, 3),
(52, 1, 3),
(53, 1, 3),
(54, 1, 3),
(55, 1, 3),
(56, 1, 3),
(57, 1, 3),
(58, 1, 3),
(59, 1, 3),
(60, 1, 3),
(61, 1, 4),
(62, 1, 4),
(63, 1, 4),
(64, 1, 4),
(65, 1, 4),
(66, 1, 4),
(67, 1, 4),
(68, 1, 4),
(69, 1, 4),
(70, 1, 4),
(71, 1, 4),
(72, 1, 4),
(73, 1, 4),
(74, 1, 4),
(75, 1, 4),
(76, 1, 4),
(77, 1, 4),
(78, 1, 4),
(79, 1, 4),
(80, 1, 4),
(81, 1, 5),
(82, 1, 5),
(83, 1, 5),
(84, 1, 5),
(85, 1, 5),
(86, 1, 5),
(87, 1, 5),
(88, 1, 5),
(89, 1, 5),
(90, 1, 5),
(91, 1, 5),
(92, 1, 5),
(93, 1, 5),
(94, 1, 5),
(95, 1, 5),
(96, 1, 5),
(97, 1, 5),
(98, 1, 5),
(99, 1, 5),
(100, 1, 5);

INSERT INTO Predmet (sifra, naziv, barva)
VALUES
('MAT', 'Matematika', '#cf704c'),
('SLO', 'Slovenščina', '#c0806d'),
('ANG', 'Angleščina', '#bd9026'),
('INF', 'Informatika', '#7b9058'),
('FIZ', 'Fizika', '#91889e'),
('ZGO', 'Zgodovina', '#9d8d62'),
('RPS', 'Računalniški produkti in storitve', '#7b9058'),
('UPB', 'Upravljanje s podatkovnimi bazami', '#7b9058'),
('PRA', 'Programiranje aplikacij', '#7b9058'),
('SPV', 'Športna vzgoja', '#bd9026');

-- Za vsak razred pripravimo izvedbe desetih predmetov.
INSERT INTO Izvedba_predmeta (id_predmet, id_razred)
VALUES
(1, 1),
(2, 1),
(3, 1),
(4, 1),
(5, 1),
(6, 1),
(7, 1),
(8, 1),
(9, 1),
(10, 1),
(1, 2),
(2, 2),
(3, 2),
(4, 2),
(5, 2),
(6, 2),
(7, 2),
(8, 2),
(9, 2),
(10, 2),
(1, 3),
(2, 3),
(3, 3),
(4, 3),
(5, 3),
(6, 3),
(7, 3),
(8, 3),
(9, 3),
(10, 3),
(1, 4),
(2, 4),
(3, 4),
(4, 4),
(5, 4),
(6, 4),
(7, 4),
(8, 4),
(9, 4),
(10, 4),
(1, 5),
(2, 5),
(3, 5),
(4, 5),
(5, 5),
(6, 5),
(7, 5),
(8, 5),
(9, 5),
(10, 5);

-- Vsako izvedbo poucujeta dva profesorja.
INSERT INTO Profesor_izvedba (id_profesor, id_izvedba)
VALUES
(1, 1),
(2, 1),
(3, 2),
(4, 2),
(5, 3),
(6, 3),
(7, 4),
(8, 4),
(9, 5),
(10, 5),
(11, 6),
(12, 6),
(13, 7),
(14, 7),
(15, 8),
(16, 8),
(17, 9),
(18, 9),
(19, 10),
(20, 10),
(1, 11),
(2, 11),
(3, 12),
(4, 12),
(5, 13),
(6, 13),
(7, 14),
(8, 14),
(9, 15),
(10, 15),
(11, 16),
(12, 16),
(13, 17),
(14, 17),
(15, 18),
(16, 18),
(17, 19),
(18, 19),
(19, 20),
(20, 20),
(1, 21),
(2, 21),
(3, 22),
(4, 22),
(5, 23),
(6, 23),
(7, 24),
(8, 24),
(9, 25),
(10, 25),
(11, 26),
(12, 26),
(13, 27),
(14, 27),
(15, 28),
(16, 28),
(17, 29),
(18, 29),
(19, 30),
(20, 30),
(1, 31),
(2, 31),
(3, 32),
(4, 32),
(5, 33),
(6, 33),
(7, 34),
(8, 34),
(9, 35),
(10, 35),
(11, 36),
(12, 36),
(13, 37),
(14, 37),
(15, 38),
(16, 38),
(17, 39),
(18, 39),
(19, 40),
(20, 40),
(1, 41),
(2, 41),
(3, 42),
(4, 42),
(5, 43),
(6, 43),
(7, 44),
(8, 44),
(9, 45),
(10, 45),
(11, 46),
(12, 46),
(13, 47),
(14, 47),
(15, 48),
(16, 48),
(17, 49),
(18, 49),
(19, 50),
(20, 50);

-- Prvi profesor poleg matematike poucuje tudi fiziko.
INSERT INTO Profesor_izvedba (id_profesor, id_izvedba)
VALUES (1, 5), (1, 15), (1, 25), (1, 35), (1, 45);

-- Preprost JOIN vpise dijake k izvedbam njihovega razreda.
-- Tako vsak testni dijak obiskuje vec kot en razlicen predmet.
INSERT INTO Dijak_izvedba (id_dijak, id_izvedba, status)
SELECT v.id_dijak, i.id_izvedba, 'aktiven'
FROM Vpis_v_razred v
JOIN Izvedba_predmeta i ON i.id_razred = v.id_razred;

INSERT INTO Nastavitve_uporabnika (id_uporabnik)
SELECT id_uporabnik FROM Uporabnik;

UPDATE Nastavitve_uporabnika
SET novi_vpisi = 1, sistemska_obvestila = 1
WHERE id_uporabnik = 121;

INSERT INTO Nastavitve_sistema (id_nastavitve, ime_sole, email_sole, id_trenutno_leto)
VALUES (1, 'Šolski sistem RPS', 'tajnistvo@sola.si', 1);

-- Naslednje vrstice so primeri metapodatkov, dejanske datoteke niso prilozene.
-- Za prenos mora aplikacija datoteke tudi naloziti in shraniti izven mape public.
INSERT INTO Datoteka (id_lastnik, izvorno_ime, shranjeno_ime, storage_kljuc, mime_tip, velikost_bajtov)
VALUES
(7, 'uvod-sql.pdf', 'uvod-sql.pdf', 'gradiva/uvod-sql.pdf', 'application/pdf', 1258291),
(3, 'cankar.pdf', 'cankar.pdf', 'gradiva/cankar.pdf', 'application/pdf', 3250586),
(1, 'enacbe.pptx', 'enacbe.pptx', 'gradiva/enacbe.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 2936013),
(7, 'podatkovni-modeli.docx', 'podatkovni-modeli.docx', 'gradiva/podatkovni-modeli.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 348160),
(9, 'laboratorijske-vaje.pdf', 'laboratorijske-vaje.pdf', 'gradiva/laboratorijske-vaje.pdf', 'application/pdf', 491520),
(5, 'grammar.pdf', 'grammar.pdf', 'gradiva/grammar.pdf', 'application/pdf', 225280),
(61, 'model.pdf', 'Kralj Luka – Podatkovni model.pdf', 'oddaje/5/41/Kralj Luka – Podatkovni model.pdf', 'application/pdf', 160000),
(62, 'funkcije.pdf', 'Vidmar Ana – Linearne funkcije.pdf', 'oddaje/6/42/Vidmar Ana – Linearne funkcije.pdf', 'application/pdf', 180000);

-- Izvedbe 21 do 30 pripadajo razredu 3. RAC.
INSERT INTO Gradivo (id_izvedba, id_profesor, naslov, vrsta, id_datoteka, url, trajanje_sekund, objavljeno)
VALUES
(24, 7, 'Uvod v SQL – predavanje', 'dokument', 1, NULL, NULL, '2026-11-02 08:00:00'),
(22, 3, 'Cankar – izbrana dela', 'dokument', 2, NULL, NULL, '2026-11-02 07:00:00'),
(25, 9, 'Gibalna energija – video razlaga', 'video', NULL, 'https://example.com/video-gibalna-energija', 760, '2026-11-01 10:00:00'),
(21, 1, 'Algebrske enačbe – razlaga', 'predstavitev', 3, NULL, NULL, '2026-10-30 09:00:00'),
(24, 7, 'Podatkovni modeli – vaje', 'dokument', 4, NULL, NULL, '2026-10-29 08:00:00'),
(25, 9, 'Laboratorijske vaje – navodila', 'dokument', 5, NULL, NULL, '2026-10-28 08:00:00'),
(23, 5, 'Grammar practice – worksheet', 'dokument', 6, NULL, NULL, '2026-10-27 08:00:00'),
(23, 5, 'Speaking topics – povezava', 'povezava', NULL, 'https://example.com/speaking-topics', NULL, '2026-10-26 08:00:00');

INSERT INTO Naloga (id_izvedba, id_profesor, naslov, opis, objavljeno, rok_oddaje, max_tock)
VALUES
(21, 1, 'Algebrske enačbe', 'Reši naloge 1–8 in priloži postopek reševanja.', '2026-11-02 07:00:00', '2026-11-06 22:00:00', 20),
(24, 7, 'SQL poizvedbe', 'Napiši tri poizvedbe nad podano bazo in oddaj datoteko SQL.', '2026-11-02 07:00:00', '2026-11-06 22:00:00', 15),
(25, 9, 'Gibalna energija – poročilo', 'Napiši kratko poročilo o opravljenem eksperimentu.', '2026-11-02 07:00:00', '2026-11-08 22:00:00', 10),
(22, 3, 'Esej: Cankar', 'Analiziraj izbrano delo Ivana Cankarja v 500–700 besedah.', '2026-11-02 07:00:00', '2026-11-10 22:00:00', 20),
(24, 7, 'Podatkovni model', 'Nariši podatkovni model in razloži povezave.', '2026-10-19 07:00:00', '2026-10-27 22:00:00', 10),
(21, 1, 'Linearne funkcije', 'Reši primere in nariši grafe funkcij.', '2026-10-22 07:00:00', '2026-10-30 22:00:00', 10);

INSERT INTO Oddaja (id_naloga, id_izvedba, id_dijak, id_datoteka, oddano_prvic, oddano_zadnjic)
VALUES
(5, 24, 41, 7, '2026-10-26 15:00:00', '2026-10-26 15:00:00'),
(6, 21, 42, 8, '2026-10-29 16:00:00', '2026-10-29 16:00:00');

INSERT INTO Ocena_oddaje (id_oddaja, id_profesor, tocke, ocena, komentar, ocenjena_verzija, ocenjeno)
VALUES (1, 7, 9, 5, 'Pravilne povezave. Dodaj še opis ene omejitve.', 1, '2026-10-27 08:00:00');

INSERT INTO Dogodek (id_uporabnik, id_predmet, naslov, datum)
VALUES
(61, 1, 'Ponovitev algebrskih enačb', '2026-11-05'),
(62, 4, 'Vaje za SQL', '2026-11-04');

-- 7. OSNOVNO PREVERJANJE
-- Pri pricakovanem rezultatu dobis 10 predmetov, 20 profesorjev in 100 dijakov.
SELECT COUNT(*) AS stevilo_predmetov FROM Predmet;
SELECT COUNT(*) AS stevilo_profesorjev FROM Profesor;
SELECT COUNT(*) AS stevilo_dijakov FROM Dijak;

-- Ta poizvedba mora vrniti prazen rezultat: vsi dijaki imajo vsaj dva predmeta.
SELECT d.id_dijak, COUNT(DISTINCT i.id_predmet) AS stevilo_predmetov
FROM Dijak d
LEFT JOIN Dijak_izvedba di ON di.id_dijak = d.id_dijak AND di.status = 'aktiven'
LEFT JOIN Izvedba_predmeta i ON i.id_izvedba = di.id_izvedba
GROUP BY d.id_dijak
HAVING COUNT(DISTINCT i.id_predmet) < 2;

-- Primer: prikaz profesorjev, ki poucujejo vec razlicnih predmetov.
SELECT p.id_profesor, u.ime, u.priimek, COUNT(DISTINCT i.id_predmet) AS stevilo_predmetov
FROM Profesor p
JOIN Uporabnik u ON u.id_uporabnik = p.id_uporabnik
JOIN Profesor_izvedba pi ON pi.id_profesor = p.id_profesor AND pi.aktivna = 1
JOIN Izvedba_predmeta i ON i.id_izvedba = pi.id_izvedba
GROUP BY p.id_profesor, u.ime, u.priimek
HAVING COUNT(DISTINCT i.id_predmet) > 1;

-- Naslednja pravila preverja aplikacija:
-- - racun dijaka/profesorja ima pravilno vlogo;
-- - dijak je v pravem razredu in ima aktiven vpis;
-- - profesor ima aktivno dodelitev in sme oceniti konkretno oddajo;
-- - dosezene tocke ne presegajo najvecjega stevila in ocena ustreza verziji oddaje;
-- - rok, tip in velikost nalozene datoteke so ustrezni;
-- - ponovna oddaja zahteva potrditev dijaka in zamenja prejsnjo datoteko;
-- - ime oddane datoteke je Priimek Ime – Naslov naloge.koncnica;
-- - arhivirano leto ne dovoli sprememb, izbrisi pa upostevajo povezane zapise.
-- Shranjevanje nastavitev samo po sebi se ne posilja obvestil ali izdeluje kopij.
