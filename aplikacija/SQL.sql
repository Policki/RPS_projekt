CREATE DATABASE Šolski_Sistem
USE Šolski_Sistem 
GO

CREATE TABLE Uporabnik
(
    id_uporabnik int PRIMARY KEY IDENTITY(1,1),
    ime varchar(50) NOT NULL,
    priimek varchar(100) NOT NULL,
    email varchar(100) NOT NULL UNIQUE,
    geslo VARCHAR(255) NOT NULL,
    vloga varchar(20) NOT NULL,

    CONSTRAINT CK_Uporabnik_Vloga
        CHECK (vloga IN ('dijak', 'profesor', 'administrator'))
);
GO

CREATE TABLE Dijak
(
    id_dijak int PRIMARY KEY IDENTITY(1,1),
    id_uporabnik int NOT NULL,
    letnik int NOT NULL,
    razred char(1) NOT NULL,

    CONSTRAINT FK_Dijak_Uporabnik
        FOREIGN KEY (id_uporabnik)
        REFERENCES Uporabnik(id_uporabnik),

    CONSTRAINT UQ_Dijak_Uporabnik
        UNIQUE (id_uporabnik),

    CONSTRAINT CK_Dijak_Letnik
        CHECK (letnik BETWEEN 1 AND 4),

    CONSTRAINT CK_Dijak_Razred
        CHECK (razred IN ('a', 'b'))
);
GO

CREATE TABLE Profesor
(
    id_profesor int PRIMARY KEY IDENTITY(1,1),
    id_uporabnik int NOT NULL,

    CONSTRAINT FK_Profesor_Uporabnik
        FOREIGN KEY (id_uporabnik)
        REFERENCES Uporabnik(id_uporabnik),

    CONSTRAINT UQ_Profesor_Uporabnik
        UNIQUE (id_uporabnik)
);
GO

CREATE TABLE Predmet
(
    id_predmet int PRIMARY KEY IDENTITY(1,1),
    naziv varchar(50) NOT NULL,
);
GO

CREATE TABLE Profesor_Predmet
(
    id_profesor int NOT NULL,
    id_predmet int NOT NULL,

    CONSTRAINT FK_Profesor_Predmet
        PRIMARY KEY(id_profesor, id_predmet),

    CONSTRAINT FK_Profesor_predmet_Profesor
        FOREIGN KEY (id_profesor)
        REFERENCES Profesor(id_profesor),

    CONSTRAINT FK_Profesor_Predmet_Predmet
        FOREIGN KEY (id_predmet)
        REFERENCES Predmet(id_predmet)
);
GO

CREATE TABLE Ocenjevanje
(
    id_ocenjevanje int PRIMARY KEY IDENTITY(1,1),
    id_dijak int NOT NULL,
    id_predmet int NOT NULL
    ocena int NOT NULL,
    datum_vpisa date NOT NULL,

    CONSTRAINT FK_Ocenjevanje_Dijak
        FOREIGN KEY (id_dijak)
        REFERENCES Dijak(id_dijak),

    CONSTRAINT FK_Ocenjevanje_Predmet
        FOREIGN KEY (id_predmet)
        REFERENCES Predmet(id_predmet),

    CONSTRAINT CK_Ocenjevanje_Ocena
        CHECK (ocena BETWEEN 1 AND 5)
);
GO


