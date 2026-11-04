const usmerjevalnik = require('express').Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const { napaka, stevilo, besedilo, izbira, logika, transakcija } = require('../pomoc');
const kopije = require('../kopije');
const uporabniskaPolja = 'id_uporabnik,uporabnisko_ime,ime,priimek,email,vloga,status,telefon,zadnja_prijava,ustvarjeno';
function email(vrednost) {
    const naslov = besedilo(vrednost, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(naslov)) throw napaka(400, 'Neveljaven e-naslov.');
    return naslov;
}
function podatkiUporabnika(podatki) {
    return [besedilo(podatki.uporabnisko_ime,50),besedilo(podatki.ime,50),besedilo(podatki.priimek,100),email(podatki.email),izbira(podatki.vloga,['dijak','profesor','administrator']),izbira(podatki.status,['caka','aktiven','onemogocen']),besedilo(podatki.telefon || '',32,false) || null];
}
usmerjevalnik.get('/uporabniki', async (req, res) => {
    const [vrstice] = await pool.query(`SELECT ${uporabniskaPolja} FROM Uporabnik ORDER BY priimek,ime`);
    res.json(vrstice);
});
usmerjevalnik.post('/uporabniki', async (req, res) => {
    const podatki = podatkiUporabnika(req.body);
    if (typeof req.body.geslo !== 'string' || req.body.geslo.length < 10 || Buffer.byteLength(req.body.geslo) > 72) throw napaka(400, 'Geslo naj ima vsaj 10 znakov in največ 72 bajtov.');
    const hash = await bcrypt.hash(req.body.geslo,12);
    const id = await transakcija(async povezava => {
        const [rezultat] = await povezava.execute('INSERT INTO Uporabnik (uporabnisko_ime,ime,priimek,email,vloga,status,telefon,geslo_hash) VALUES (?,?,?,?,?,?,?,?)', [...podatki,hash]);
        const id = rezultat.insertId;
        if (podatki[4] === 'dijak') await povezava.execute('INSERT INTO Dijak (id_uporabnik) VALUES (?)',[id]);
        if (podatki[4] === 'profesor') await povezava.execute('INSERT INTO Profesor (id_uporabnik) VALUES (?)',[id]);
        await povezava.execute('INSERT INTO Nastavitve_uporabnika (id_uporabnik) VALUES (?)',[id]);
        return id;
    });
    res.status(201).json({ id });
});
usmerjevalnik.put('/uporabniki/:id', async (req, res) => {
    const id = stevilo(req.params.id);
    const podatki = podatkiUporabnika(req.body);
    await transakcija(async povezava => {
        const [admini] = await povezava.query("SELECT id_uporabnik FROM Uporabnik WHERE vloga='administrator' AND status='aktiven' FOR UPDATE");
        const [vrstice] = await povezava.execute('SELECT vloga FROM Uporabnik WHERE id_uporabnik=? FOR UPDATE',[id]);
        if (!vrstice.length) throw napaka(404,'Uporabnik ne obstaja.');
        if (vrstice[0].vloga !== req.body.vloga) throw napaka(400,'Vloge obstoječega računa zaradi zgodovine ni mogoče spreminjati. Ustvarite ločen račun.');
        if (req.body.status !== 'aktiven' && (id === req.uporabnik.id || (vrstice[0].vloga === 'administrator' && admini.length <= 1))) throw napaka(400,'Svojega računa oziroma zadnjega administratorja ne morete onemogočiti.');
        await povezava.execute('UPDATE Uporabnik SET uporabnisko_ime=?,ime=?,priimek=?,email=?,vloga=?,status=?,telefon=? WHERE id_uporabnik=?',[...podatki,id]);
    });
    res.json({ sporocilo:'Uporabnik shranjen.' });
});
usmerjevalnik.delete('/uporabniki/:id', async (req,res) => {
    const id=stevilo(req.params.id);
    if (id === req.uporabnik.id) throw napaka(400,'Svojega računa ne morete izbrisati.');
    await transakcija(async povezava => {
        const [admini] = await povezava.query("SELECT id_uporabnik FROM Uporabnik WHERE vloga='administrator' AND status='aktiven' FOR UPDATE");
        if (admini.length <= 1 && admini.some(u => u.id_uporabnik === id)) throw napaka(400,'Zadnjega administratorja ne morete izbrisati.');
        await povezava.execute('DELETE FROM Dijak WHERE id_uporabnik=?',[id]);
        await povezava.execute('DELETE FROM Profesor WHERE id_uporabnik=?',[id]);
        const [rezultat]=await povezava.execute('DELETE FROM Uporabnik WHERE id_uporabnik=?',[id]);
        if (!rezultat.affectedRows) throw napaka(404,'Uporabnik ne obstaja.');
    });
    res.json({ sporocilo:'Uporabnik izbrisan.' });
});
const viri = {
    predmeti: { tabela:'Predmet', kljuci:['id_predmet'], polja:['sifra','naziv','opis','barva','aktiven'], preveri:p => [besedilo(p.sifra,20),besedilo(p.naziv,100),besedilo(p.opis || '',5000,false),/^#[0-9a-f]{6}$/i.test(p.barva) ? p.barva : (()=>{throw napaka(400,'Neveljavna barva.');})(),logika(p.aktiven)] },
    programi: { tabela:'Program', kljuci:['id_program'], polja:['oznaka','naziv','aktiven'], preveri:p => [besedilo(p.oznaka,20),besedilo(p.naziv,150),logika(p.aktiven)] },
    leta: { tabela:'Solsko_leto', kljuci:['id_solsko_leto'], polja:['zacetno_leto','datum_zacetka','datum_konca','status'], preveri:p => {
        const leto=stevilo(p.zacetno_leto);
        if (leto<2000 || leto>2200 || !/^\d{4}-\d{2}-\d{2}$/.test(p.datum_zacetka) || !/^\d{4}-\d{2}-\d{2}$/.test(p.datum_konca) || p.datum_konca<=p.datum_zacetka) throw napaka(400,'Preverite šolsko leto in datuma.');
        return [leto,p.datum_zacetka,p.datum_konca,izbira(p.status,['odprto','arhivirano'])];
    } },
    razredi: { tabela:'Razred', kljuci:['id_razred'], polja:['id_program','id_solsko_leto','letnik','oznaka','id_razrednik'], preveri:p => [stevilo(p.id_program),stevilo(p.id_solsko_leto),izbira(Number(p.letnik),[1,2,3,4]),besedilo(p.oznaka,10),p.id_razrednik ? stevilo(p.id_razrednik) : null] },
    izvedbe: { tabela:'Izvedba_predmeta', kljuci:['id_izvedba'], polja:['id_predmet','id_razred','aktivna'], preveri:p => [stevilo(p.id_predmet),stevilo(p.id_razred),logika(p.aktivna)] },
    profesorji: { tabela:'Profesor_izvedba', kljuci:['id_profesor','id_izvedba'], polja:['id_profesor','id_izvedba','aktivna'], preveri:p => [stevilo(p.id_profesor),stevilo(p.id_izvedba),logika(p.aktivna)] },
    dijaki: { tabela:'Dijak_izvedba', kljuci:['id_dijak','id_izvedba'], polja:['id_dijak','id_izvedba','status'], preveri:p => [stevilo(p.id_dijak),stevilo(p.id_izvedba),izbira(p.status,['caka','aktiven','izpisan'])] },
    vpisi: { tabela:'Vpis_v_razred', kljuci:['id_dijak','id_solsko_leto'], polja:['id_dijak','id_solsko_leto','id_razred'], preveri:p => [stevilo(p.id_dijak),stevilo(p.id_solsko_leto),stevilo(p.id_razred)] }
};
usmerjevalnik.get('/sifranti', async (req,res) => {
    const podatki={};
    for (const [ime,vir] of Object.entries(viri)) {
        const [vrstice]=await pool.query(`SELECT * FROM ${vir.tabela}`);
        podatki[ime]=vrstice;
    }
    const [profesorji]=await pool.query('SELECT p.id_profesor,CONCAT(u.ime,\' \',u.priimek) AS naziv FROM Profesor p JOIN Uporabnik u ON u.id_uporabnik=p.id_uporabnik');
    const [dijaki]=await pool.query('SELECT d.id_dijak,CONCAT(u.ime,\' \',u.priimek) AS naziv FROM Dijak d JOIN Uporabnik u ON u.id_uporabnik=d.id_uporabnik');
    podatki.osebe_profesorji=profesorji;
    podatki.osebe_dijaki=dijaki;
    res.json(podatki);
});
usmerjevalnik.param('vir',(req,res,next,ime) => {
    if (!viri[ime]) return next(napaka(404,'Neznan šifrant.'));
    req.vir=viri[ime]; next();
});
async function shraniVir(req,res) {
    const vir=req.vir;
    const podatki=vir.preveri(req.body);
    const kljuci=req.params.id ? req.params.id.split('~').map(stevilo) : null;
    if (kljuci && (kljuci.length!==vir.kljuci.length || vir.kljuci.some((k,i)=>vir.polja.includes(k) && Number(req.body[k])!==kljuci[i]))) throw napaka(400,'Ključev povezave ni mogoče spreminjati.');
    await transakcija(async povezava => {
        if (req.params.vir==='dijaki') {
            const [vpis]=await povezava.execute(`SELECT v.id_dijak FROM Vpis_v_razred v JOIN Razred r ON r.id_razred=v.id_razred JOIN Izvedba_predmeta i ON i.id_razred=r.id_razred WHERE v.id_dijak=? AND i.id_izvedba=?`,[req.body.id_dijak,req.body.id_izvedba]);
            if (!vpis.length) throw napaka(400,'Dijak mora biti vpisan v razred te izvedbe.');
        }
        if (req.params.vir==='vpisi' && kljuci) {
            const [povezave]=await povezava.execute(`SELECT di.id_dijak FROM Dijak_izvedba di JOIN Izvedba_predmeta i ON i.id_izvedba=di.id_izvedba JOIN Razred r ON r.id_razred=i.id_razred WHERE di.id_dijak=? AND r.id_solsko_leto=? AND r.id_razred<>? LIMIT 1`,[req.body.id_dijak,req.body.id_solsko_leto,req.body.id_razred]);
            if (povezave.length) throw napaka(409,'Dijak ima povezane izvedbe drugega razreda. Ohranite zgodovino in uredite vpis za novo leto.');
        }
        if (req.params.vir==='izvedbe' && kljuci) {
            const [staro]=await povezava.execute('SELECT id_predmet,id_razred FROM Izvedba_predmeta WHERE id_izvedba=?',[kljuci[0]]);
            if (staro.length && (staro[0].id_predmet!==Number(req.body.id_predmet) || staro[0].id_razred!==Number(req.body.id_razred))) throw napaka(400,'Za drug predmet ali razred ustvarite novo izvedbo. Obstoječi lahko spremenite aktivnost.');
        }
        const [rezultat]=kljuci ? await povezava.execute(`UPDATE ${vir.tabela} SET ${vir.polja.map(p=>p+'=?').join(',')} WHERE ${vir.kljuci.map(k=>k+'=?').join(' AND ')}`,[...podatki,...kljuci]) : await povezava.execute(`INSERT INTO ${vir.tabela} (${vir.polja.join(',')}) VALUES (${vir.polja.map(()=>'?').join(',')})`,podatki);
        if (kljuci && !rezultat.affectedRows) throw napaka(404,'Zapis ne obstaja.');
    });
    res.status(kljuci ? 200 : 201).json({ sporocilo:'Shranjeno.' });
}
usmerjevalnik.post('/sifranti/:vir',shraniVir);
usmerjevalnik.put('/sifranti/:vir/:id',shraniVir);
usmerjevalnik.delete('/sifranti/:vir/:id',async(req,res)=>{
    const kljuci=req.params.id.split('~').map(stevilo);
    if (kljuci.length!==req.vir.kljuci.length) throw napaka(400,'Neveljaven ključ.');
    const [rezultat]=await pool.execute(`DELETE FROM ${req.vir.tabela} WHERE ${req.vir.kljuci.map(k=>k+'=?').join(' AND ')}`,kljuci);
    if (!rezultat.affectedRows) throw napaka(404,'Zapis ne obstaja.');
    res.json({ sporocilo:'Izbrisano.' });
});
usmerjevalnik.get('/dashboard',async(req,res)=>{
    const [vrstice]=await pool.query(`SELECT COUNT(*) AS racuni,SUM(vloga='dijak' AND status='aktiven') AS dijaki,SUM(vloga='profesor' AND status='aktiven') AS profesorji,SUM(status='caka') AS caka,SUM(status='aktiven') AS aktivni,SUM(ustvarjeno>=DATE_SUB(NOW(),INTERVAL 7 DAY)) AS novi FROM Uporabnik`);
    const [razredi]=await pool.query('SELECT COUNT(*) AS stevilo,SUM(id_razrednik IS NULL) AS brez FROM Razred');
    res.json({ ...vrstice[0],razredi:razredi[0].stevilo,brez_razrednika:razredi[0].brez || 0,kopije:await kopije.stanje() });
});
usmerjevalnik.get('/nastavitve',async(req,res)=>{
    const [vrstice]=await pool.query('SELECT * FROM Nastavitve_sistema WHERE id_nastavitve=1');
    res.json({ ...vrstice[0],kopije:await kopije.stanje() });
});
usmerjevalnik.put('/nastavitve',async(req,res)=>{
    const p=req.body;
    const [leto]=await pool.execute("SELECT id_solsko_leto FROM Solsko_leto WHERE id_solsko_leto=? AND status='odprto'",[stevilo(p.id_trenutno_leto)]);
    if (!leto.length) throw napaka(400,'Izberite odprto šolsko leto.');
    await pool.execute(`INSERT INTO Nastavitve_sistema (id_nastavitve,ime_sole,email_sole,casovni_pas,id_trenutno_leto,rocna_potrditev,obvestilo_nova_prijava,potek_seje_minut,samodejne_kopije,pogostost_kopij) VALUES (1,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE ime_sole=VALUES(ime_sole),email_sole=VALUES(email_sole),casovni_pas=VALUES(casovni_pas),id_trenutno_leto=VALUES(id_trenutno_leto),rocna_potrditev=VALUES(rocna_potrditev),obvestilo_nova_prijava=VALUES(obvestilo_nova_prijava),potek_seje_minut=VALUES(potek_seje_minut),samodejne_kopije=VALUES(samodejne_kopije),pogostost_kopij=VALUES(pogostost_kopij),posodobljeno=NOW()`,[besedilo(p.ime_sole),email(p.email_sole),izbira(p.casovni_pas,['Europe/Ljubljana']),stevilo(p.id_trenutno_leto),logika(p.rocna_potrditev),logika(p.obvestilo_nova_prijava),izbira(Number(p.potek_seje_minut),[30,60,240]),logika(p.samodejne_kopije),izbira(p.pogostost_kopij,['dnevno','tedensko'])]);
    res.json({ sporocilo:'Nastavitve shranjene. Nov čas seje velja ob naslednji prijavi.' });
});
usmerjevalnik.post('/kopije',async(req,res)=>res.status(201).json(await kopije.ustvari()));
usmerjevalnik.post('/arhiv',async(req,res)=>{
    const id=stevilo(req.body.id_solsko_leto);
    const [rezultat]=await pool.execute("UPDATE Solsko_leto SET status='arhivirano' WHERE id_solsko_leto=?",[id]);
    if (!rezultat.affectedRows) throw napaka(404,'Šolsko leto ne obstaja.');
    res.json({ sporocilo:'Leto arhivirano. Podatki so ohranjeni. Pred novim delom izberite odprto leto v nastavitvah.' });
});
usmerjevalnik.get('/izvoz',async(req,res)=>{
    const podatki={};
    const [uporabniki]=await pool.query(`SELECT ${uporabniskaPolja} FROM Uporabnik`);
    podatki.uporabniki=uporabniki;
    for (const tabela of ['Dijak','Profesor','Program','Solsko_leto','Razred','Vpis_v_razred','Predmet','Izvedba_predmeta','Profesor_izvedba','Dijak_izvedba','Gradivo','Naloga','Oddaja','Ocena_oddaje','Nastavitve_sistema']) {
        const [vrstice]=await pool.query(`SELECT * FROM ${tabela}`); podatki[tabela]=vrstice;
    }
    res.attachment('izvoz-sistema.json').json(podatki);
});
module.exports=usmerjevalnik;
