const pool = require('./db');
const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3000;

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 30 * 60 * 1000
    }
}));

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(
    path.join(__dirname, '../public')
));

app.get('/', (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            '../public/prijava/index.html'
        )
    );
});

app.get('/api/predmeti', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM Predmet'
        );

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            napaka: 'Napaka pri povezavi z bazo.'
        });
    }
});

app.post('/login', async (req, res) => {
    try {
        const {
            username,
            password
        } = req.body;

        if (!username || !password) {
            return res.status(400).send(
                'Vnesite uporabniško ime in geslo.'
            );
        }

        const [rows] = await pool.query(
            `
            SELECT
                id_uporabnik,
                uporabnisko_ime,
                ime,
                priimek,
                geslo_hash,
                vloga,
                status
            FROM Uporabnik
            WHERE uporabnisko_ime = ?
            LIMIT 1
            `,
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).send(
                'Napačno uporabniško ime ali geslo.'
            );
        }

        const uporabnik = rows[0];

        const gesloPravilno = await bcrypt.compare(
            password,
            uporabnik.geslo_hash
        );

        if (!gesloPravilno) {
            return res.status(401).send(
                'Napačno uporabniško ime ali geslo.'
            );
        }

        if (uporabnik.status !== 'aktiven') {
            return res.status(403).send(
                'Uporabniški račun ni aktiven.'
            );
        }

        req.session.uporabnik = {
            id: uporabnik.id_uporabnik,
            uporabnisko_ime: uporabnik.uporabnisko_ime,
            ime: uporabnik.ime,
            priimek: uporabnik.priimek,
            vloga: uporabnik.vloga
        };

        if (uporabnik.vloga === 'dijak') {
            return res.redirect(
                '/ucenec-dasboard'
            );
        }

        if (uporabnik.vloga === 'profesor') {
            return res.redirect(
                '/profesor-dashboard'
            );
        }

        if (uporabnik.vloga === 'administrator') {
            return res.redirect(
                '/admin-dashboard'
            );
        }

        return res.status(403).send(
            'Neznana uporabniška vloga.'
        );
    } catch (error) {
        console.error(error);

        res.status(500).json({
            napaka: 'Napaka pri prijavi.'
        });
    }
});

app.get('/ucenec-dasboard', (req, res) => {
    if (!req.session.uporabnik) {
        return res.redirect('/');
    }

    if (req.session.uporabnik.vloga !== 'dijak') {
        return res.status(403).send(
            'Nimate dovoljenja za dostop.'
        );
    }

    res.sendFile(
        path.join(
            __dirname,
            '../public/ucenec/ucenec-dasboard.html'
        )
    );
});

app.get('/profesor-dashboard', (req, res) => {
    if (!req.session.uporabnik) {
        return res.redirect('/');
    }

    if (req.session.uporabnik.vloga !== 'profesor') {
        return res.status(403).send(
            'Nimate dovoljenja za dostop.'
        );
    }

    res.sendFile(
        path.join(
            __dirname,
            '../public/profesor/profesor-dashboard.html'
        )
    );
});

app.get('/admin-dashboard', (req, res) => {
    if (!req.session.uporabnik) {
        return res.redirect('/');
    }

    if (req.session.uporabnik.vloga !== 'administrator') {
        return res.status(403).send(
            'Nimate dovoljenja za dostop.'
        );
    }

    res.sendFile(
        path.join(
            __dirname,
            '../public/admin/admin-dashboard.html'
        )
    );
});

app.get('/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error(error);

            return res.status(500).send(
                'Napaka pri odjavi.'
            );
        }

        res.redirect('/');
    });
});

app.get('/api/uporabnik', (req, res) => {
    if (!req.session.uporabnik) {
        return res.status(401).json({
            napaka: 'Uporabnik ni prijavljen.'
        });
    }

    res.json({
        uporabnik: req.session.uporabnik
    });
});

app.get('/api/moji-predmeti', async (req, res) => {
    try {
        if (!req.session.uporabnik) {
            return res.status(401).json({
                napaka: 'Uporabnik ni prijavljen.'
            });
        }

        if (req.session.uporabnik.vloga !== 'dijak') {
            return res.status(403).json({
                napaka: 'Nimate dovoljenja za dostop.'
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                Predmet.id_predmet,
                Predmet.sifra,
                Predmet.naziv,
                Predmet.opis,
                Predmet.barva,
                Izvedba_predmeta.id_izvedba
            FROM Dijak

            JOIN Dijak_izvedba
                ON Dijak.id_dijak =
                   Dijak_izvedba.id_dijak

            JOIN Izvedba_predmeta
                ON Dijak_izvedba.id_izvedba =
                   Izvedba_predmeta.id_izvedba

            JOIN Predmet
                ON Izvedba_predmeta.id_predmet =
                   Predmet.id_predmet

            WHERE Dijak.id_uporabnik = ?
                AND Dijak_izvedba.status = 'aktiven'
                AND Izvedba_predmeta.aktivna = 1
                AND Predmet.aktiven = 1

            ORDER BY Predmet.naziv
            `,
            [req.session.uporabnik.id]
        );

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            napaka: 'Napaka pri pridobivanju predmetov.'
        });
    }
});

app.listen(PORT, () => {
    console.log(
        `Streznik tece na http://localhost:${PORT}`
    );
});