INSERT INTO Uporabnik (ime, priimek, email, geslo, vloga)
VALUES
('Andraž', 'Pušnik', 'andraz.novak@sola.si', 'geslo123', 'profesor'),
('Matic', 'Holobar', 'maja.kovac@sola.si', 'geslo123', 'profesor'),
('Boštjan', 'Resinovič', 'peter.horvat@sola.si', 'geslo123', 'profesor'),
('Borut', 'Slemenšek', 'nina.kranjc@sola.si', 'geslo123', 'profesor'),
('Boštjan', 'Fidler', 'luka.zupan@sola.si', 'geslo123', 'profesor'),
('Boštjan', 'Lubej', 'ana.mlakar@sola.si', 'geslo123', 'profesor'),
('Martina', 'Omerzel', 'miha.kralj@sola.si', 'geslo123', 'profesor'),
('Valentina', 'Hrastnik', 'tina.vidmar@sola.si', 'geslo123', 'profesor'),
('Meta', 'Selič Turnšek', 'marko.kos@sola.si', 'geslo123', 'profesor'),
('Eva', 'Boh', 'sara.potocnik@sola.si', 'geslo123', 'profesor'),
('Rosana', 'Breznik', 'gregor.kastelic@sola.si', 'geslo123', 'profesor'),
('Igor', 'Gobec', 'eva.bizjak@sola.si', 'geslo123', 'profesor'),
('Mitja', 'Lukner', 'rok.turk@sola.si', 'geslo123', 'profesor'),
('Sara', 'Padarič', 'petra.jereb@sola.si', 'geslo123', 'profesor'),
('Matej', 'Kališek', 'matija.zajc@sola.si', 'geslo123', 'profesor'),
('Katja', 'Kolar', 'katarina.erzen@sola.si', 'geslo123', 'profesor'),
('Andrej', 'Rozman', 'andrej.rozman@sola.si', 'geslo123', 'profesor'),
('Bojan', 'Herman', 'ursa.lah@sola.si', 'geslo123', 'profesor'),
('Jaka', 'Koren', 'dejan.skerjanc@sola.si', 'geslo123', 'profesor'),
('Andraž', 'Pušeljc', 'barbara.marn@sola.si', 'geslo123', 'profesor');
GO

INSERT INTO Predmet (naziv)
VALUES
('Računalniški produkti in storive'),
('Upravljanje s podatkovnimi bazami'),
('Angleščina'),
('Matematika'),
('Sociologija'),
('Programiranje aplikacij'),
('Slovenščina'),
('Športna vzgoja'),
('Stroka - moderne vsebine'),
('Priprave na peti predmet');
GO

INSERT INTO Uporabnik (ime, priimek, email, geslo, vloga)
VALUES
('Luka', 'Novak', 'luka.novak@dijak.si', 'geslo123', 'dijak'),
('Ana', 'Kovač', 'ana.kovac@dijak.si', 'geslo123', 'dijak'),
('Marko', 'Horvat', 'marko.horvat@dijak.si', 'geslo123', 'dijak'),
('Nika', 'Kranjc', 'nika.kranjc@dijak.si', 'geslo123', 'dijak'),
('Žan', 'Zupan', 'zan.zupan@dijak.si', 'geslo123', 'dijak'),
('Eva', 'Mlakar', 'eva.mlakar@dijak.si', 'geslo123', 'dijak'),
('Filip', 'Kralj', 'filip.kralj@dijak.si', 'geslo123', 'dijak'),
('Mia', 'Vidmar', 'mia.vidmar@dijak.si', 'geslo123', 'dijak'),
('Tim', 'Kos', 'tim.kos@dijak.si', 'geslo123', 'dijak'),
('Sara', 'Potočnik', 'sara.potocnik@dijak.si', 'geslo123', 'dijak'),
('Jan', 'Kastelic', 'jan.kastelic@dijak.si', 'geslo123', 'dijak'),
('Lara', 'Bizjak', 'lara.bizjak@dijak.si', 'geslo123', 'dijak'),
('Nejc', 'Turk', 'nejc.turk@dijak.si', 'geslo123', 'dijak'),
('Tjaša', 'Jereb', 'tjasa.jereb@dijak.si', 'geslo123', 'dijak'),
('Žiga', 'Zajc', 'ziga.zajc@dijak.si', 'geslo123', 'dijak'),
('Kaja', 'Eržen', 'kaja.erzen@dijak.si', 'geslo123', 'dijak'),
('Matic', 'Rozman', 'matic.rozman@dijak.si', 'geslo123', 'dijak'),
('Ema', 'Lah', 'ema.lah@dijak.si', 'geslo123', 'dijak'),
('Tilen', 'Škerjanc', 'tilen.skerjanc@dijak.si', 'geslo123', 'dijak'),
('Maša', 'Marn', 'masa.marn@dijak.si', 'geslo123', 'dijak'),

