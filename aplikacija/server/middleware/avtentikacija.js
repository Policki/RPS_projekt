const pool = require('../db');
const { timingSafeEqual } = require('crypto');
function zavrni(req, res, status, sporocilo) {
    if (req.originalUrl.startsWith('/api/')) return res.status(status).json({ napaka: sporocilo });
    if (status === 401) return res.redirect('/');
    return res.status(status).send(sporocilo);
}
async function prijava(req, res, next) {
    if (!req.session.uporabnik) return zavrni(req, res, 401, 'Prijavite se.');
    const [vrstice] = await pool.execute(`SELECT id_uporabnik AS id, uporabnisko_ime, ime, priimek, email, telefon, vloga, status, jezik FROM Uporabnik WHERE id_uporabnik=?`, [req.session.uporabnik.id]);
    if (!vrstice.length || vrstice[0].status !== 'aktiven' || vrstice[0].vloga !== req.session.uporabnik.vloga) return req.session.destroy(() => zavrni(req, res, 401, 'Seja je potekla.'));
    req.uporabnik = vrstice[0];
    res.set('Cache-Control', 'no-store');
    next();
}
function vloga(zahtevana) {
    return (req, res, next) => req.uporabnik.vloga === zahtevana ? next() : zavrni(req, res, 403, 'Nimate dovoljenja za dostop.');
}
function preveriIzvorPrijave(req,res,next) {
    const izvor=req.get('origin');
    const mesto=req.get('sec-fetch-site');
    const pricakovan=`${req.protocol}://${req.get('host')}`;
    const skritIstiIzvor=izvor==='null' && mesto==='same-origin';
    if(mesto==='cross-site' || (izvor && izvor!==pricakovan && !skritIstiIzvor)){
        return res.status(403).send('Prijava s te strani ni dovoljena. Odpri prijavno stran aplikacije in poskusi znova.');
    }
    next();
}
function csrf(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const prejet = Buffer.from(req.get('x-csrf-token') || '');
    const pricakovan = Buffer.from(req.session.csrf || '');
    if (!prejet.length || prejet.length !== pricakovan.length || !timingSafeEqual(prejet, pricakovan)) return res.status(403).json({ napaka: 'Osvežite stran in poskusite znova.' });
    next();
}
module.exports = { prijava, vloga, csrf, preveriIzvorPrijave };
