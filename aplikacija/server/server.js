const path = require('path');

try {
    process.loadEnvFile(path.join(__dirname, '../../.env'));
} catch (napaka) {
    if (napaka.code !== 'ENOENT') {
        throw napaka;
    }
}

const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { randomBytes } = require('crypto');

const pool = require('./db');
const { prijava, vloga, csrf } = require('./middleware/avtentikacija');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const produkcija = process.env.NODE_ENV === 'production';

if (
    !process.env.SESSION_SECRET ||
    (produkcija && process.env.SESSION_SECRET.length < 32)
) {
    throw new Error(
        'Nastavite SESSION_SECRET; v produkciji mora imeti vsaj 32 znakov.'
    );
}

app.disable('x-powered-by');

if (produkcija) {
    app.set('trust proxy', 1);
}

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                'script-src': ["'self'"],
                'script-src-attr': ["'none'"],
                'style-src': [
                    "'self'",
                    "'unsafe-inline'",
                    'https://fonts.googleapis.com'
                ],
                'font-src': [
                    "'self'",
                    'https://fonts.gstatic.com'
                ],
                'img-src': [
                    "'self'",
                    'data:'
                ],
                'upgrade-insecure-requests': produkcija ? [] : null
            }
        },
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin'
        },
        strictTransportSecurity: produkcija
    })
);

app.use(express.json({
    limit: '128kb'
}));

app.use(express.urlencoded({
    extended: false,
    limit: '16kb'
}));

app.use((req, res, next) => {
    req.body ||= {};

    if (
        typeof req.body !== 'object' ||
        Array.isArray(req.body)
    ) {
        return res.status(400).json({
            napaka: 'Neveljavna oblika podatkov.'
        });
    }

    next();
});

const shramba = new MySQLStore(
    {
        createDatabaseTable: true,
        schema: {
            tableName: 'Http_seje'
        }
    },
    pool
);

app.use(
    session({
        name: 'rps.sid',
        secret: process.env.SESSION_SECRET,
        store: shramba,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: produkcija,
            maxAge: 30 * 60 * 1000
        }
    })
);

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');

        res.json({
            status: 'ok',
            baza: 'povezana'
        });
    } catch {
        res.status(503).json({
            status: 'napaka',
            baza: 'nedosegljiva'
        });
    }
});

