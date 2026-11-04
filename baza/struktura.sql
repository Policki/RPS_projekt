-- Struktura iz SQL.sql brez razvojnih oseb in vsebine.

CREATE DATABASE IF NOT EXISTS sola_is
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE sola_is;
SET NAMES utf8mb4;
SET time_zone = '+00:00';


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

CREATE TABLE Profesor_izvedba (
    id_profesor INT NOT NULL,
    id_izvedba INT NOT NULL,
    aktivna BOOLEAN NOT NULL DEFAULT 1,
    PRIMARY KEY (id_profesor, id_izvedba),
    CONSTRAINT fk_pi_profesor FOREIGN KEY (id_profesor) REFERENCES Profesor(id_profesor),
    CONSTRAINT fk_pi_izvedba FOREIGN KEY (id_izvedba) REFERENCES Izvedba_predmeta(id_izvedba),
    CONSTRAINT ck_pi_aktivna CHECK (aktivna IN (0, 1))
) ENGINE=InnoDB;

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

INSERT INTO Program (oznaka,naziv) VALUES ('RAC','Računalništvo');
INSERT INTO Solsko_leto (zacetno_leto,datum_zacetka,datum_konca,status) VALUES (2026,'2026-09-01','2027-08-31','odprto');
INSERT INTO Nastavitve_sistema (id_nastavitve,ime_sole,email_sole,id_trenutno_leto) VALUES (1,'Šolski sistem','skrbnik@example.org',1);
