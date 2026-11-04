const pot = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcrypt');
const { randomBytes } = require('crypto');
const usmerjevalnik = require('express').Router();
const pool = require('../db');
const { napaka, stevilo, besedilo, logika } = require('../pomoc');

usmerjevalnik.get('/uporabnik', async (req, res) => {
    const uporabnik = { ...req.uporabnik };
    const [razredi] = await pool.execute(`SELECT r.letnik,r.oznaka, CONCAT(u.ime,' ',u.priimek) AS razrednik
        FROM Dijak d JOIN Vpis_v_razred v ON v.id_dijak=d.id_dijak JOIN Razred r ON r.id_razred=v.id_razred
        JOIN Nastavitve_sistema n ON n.id_trenutno_leto=r.id_solsko_leto
        LEFT JOIN Profesor p ON p.id_profesor=r.id_razrednik LEFT JOIN Uporabnik u ON u.id_uporabnik=p.id_uporabnik WHERE d.id_uporabnik=?`, [uporabnik.id]);
    uporabnik.razred = razredi[0] ? `${razredi[0].letnik}. ${razredi[0].oznaka}` : null;
    uporabnik.razrednik = razredi[0]?.razrednik || null;
    const [sola] = await pool.query('SELECT ime_sole,email_sole FROM Nastavitve_sistema WHERE id_nastavitve=1');
    req.session.csrf ||= randomBytes(32).toString('hex');
    res.json({ uporabnik, csrf: req.session.csrf, sola: sola[0] || {} });
});
usmerjevalnik.patch('/profil', async (req, res) => {
    const telefon = besedilo(req.body.telefon, 32, false);
    if (telefon && !/^[+()\d\s-]{5,32}$/.test(telefon)) throw napaka(400, 'Neveljavna telefonska številka.');
    await pool.execute('UPDATE Uporabnik SET telefon=? WHERE id_uporabnik=?', [telefon || null, req.uporabnik.id]);
    res.json({ sporocilo: 'Telefon shranjen.' });
});
usmerjevalnik.post('/geslo', async (req, res) => {
    const { staro, novo } = req.body;
    if (typeof staro !== 'string' || typeof novo !== 'string' || novo.length < 10 || Buffer.byteLength(novo) > 72) throw napaka(400, 'Novo geslo naj ima vsaj 10 znakov in največ 72 bajtov.');
    const [vrstice] = await pool.execute('SELECT geslo_hash FROM Uporabnik WHERE id_uporabnik=?', [req.uporabnik.id]);
    if (!await bcrypt.compare(staro, vrstice[0].geslo_hash)) throw napaka(400, 'Trenutno geslo ni pravilno.');
    await pool.execute('UPDATE Uporabnik SET geslo_hash=? WHERE id_uporabnik=?', [await bcrypt.hash(novo, 12), req.uporabnik.id]);
    await pool.execute("DELETE FROM Http_seje WHERE JSON_EXTRACT(data,'$.uporabnik.id')=?", [req.uporabnik.id]);
    await new Promise((razresi, zavrni) => req.session.destroy(n => n ? zavrni(n) : razresi()));
    res.clearCookie('rps.sid');
    res.json({ sporocilo: 'Geslo spremenjeno. Ponovno se prijavite.' });
});
const polja = ['nova_naloga', 'opomnik_rok', 'novo_gradivo', 'novi_vpisi', 'sistemska_obvestila', 'tedenski_povzetek'];
usmerjevalnik.get('/nastavitve', async (req, res) => {
    await pool.execute('INSERT IGNORE INTO Nastavitve_uporabnika (id_uporabnik) VALUES (?)', [req.uporabnik.id]);
    const [vrstice] = await pool.execute('SELECT * FROM Nastavitve_uporabnika WHERE id_uporabnik=?', [req.uporabnik.id]);
    res.json(Object.fromEntries(polja.map(polje => [polje, Boolean(vrstice[0][polje])])));
});
usmerjevalnik.patch('/nastavitve', async (req, res) => {
    const izbrana = Object.keys(req.body);
    if (!izbrana.length || izbrana.some(polje => !polja.includes(polje))) throw napaka(400, 'Neveljavna nastavitev.');
    const vrednosti = izbrana.map(polje => logika(req.body[polje]));
    await pool.execute('INSERT IGNORE INTO Nastavitve_uporabnika (id_uporabnik) VALUES (?)', [req.uporabnik.id]);
    await pool.execute(`UPDATE Nastavitve_uporabnika SET ${izbrana.map(polje => polje + '=?').join(',')} WHERE id_uporabnik=?`, [...vrednosti, req.uporabnik.id]);
    res.json({ sporocilo: 'Nastavitve shranjene.' });
});
usmerjevalnik.get('/predmeti', async (req, res) => {
    const [vrstice] = await pool.query('SELECT id_predmet,sifra,naziv,opis,barva,aktiven FROM Predmet WHERE aktiven=1 ORDER BY naziv');
    res.json(vrstice);
});
usmerjevalnik.get('/moji-predmeti', async (req, res) => {
    if (req.uporabnik.vloga !== 'dijak') throw napaka(403, 'Dostop imajo dijaki.');
    const [vrstice] = await pool.execute(`SELECT p.id_predmet,p.sifra,p.naziv,p.opis,p.barva,i.id_izvedba
        FROM Dijak d JOIN Dijak_izvedba di ON di.id_dijak=d.id_dijak JOIN Izvedba_predmeta i ON i.id_izvedba=di.id_izvedba
        JOIN Predmet p ON p.id_predmet=i.id_predmet WHERE d.id_uporabnik=? AND di.status='aktiven' AND i.aktivna=1 AND p.aktiven=1 ORDER BY p.naziv`, [req.uporabnik.id]);
    res.json(vrstice);
});
usmerjevalnik.get('/dogodki', async (req, res) => {
    const [vrstice] = await pool.execute(`SELECT d.id_dogodek AS id,d.naslov,d.datum,d.opis,d.id_predmet,p.naziv,p.barva FROM Dogodek d LEFT JOIN Predmet p ON p.id_predmet=d.id_predmet WHERE d.id_uporabnik=? ORDER BY d.datum,d.id_dogodek`, [req.uporabnik.id]);
    res.json(vrstice);
});
usmerjevalnik.post('/dogodki', async (req, res) => {
    const naslov = besedilo(req.body.naslov);
    const datum = req.body.datum;
    if (typeof datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(datum) || !Number.isFinite(Date.parse(datum)) || new Date(datum).toISOString().slice(0, 10) !== datum) throw napaka(400, 'Neveljaven datum.');
    const [rezultat] = await pool.execute('INSERT INTO Dogodek (id_uporabnik,naslov,datum,opis) VALUES (?,?,?,?)', [req.uporabnik.id, naslov, datum, besedilo(req.body.opis || '', 2000, false)]);
    res.status(201).json({ id: rezultat.insertId });
});
usmerjevalnik.delete('/dogodki/:id', async (req, res) => {
    const [rezultat] = await pool.execute('DELETE FROM Dogodek WHERE id_dogodek=? AND id_uporabnik=?', [stevilo(req.params.id), req.uporabnik.id]);
    if (!rezultat.affectedRows) throw napaka(404, 'Dogodek ne obstaja.');
    res.json({ sporocilo: 'Dogodek odstranjen.' });
});
usmerjevalnik.get('/datoteke/:id', async (req, res) => {
    const id = stevilo(req.params.id);
    const [vrstice] = await pool.execute(`SELECT DISTINCT f.* FROM Datoteka f
        LEFT JOIN Gradivo g ON g.id_datoteka=f.id_datoteka AND g.aktivno=1
        LEFT JOIN Oddaja o ON o.id_datoteka=f.id_datoteka
        LEFT JOIN Izvedba_predmeta i ON i.id_izvedba=COALESCE(g.id_izvedba,o.id_izvedba) AND i.aktivna=1
        LEFT JOIN Predmet p ON p.id_predmet=i.id_predmet AND p.aktiven=1
        LEFT JOIN Profesor_izvedba pi ON pi.id_izvedba=i.id_izvedba AND pi.aktivna=1
        LEFT JOIN Profesor pr ON pr.id_profesor=pi.id_profesor
        LEFT JOIN Dijak_izvedba di ON di.id_izvedba=i.id_izvedba AND di.status='aktiven'
        LEFT JOIN Dijak d ON d.id_dijak=di.id_dijak
        WHERE f.id_datoteka=? AND (?='administrator' OR (i.id_izvedba IS NOT NULL AND p.id_predmet IS NOT NULL AND ((?='profesor' AND pr.id_uporabnik=?) OR (?='dijak' AND d.id_uporabnik=? AND (g.id_gradivo IS NOT NULL OR o.id_dijak=d.id_dijak)))))`, [id, req.uporabnik.vloga, req.uporabnik.vloga, req.uporabnik.id, req.uporabnik.vloga, req.uporabnik.id]);
    if (!vrstice.length) throw napaka(403, 'Nimate dostopa do datoteke.');
    const datoteka = vrstice[0];
    const mapa = pot.resolve(process.env.UPLOAD_DIR || pot.join(__dirname, '../../podatki/datoteke'));
    const naslov = pot.resolve(mapa, datoteka.storage_kljuc);
    if (!naslov.startsWith(mapa + pot.sep)) throw napaka(404, 'Datoteka ni na voljo.');
    try { await fs.access(naslov); } catch { throw napaka(404, 'Datoteka ni na voljo. Vzorčni SQL vsebuje samo metapodatke.'); }
    res.download(naslov, datoteka.izvorno_ime);
});
module.exports = usmerjevalnik;