app.post(
    '/login',
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 30,
        standardHeaders: 'draft-8',
        legacyHeaders: false
    }),
    async (req, res, next) => {
        try {
            const {
                username,
                password
            } = req.body;

            if (
                typeof username !== 'string' ||
                !username.trim() ||
                username.length > 50 ||
                typeof password !== 'string' ||
                !password ||
                Buffer.byteLength(password) > 72
            ) {
                return res.status(400).send(
                    'Vnesite veljavno uporabniško ime in geslo.'
                );
            }

            if (
                req.get('origin') &&
                req.get('origin') !==
                    `${req.protocol}://${req.get('host')}`
            ) {
                return res.sendStatus(403);
            }

            const [vrstice] = await pool.execute(
                `
                SELECT *
                FROM Uporabnik
                WHERE uporabnisko_ime = ?
                LIMIT 1
                `,
                [username.trim()]
            );

            const uporabnik = vrstice[0];

            const pravilen =
                uporabnik &&
                await bcrypt.compare(
                    password,
                    uporabnik.geslo_hash
                );

            await pool.execute(
                `
                INSERT INTO Dnevnik_prijav
                (
                    id_uporabnik,
                    uspesna,
                    ip_naslov,
                    uporabniski_agent
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    uporabnik?.id_uporabnik || null,
                    pravilen &&
                    uporabnik?.status === 'aktiven'
                        ? 1
                        : 0,
                    (req.ip || '').slice(0, 45),
                    (req.get('user-agent') || '').slice(0, 255)
                ]
            );

            if (!pravilen) {
                return res.status(401).send(
                    'Napačno uporabniško ime ali geslo.'
                );
            }

            if (uporabnik.status !== 'aktiven') {
                return res.status(403).send(
                    'Uporabniški račun ni aktiven.'
                );
            }

            await new Promise((razresi, zavrni) => {
                req.session.regenerate(napaka => {
                    if (napaka) {
                        return zavrni(napaka);
                    }

                    razresi();
                });
            });

            req.session.uporabnik = {
                id: uporabnik.id_uporabnik,
                vloga: uporabnik.vloga
            };

            req.session.csrf =
                randomBytes(32).toString('hex');

            const [nastavitve] = await pool.query(
                `
                SELECT potek_seje_minut
                FROM Nastavitve_sistema
                WHERE id_nastavitve = 1
                `
            );

            req.session.cookie.maxAge =
                (nastavitve[0]?.potek_seje_minut || 30) *
                60 *
                1000;

            await pool.execute(
                `
                UPDATE Uporabnik
                SET zadnja_prijava = NOW()
                WHERE id_uporabnik = ?
                `,
                [uporabnik.id_uporabnik]
            );

            await new Promise((razresi, zavrni) => {
                req.session.save(napaka => {
                    if (napaka) {
                        return zavrni(napaka);
                    }

                    razresi();
                });
            });

            const preusmeritve = {
                dijak: '/ucenec-dasboard',
                profesor: '/profesor-dashboard',
                administrator: '/admin-dashboard'
            };

            const cilj = preusmeritve[uporabnik.vloga];

            if (!cilj) {
                return res.status(403).send(
                    'Neznana uporabniška vloga.'
                );
            }

            res.redirect(cilj);

        } catch (napaka) {
            next(napaka);
        }
    }
);

app.get('/logout', (req, res, next) => {
    req.session.destroy(napaka => {
        if (napaka) {
            return next(napaka);
        }

        res.clearCookie('rps.sid', {
            httpOnly: true,
            sameSite: 'lax',
            secure: produkcija
        });

        res.redirect('/');
    });
});

app.use(
    '/api',
    prijava,
    require('./routes/skupno')
);

app.use(
    '/api/ucenec',
    vloga('dijak'),
    require('./routes/ucenec')
);

app.use(
    '/api/profesor',
    vloga('profesor'),
    require('./routes/profesor')
);

app.use(
    '/api/admin',
    vloga('administrator'),
    require('./routes/admin')
);

app.use('/api', (req, res) => {
    res.status(404).json({
        napaka: 'API pot ne obstaja.'
    });
});

const javno = path.join(
    __dirname,
    '../public'
);

for (
    const stara of [
        '/ucenec/profil.html',
        '/profesor/profesor-profil.html',
        '/admin/admin-profil.html'
    ]
) {
    app.get(
        stara,
        prijava,
        (req, res) => res.redirect('/profil')
    );
}

app.get(
    ['/profil', '/profil.html'],
    prijava,
    (req, res) => {
        res.sendFile(
            path.join(javno, 'profil.html')
        );
    }
);

for (
    const [
        pot,
        mapa,
        datoteka,
        zahtevana
    ] of [
        [
            '/ucenec-dasboard',
            'ucenec',
            'ucenec-dasboard.html',
            'dijak'
        ],
        [
            '/profesor-dashboard',
            'profesor',
            'profesor-dashboard.html',
            'profesor'
        ],
        [
            '/admin-dashboard',
            'admin',
            'admin-dashboard.html',
            'administrator'
        ]
    ]
) {
    app.get(
        pot,
        prijava,
        vloga(zahtevana),
        (req, res) => {
            res.sendFile(
                path.join(
                    javno,
                    mapa,
                    datoteka
                )
            );
        }
    );
}

app.use((req, res, next) => {
    let normalna;

    try {
        normalna = path.posix.normalize(
            decodeURIComponent(req.path)
                .replaceAll('\\', '/')
        );
    } catch {
        return res.sendStatus(400);
    }

    if (/\.php(?:\/|$)/i.test(normalna)) {
        return res.sendStatus(404);
    }

    if (
        /^\/profil(?:\.html)?$/i.test(normalna)
    ) {
        return prijava(
            req,
            res,
            () => {
                res.sendFile(
                    path.join(
                        javno,
                        'profil.html'
                    )
                );
            }
        );
    }

    const zahtevana = {
        ucenec: 'dijak',
        profesor: 'profesor',
        admin: 'administrator'
    }[
        normalna.split('/')[1]
    ];

    if (
        zahtevana &&
        /\.html$/i.test(normalna)
    ) {
        return prijava(
            req,
            res,
            () => {
                vloga(zahtevana)(
                    req,
                    res,
                    next
                );
            }
        );
    }

    next();
});

app.use(
    express.static(
        javno,
        {
            dotfiles: 'deny',
            index: false
        }
    )
);

app.get('/', (req, res) => {
    res.sendFile(
        path.join(
            javno,
            'prijava/index.html'
        )
    );
});

app.use((req, res) => {
    res.status(404).send(
        'Stran ne obstaja.'
    );
});

app.use((napaka, req, res, next) => {
    if (res.headersSent) {
        return next(napaka);
    }

    let status =
        napaka.status || 500;

    let sporocilo =
        napaka.message;

    if (
        [
            'ER_DUP_ENTRY',
            'ER_ROW_IS_REFERENCED_2'
        ].includes(napaka.code)
    ) {
        status = 409;

        sporocilo =
            'Podatek že obstaja ali je povezan z drugimi zapisi. Uporabite onemogočanje.';
    }

    if (
        napaka.errno === 4025 ||
        [
            'ER_NO_REFERENCED_ROW_2',
            'ER_CHECK_CONSTRAINT_VIOLATED',
            'ER_BAD_NULL_ERROR',
            'ER_TRUNCATED_WRONG_VALUE'
        ].includes(napaka.code)
    ) {
        status = 400;

        sporocilo =
            'Preverite podatke in povezave.';
    }

    if (
        napaka.code === 'LIMIT_FILE_SIZE'
    ) {
        status = 400;

        sporocilo =
            'Datoteka je prevelika (največ 10 MB).';
    }

    if (status >= 500) {
        console.error(napaka);

        sporocilo =
            'Napaka strežnika. Poskusite znova.';
    }

    res.status(status).json({
        napaka: sporocilo
    });
});

shramba
    .onReady()
    .then(() => {
        app.listen(
            PORT,
            HOST,
            () => {
                console.log(
                    `Strežnik je pripravljen na ${HOST}:${PORT}.`
                );
            }
        );

        require('./kopije').zacniUrnik();
    })
    .catch(napaka => {
        console.error(
            'Napaka pri inicializaciji session shrambe:',
            napaka
        );

        process.exit(1);
    });