('David', 'Novak', 'david.novak@dijak.si', 'geslo123', 'dijak'),
('Lea', 'Kovač', 'lea.kovac@dijak.si', 'geslo123', 'dijak'),
('Jure', 'Horvat', 'jure.horvat@dijak.si', 'geslo123', 'dijak'),
('Lina', 'Kranjc', 'lina.kranjc@dijak.si', 'geslo123', 'dijak'),
('Urban', 'Zupan', 'urban.zupan@dijak.si', 'geslo123', 'dijak'),
('Zala', 'Mlakar', 'zala.mlakar@dijak.si', 'geslo123', 'dijak'),
('Nik', 'Kralj', 'nik.kralj@dijak.si', 'geslo123', 'dijak'),
('Vita', 'Vidmar', 'vita.vidmar@dijak.si', 'geslo123', 'dijak'),
('Liam', 'Kos', 'liam.kos@dijak.si', 'geslo123', 'dijak'),
('Neli', 'Potočnik', 'neli.potocnik@dijak.si', 'geslo123', 'dijak'),
('Rok', 'Kastelic', 'rok.kastelic@dijak.si', 'geslo123', 'dijak'),
('Tina', 'Bizjak', 'tina.bizjak@dijak.si', 'geslo123', 'dijak'),
('Kris', 'Turk', 'kris.turk@dijak.si', 'geslo123', 'dijak'),
('Ela', 'Jereb', 'ela.jereb@dijak.si', 'geslo123', 'dijak'),
('Lan', 'Zajc', 'lan.zajc@dijak.si', 'geslo123', 'dijak'),
('Julija', 'Eržen', 'julija.erzen@dijak.si', 'geslo123', 'dijak'),
('Blaž', 'Rozman', 'blaz.rozman@dijak.si', 'geslo123', 'dijak'),
('Manca', 'Lah', 'manca.lah@dijak.si', 'geslo123', 'dijak'),
('Val', 'Škerjanc', 'val.skerjanc@dijak.si', 'geslo123', 'dijak'),
('Iza', 'Marn', 'iza.marn@dijak.si', 'geslo123', 'dijak'),

('Luka', 'Kralj', 'luka.kralj2@dijak.si', 'geslo123', 'dijak'),
('Ana', 'Vidmar', 'ana.vidmar2@dijak.si', 'geslo123', 'dijak'),
('Mark', 'Kos', 'mark.kos2@dijak.si', 'geslo123', 'dijak'),
('Nina', 'Potočnik', 'nina.potocnik2@dijak.si', 'geslo123', 'dijak'),
('Žan', 'Kastelic', 'zan.kastelic2@dijak.si', 'geslo123', 'dijak'),
('Eva', 'Bizjak', 'eva.bizjak2@dijak.si', 'geslo123', 'dijak'),
('Filip', 'Turk', 'filip.turk2@dijak.si', 'geslo123', 'dijak'),
('Mia', 'Jereb', 'mia.jereb2@dijak.si', 'geslo123', 'dijak'),
('Tim', 'Zajc', 'tim.zajc2@dijak.si', 'geslo123', 'dijak'),
('Sara', 'Eržen', 'sara.erzen2@dijak.si', 'geslo123', 'dijak'),
('Jan', 'Rozman', 'jan.rozman2@dijak.si', 'geslo123', 'dijak'),
('Lara', 'Lah', 'lara.lah2@dijak.si', 'geslo123', 'dijak'),
('Nejc', 'Škerjanc', 'nejc.skerjanc2@dijak.si', 'geslo123', 'dijak'),
('Tjaša', 'Marn', 'tjasa.marn2@dijak.si', 'geslo123', 'dijak'),
('Žiga', 'Novak', 'ziga.novak2@dijak.si', 'geslo123', 'dijak'),
('Kaja', 'Kovač', 'kaja.kovac2@dijak.si', 'geslo123', 'dijak'),
('Matic', 'Horvat', 'matic.horvat2@dijak.si', 'geslo123', 'dijak'),
('Ema', 'Kranjc', 'ema.kranjc2@dijak.si', 'geslo123', 'dijak'),
('Tilen', 'Zupan', 'tilen.zupan2@dijak.si', 'geslo123', 'dijak'),
('Maša', 'Mlakar', 'masa.mlakar2@dijak.si', 'geslo123', 'dijak'),

