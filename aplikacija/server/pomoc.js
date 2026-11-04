const pool = require('./db');
function napaka(status, sporocilo) { return Object.assign(new Error(sporocilo), { status }); }
function stevilo(vrednost) {
    const id = Number(vrednost);
    if (!Number.isSafeInteger(id) || id < 1) throw napaka(400, 'Neveljavna številka.');
    return id;
}
function besedilo(vrednost, najvec = 200, obvezno = true) {
    if (typeof vrednost !== 'string' || vrednost.trim().length > najvec || (obvezno && !vrednost.trim())) throw napaka(400, 'Preverite obvezna polja in dolžino besedila.');
    return vrednost.trim();
}
function izbira(vrednost, moznosti) {
    if (!moznosti.includes(vrednost)) throw napaka(400, 'Neveljavna izbira.');
    return vrednost;
}
function logika(vrednost) {
    if (![true, false, 0, 1].includes(vrednost)) throw napaka(400, 'Pričakovana je vrednost da/ne.');
    return Number(vrednost);
}
async function transakcija(dejanje) {
    const povezava = await pool.getConnection();
    try { await povezava.beginTransaction(); const rezultat = await dejanje(povezava); await povezava.commit(); return rezultat; }
    catch (napaka) { await povezava.rollback(); throw napaka; }
    finally { povezava.release(); }
}
async function izvedba(req, id, pisanje = false) {
    const [vrstice] = await pool.execute(`SELECT i.*, l.status AS stanje_leta, pr.id_profesor
        FROM Izvedba_predmeta i JOIN Razred r ON r.id_razred=i.id_razred
        JOIN Solsko_leto l ON l.id_solsko_leto=r.id_solsko_leto
        JOIN Profesor_izvedba pi ON pi.id_izvedba=i.id_izvedba AND pi.aktivna=1
        JOIN Profesor pr ON pr.id_profesor=pi.id_profesor JOIN Predmet p ON p.id_predmet=i.id_predmet
        WHERE i.id_izvedba=? AND pr.id_uporabnik=? AND i.aktivna=1 AND p.aktiven=1`, [stevilo(id), req.uporabnik.id]);
    if (!vrstice.length) throw napaka(403, 'Nimate dostopa do te izvedbe.');
    if (pisanje && vrstice[0].stanje_leta !== 'odprto') throw napaka(403, 'Šolsko leto je arhivirano.');
    return vrstice[0];
}
module.exports = { napaka, stevilo, besedilo, izbira, logika, transakcija, izvedba };
