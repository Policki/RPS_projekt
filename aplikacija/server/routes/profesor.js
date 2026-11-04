const usmerjevalnik = require('express').Router();
const pool = require('../db');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { napaka, stevilo, besedilo, logika, izvedba, transakcija } = require('../pomoc');
const mapa = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../podatki/datoteke'));
const koncnice = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const nalaganje = multer({
    storage: multer.diskStorage({
        destination: (req, datoteka, koncano) => fs.mkdir(mapa, { recursive: true }).then(() => koncano(null, mapa), koncano),
        filename: (req, datoteka, koncano) => koncano(null, randomUUID() + path.extname(datoteka.originalname).toLowerCase())
    }), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2, parts: 3 },
    fileFilter: (req, datoteka, koncano) => koncano(koncnice[path.extname(datoteka.originalname).toLowerCase()] ? null : napaka(400, 'Dovoljeni so PDF, DOC, DOCX, PPT in PPTX.'), true)
});
async function predmeti(req) {
    const [vrstice] = await pool.execute(`SELECT i.id_izvedba AS id,p.naziv,p.sifra AS oznaka,p.barva,
        CONCAT(r.letnik,'. ',r.oznaka) AS razred,r.id_razred,
        (SELECT COUNT(*) FROM Dijak_izvedba di JOIN Dijak d ON d.id_dijak=di.id_dijak JOIN Uporabnik u ON u.id_uporabnik=d.id_uporabnik WHERE di.id_izvedba=i.id_izvedba AND di.status='aktiven' AND u.status='aktiven') AS stevilo,
        (SELECT MIN(rok_oddaje) FROM Naloga n WHERE n.id_izvedba=i.id_izvedba AND n.aktivna=1 AND n.rok_oddaje>=NOW()) AS rok,
        (SELECT COUNT(*) FROM Oddaja o WHERE o.id_izvedba=i.id_izvedba) AS oddano,
        (SELECT COUNT(*) FROM Oddaja o JOIN Ocena_oddaje oc ON oc.id_oddaja=o.id_oddaja AND oc.ocenjena_verzija=o.verzija WHERE o.id_izvedba=i.id_izvedba) AS pregledano
        FROM Profesor pr JOIN Profesor_izvedba pi ON pi.id_profesor=pr.id_profesor AND pi.aktivna=1
        JOIN Izvedba_predmeta i ON i.id_izvedba=pi.id_izvedba AND i.aktivna=1 JOIN Predmet p ON p.id_predmet=i.id_predmet AND p.aktiven=1
        JOIN Razred r ON r.id_razred=i.id_razred WHERE pr.id_uporabnik=? ORDER BY p.naziv,r.letnik,r.oznaka`, [req.uporabnik.id]);
    return vrstice.map(vrstica => ({ ...vrstica, enota: 'dijakov' }));
}
async function naloge(req) {
    const [vrstice] = await pool.execute(`SELECT n.*,n.id_naloga AS id,n.naslov AS naziv,n.rok_oddaje AS rok,p.sifra AS oznaka,p.barva,CONCAT(r.letnik,'. ',r.oznaka) AS razred,
        (SELECT COUNT(*) FROM Oddaja o LEFT JOIN Ocena_oddaje oc ON oc.id_oddaja=o.id_oddaja AND oc.ocenjena_verzija=o.verzija WHERE o.id_naloga=n.id_naloga AND oc.id_oddaja IS NULL) AS za_pregled
        FROM Naloga n JOIN Profesor_izvedba pi ON pi.id_izvedba=n.id_izvedba AND pi.aktivna=1 JOIN Profesor pr ON pr.id_profesor=pi.id_profesor
        JOIN Izvedba_predmeta i ON i.id_izvedba=n.id_izvedba AND i.aktivna=1 JOIN Predmet p ON p.id_predmet=i.id_predmet AND p.aktiven=1
        JOIN Razred r ON r.id_razred=i.id_razred WHERE pr.id_uporabnik=? AND n.aktivna=1 ORDER BY n.rok_oddaje`, [req.uporabnik.id]);
    const [teden] = await pool.execute(`SELECT COUNT(*) AS oddano,COUNT(oc.id_oddaja) AS pregledano FROM Oddaja o
        JOIN Profesor_izvedba pi ON pi.id_izvedba=o.id_izvedba AND pi.aktivna=1 JOIN Profesor pr ON pr.id_profesor=pi.id_profesor
        LEFT JOIN Ocena_oddaje oc ON oc.id_oddaja=o.id_oddaja AND oc.ocenjena_verzija=o.verzija WHERE pr.id_uporabnik=? AND o.oddano_zadnjic>=DATE_SUB(NOW(),INTERVAL 7 DAY)`, [req.uporabnik.id]);
    return { naloge: vrstice, za_pregled: vrstice.reduce((vsota, n) => vsota + Number(n.za_pregled), 0), teden_oddano: teden[0].oddano, teden_pregledano: teden[0].pregledano };
}
usmerjevalnik.get('/predmeti', async (req, res) => {
    const seznam = await predmeti(req);
    res.json({ predmeti: seznam, st_razredov: new Set(seznam.map(p => p.id_razred)).size });
});
usmerjevalnik.get('/izvedbe/:id/dijaki', async (req, res) => {
    await izvedba(req, req.params.id);
    const [vrstice] = await pool.execute(`SELECT d.id_dijak,u.ime,u.priimek,u.email,di.status FROM Dijak_izvedba di JOIN Dijak d ON d.id_dijak=di.id_dijak JOIN Uporabnik u ON u.id_uporabnik=d.id_uporabnik WHERE di.id_izvedba=? ORDER BY u.priimek,u.ime`, [req.params.id]);
    res.json(vrstice);
});
usmerjevalnik.get('/naloge', async (req, res) => res.json(await naloge(req)));
usmerjevalnik.get('/dashboard', async (req, res) => {
    const seznam = await predmeti(req);
    const podatki = await naloge(req);
    const [dogodki] = await pool.execute(`SELECT d.naslov,p.naziv,p.sifra,p.barva FROM Dogodek d LEFT JOIN Predmet p ON p.id_predmet=d.id_predmet WHERE d.id_uporabnik=? AND d.datum=CURDATE()`, [req.uporabnik.id]);
    const prihodnje = podatki.naloge.filter(n => new Date(n.rok) >= new Date());
    const rok = prihodnje[0] || null;
    res.json({ ...podatki, predmeti: seznam, dogodki_danes: dogodki, rok: rok ? { ...rok, dni: Math.ceil((new Date(rok.rok) - Date.now()) / 86400000) } : null });
});
usmerjevalnik.get('/gradiva', async (req, res) => {
    const [vrstice] = await pool.execute(`SELECT g.id_gradivo AS id,g.id_izvedba,g.naslov AS naziv,g.vrsta AS tip,g.url,g.id_datoteka,p.sifra AS oznaka,p.barva,CONCAT(r.letnik,'. ',r.oznaka) AS razred
        FROM Gradivo g JOIN Profesor_izvedba pi ON pi.id_izvedba=g.id_izvedba AND pi.aktivna=1 JOIN Profesor pr ON pr.id_profesor=pi.id_profesor
        JOIN Izvedba_predmeta i ON i.id_izvedba=g.id_izvedba AND i.aktivna=1 JOIN Predmet p ON p.id_predmet=i.id_predmet AND p.aktiven=1
        JOIN Razred r ON r.id_razred=i.id_razred WHERE pr.id_uporabnik=? AND g.aktivno=1 ORDER BY g.objavljeno DESC`, [req.uporabnik.id]);
    res.json(vrstice);
});
usmerjevalnik.post('/izvedbe/:id/gradiva', async (req, res, next) => { req.izvedba = await izvedba(req, req.params.id, true); next(); }, nalaganje.single('datoteka'), async (req, res) => {
    try {
        let naslov;
        let url = null;
        let vrsta = 'povezava';
        if (req.file) {
            const koncnica = path.extname(req.file.originalname).toLowerCase();
            const rocica = await fs.open(req.file.path, 'r');
            const glava = Buffer.alloc(8);
            try { await rocica.read(glava, 0, 8, 0); } finally { await rocica.close(); }
            const veljavna = koncnica === '.pdf' ? glava.subarray(0, 5).toString() === '%PDF-' : ['.docx', '.pptx'].includes(koncnica) ? glava.subarray(0, 4).equals(Buffer.from([80,75,3,4])) : glava.equals(Buffer.from([208,207,17,224,161,177,26,225]));
            if (!veljavna || !req.file.size) throw napaka(400, 'Vsebina datoteke ne ustreza izbrani vrsti.');
            naslov = besedilo(req.body.naslov || req.file.originalname, 200);
            vrsta = ['.ppt', '.pptx'].includes(koncnica) ? 'predstavitev' : 'dokument';
        } else {
            naslov = besedilo(req.body.naslov);
            url = besedilo(req.body.url, 2048);
            let povezava;
            try { povezava = new URL(url); } catch { throw napaka(400, 'Neveljavna povezava.'); }
            if (!['http:', 'https:'].includes(povezava.protocol) || povezava.username || povezava.password) throw napaka(400, 'Dovoljene so povezave HTTP in HTTPS brez gesla.');
        }
        const id = await transakcija(async povezava => {
            let datoteka = null;
            if (req.file) {
                const [rezultat] = await povezava.execute('INSERT INTO Datoteka (id_lastnik,izvorno_ime,shranjeno_ime,storage_kljuc,mime_tip,velikost_bajtov) VALUES (?,?,?,?,?,?)', [req.uporabnik.id, path.basename(req.file.originalname).slice(0,255), req.file.filename, req.file.filename, koncnice[path.extname(req.file.originalname).toLowerCase()], req.file.size]);
                datoteka = rezultat.insertId;
            }
            const [rezultat] = await povezava.execute('INSERT INTO Gradivo (id_izvedba,id_profesor,naslov,vrsta,id_datoteka,url) VALUES (?,?,?,?,?,?)', [req.izvedba.id_izvedba, req.izvedba.id_profesor, naslov, vrsta, datoteka, url]);
            return rezultat.insertId;
        });
        res.status(201).json({ id });
    } catch (napaka) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        throw napaka;
    }
});
usmerjevalnik.delete('/gradiva/:id', async (req, res) => {
    const [vrstice] = await pool.execute('SELECT id_izvedba FROM Gradivo WHERE id_gradivo=? AND aktivno=1', [stevilo(req.params.id)]);
    if (!vrstice.length) throw napaka(404, 'Gradivo ne obstaja.');
    await izvedba(req, vrstice[0].id_izvedba, true);
    await pool.execute('UPDATE Gradivo SET aktivno=0 WHERE id_gradivo=?', [req.params.id]);
    res.json({ sporocilo: 'Gradivo odstranjeno iz objave.' });
});
usmerjevalnik.post('/izvedbe/:id/naloge', async (req, res) => {
    const predmet = await izvedba(req, req.params.id, true);
    const naslov = besedilo(req.body.naslov);
    const opis = besedilo(req.body.opis, 10000);
    const rok = new Date(req.body.rok_oddaje);
    if (!Number.isFinite(rok.getTime()) || rok <= new Date()) throw napaka(400, 'Rok mora biti v prihodnosti.');
    const tocke = req.body.max_tock === '' || req.body.max_tock == null ? null : Number(req.body.max_tock);
    if (tocke !== null && (!Number.isFinite(tocke) || tocke <= 0 || tocke > 9999)) throw napaka(400, 'Neveljavno največje število točk.');
    const [rezultat] = await pool.execute('INSERT INTO Naloga (id_izvedba,id_profesor,naslov,opis,rok_oddaje,max_tock,dovoljena_pozna_oddaja) VALUES (?,?,?,?,?,?,?)', [predmet.id_izvedba,predmet.id_profesor,naslov,opis,rok,tocke,logika(req.body.dovoljena_pozna_oddaja || false)]);
    res.status(201).json({ id: rezultat.insertId });
});
usmerjevalnik.get('/naloge/:id/oddaje', async (req, res) => {
    const [naloga] = await pool.execute('SELECT * FROM Naloga WHERE id_naloga=? AND aktivna=1', [stevilo(req.params.id)]);
    if (!naloga.length) throw napaka(404, 'Naloga ne obstaja.');
    await izvedba(req, naloga[0].id_izvedba);
    const [oddaje] = await pool.execute(`SELECT o.*,u.ime,u.priimek,oc.tocke,oc.ocena,oc.komentar,oc.ocenjena_verzija FROM Oddaja o JOIN Dijak d ON d.id_dijak=o.id_dijak JOIN Uporabnik u ON u.id_uporabnik=d.id_uporabnik LEFT JOIN Ocena_oddaje oc ON oc.id_oddaja=o.id_oddaja WHERE o.id_naloga=? ORDER BY u.priimek,u.ime`, [req.params.id]);
    res.json({ naloga: naloga[0], oddaje });
});
usmerjevalnik.put('/oddaje/:id/ocena', async (req, res) => {
    const tocke = req.body.tocke === '' || req.body.tocke == null ? null : Number(req.body.tocke);
    const ocena = req.body.ocena === '' || req.body.ocena == null ? null : Number(req.body.ocena);
    const komentar = besedilo(req.body.komentar || '', 5000, false);
    if (tocke !== null && (!Number.isFinite(tocke) || tocke < 0 || tocke > 9999)) throw napaka(400, 'Neveljavne točke.');
    if (ocena !== null && (!Number.isInteger(ocena) || ocena < 1 || ocena > 5)) throw napaka(400, 'Ocena mora biti od 1 do 5.');
    if (tocke === null && ocena === null && !komentar) throw napaka(400, 'Vnesite točke, oceno ali komentar.');
    await transakcija(async povezava => {
        const [vrstice] = await povezava.execute('SELECT o.*,n.max_tock FROM Oddaja o JOIN Naloga n ON n.id_naloga=o.id_naloga WHERE o.id_oddaja=? FOR UPDATE', [stevilo(req.params.id)]);
        if (!vrstice.length) throw napaka(404, 'Oddaja ne obstaja.');
        const oddaja = vrstice[0];
        const predmet = await izvedba(req, oddaja.id_izvedba, true);
        if (Number(req.body.verzija) !== oddaja.verzija) throw napaka(409, 'Oddaja se je spremenila. Ponovno jo odprite.');
        if (tocke !== null && oddaja.max_tock !== null && tocke > Number(oddaja.max_tock)) throw napaka(400, 'Presegli ste največje število točk.');
        await povezava.execute(`INSERT INTO Ocena_oddaje (id_oddaja,id_profesor,tocke,ocena,komentar,ocenjena_verzija) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id_profesor=VALUES(id_profesor),tocke=VALUES(tocke),ocena=VALUES(ocena),komentar=VALUES(komentar),ocenjena_verzija=VALUES(ocenjena_verzija),ocenjeno=NOW()`, [oddaja.id_oddaja,predmet.id_profesor,tocke,ocena,komentar || null,oddaja.verzija]);
    });
    res.json({ sporocilo: 'Ocena shranjena.' });
});
module.exports = usmerjevalnik;