('David', 'Kralj', 'david.kralj2@dijak.si', 'geslo123', 'dijak'),
('Lea', 'Vidmar', 'lea.vidmar2@dijak.si', 'geslo123', 'dijak'),
('Jure', 'Kos', 'jure.kos2@dijak.si', 'geslo123', 'dijak'),
('Lina', 'Potočnik', 'lina.potocnik2@dijak.si', 'geslo123', 'dijak'),
('Urban', 'Kastelic', 'urban.kastelic2@dijak.si', 'geslo123', 'dijak'),
('Zala', 'Bizjak', 'zala.bizjak2@dijak.si', 'geslo123', 'dijak'),
('Nik', 'Turk', 'nik.turk2@dijak.si', 'geslo123', 'dijak'),
('Vita', 'Jereb', 'vita.jereb2@dijak.si', 'geslo123', 'dijak'),
('Liam', 'Zajc', 'liam.zajc2@dijak.si', 'geslo123', 'dijak'),
('Neli', 'Eržen', 'neli.erzen2@dijak.si', 'geslo123', 'dijak'),
('Rok', 'Rozman', 'rok.rozman2@dijak.si', 'geslo123', 'dijak'),
('Tina', 'Lah', 'tina.lah2@dijak.si', 'geslo123', 'dijak'),
('Kris', 'Škerjanc', 'kris.skerjanc2@dijak.si', 'geslo123', 'dijak'),
('Ela', 'Marn', 'ela.marn2@dijak.si', 'geslo123', 'dijak'),
('Lan', 'Novak', 'lan.novak2@dijak.si', 'geslo123', 'dijak'),
('Julija', 'Kovač', 'julija.kovac2@dijak.si', 'geslo123', 'dijak'),
('Blaž', 'Horvat', 'blaz.horvat2@dijak.si', 'geslo123', 'dijak'),
('Manca', 'Kranjc', 'manca.kranjc2@dijak.si', 'geslo123', 'dijak'),
('Val', 'Zupan', 'val.zupan2@dijak.si', 'geslo123', 'dijak'),
('Iza', 'Mlakar', 'iza.mlakar2@dijak.si', 'geslo123', 'dijak'),

('Luka', 'Turk', 'luka.turk3@dijak.si', 'geslo123', 'dijak'),
('Ana', 'Jereb', 'ana.jereb3@dijak.si', 'geslo123', 'dijak'),
('Marko', 'Zajc', 'marko.zajc3@dijak.si', 'geslo123', 'dijak'),
('Nika', 'Eržen', 'nika.erzen3@dijak.si', 'geslo123', 'dijak'),
('Žan', 'Rozman', 'zan.rozman3@dijak.si', 'geslo123', 'dijak'),
('Eva', 'Lah', 'eva.lah3@dijak.si', 'geslo123', 'dijak'),
('Filip', 'Škerjanc', 'filip.skerjanc3@dijak.si', 'geslo123', 'dijak'),
('Mia', 'Marn', 'mia.marn3@dijak.si', 'geslo123', 'dijak'),
('Tim', 'Novak', 'tim.novak3@dijak.si', 'geslo123', 'dijak'),
('Sara', 'Kovač', 'sara.kovac3@dijak.si', 'geslo123', 'dijak'),
('Jan', 'Horvat', 'jan.horvat3@dijak.si', 'geslo123', 'dijak'),
('Lara', 'Kranjc', 'lara.kranjc3@dijak.si', 'geslo123', 'dijak'),
('Nejc', 'Zupan', 'nejc.zupan3@dijak.si', 'geslo123', 'dijak'),
('Tjaša', 'Mlakar', 'tjasa.mlakar3@dijak.si', 'geslo123', 'dijak'),
('Žiga', 'Kralj', 'ziga.kralj3@dijak.si', 'geslo123', 'dijak'),
('Kaja', 'Vidmar', 'kaja.vidmar3@dijak.si', 'geslo123', 'dijak'),
('Matic', 'Kos', 'matic.kos3@dijak.si', 'geslo123', 'dijak'),
('Ema', 'Potočnik', 'ema.potocnik3@dijak.si', 'geslo123', 'dijak'),
('Tilen', 'Kastelic', 'tilen.kastelic3@dijak.si', 'geslo123', 'dijak'),
('Maša', 'Bizjak', 'masa.bizjak3@dijak.si', 'geslo123', 'dijak');
GO