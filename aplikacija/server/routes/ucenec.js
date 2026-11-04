const usmerjevalnik=require('express').Router();
const pool=require('../db');
const {napaka,stevilo,besedilo,transakcija}=require('../pomoc');
const {nalaganje,preveriDatoteko,shraniZapis,odstraniZacasno,obstaja}=require('../datoteke');
const sprejmiDatoteko=nalaganje(['.pdf','.doc','.docx','.ppt','.pptx','.xlsx','.txt','.sql','.zip','.png','.jpg','.jpeg']);
const povezave=`FROM Naloga n JOIN Izvedba_predmeta i ON i.id_izvedba=n.id_izvedba AND i.aktivna=1
    JOIN Predmet p ON p.id_predmet=i.id_predmet AND p.aktiven=1
    JOIN Razred r ON r.id_razred=i.id_razred JOIN Solsko_leto l ON l.id_solsko_leto=r.id_solsko_leto
    JOIN Dijak_izvedba di ON di.id_izvedba=i.id_izvedba AND di.status='aktiven'
    JOIN Dijak d ON d.id_dijak=di.id_dijak`;
async function preveriNalogo(req,povezava=pool,zakleni=false){
    const [vrstice]=await povezava.execute(`SELECT n.*,d.id_dijak,l.status AS stanje_leta,n.rok_oddaje<NOW() AS rok_potekel
        ${povezave} WHERE n.id_naloga=? AND d.id_uporabnik=? AND n.aktivna=1 AND n.objavljeno<=NOW()${zakleni ? ' FOR UPDATE' : ''}`,[stevilo(req.params.id),req.uporabnik.id]);
    if(!vrstice.length)throw napaka(403,'Nimate dostopa do te naloge.');
    const naloga=vrstice[0];
    if(naloga.stanje_leta!=='odprto')throw napaka(403,'Šolsko leto je arhivirano.');
    if(naloga.rok_potekel && !naloga.dovoljena_pozna_oddaja)throw napaka(400,'Rok za oddajo je potekel.');
    return naloga;
}
usmerjevalnik.get('/naloge',async(req,res)=>{
    const [vrstice]=await pool.execute(`SELECT n.*,p.naziv AS predmet,p.sifra,p.barva,l.status AS stanje_leta,
        CONCAT(u.ime,' ',u.priimek) AS profesor,n.rok_oddaje<NOW() AS rok_potekel,
        o.id_oddaja,o.id_datoteka,o.komentar_dijaka,o.oddano_zadnjic,o.verzija,f.izvorno_ime,f.storage_kljuc,
        oc.tocke,oc.ocena,oc.komentar,oc.ocenjeno
        ${povezave} JOIN Profesor pr ON pr.id_profesor=n.id_profesor JOIN Uporabnik u ON u.id_uporabnik=pr.id_uporabnik
        LEFT JOIN Oddaja o ON o.id_naloga=n.id_naloga AND o.id_dijak=d.id_dijak
        LEFT JOIN Datoteka f ON f.id_datoteka=o.id_datoteka
        LEFT JOIN Ocena_oddaje oc ON oc.id_oddaja=o.id_oddaja AND oc.ocenjena_verzija=o.verzija
        WHERE d.id_uporabnik=? AND n.aktivna=1 AND n.objavljeno<=NOW() ORDER BY n.rok_oddaje`,[req.uporabnik.id]);
    res.json(await Promise.all(vrstice.map(async n=>{const {storage_kljuc,...naloga}=n;return {...naloga,datoteka_na_voljo:await obstaja(storage_kljuc)};})));
});
usmerjevalnik.get('/gradiva',async(req,res)=>{
    const [vrstice]=await pool.execute(`SELECT g.id_gradivo,g.id_izvedba,g.naslov,g.opis,g.vrsta,g.url,g.objavljeno,g.trajanje_sekund,
        p.id_predmet,p.naziv AS predmet,p.sifra,p.barva,f.id_datoteka,f.izvorno_ime,f.velikost_bajtov,f.storage_kljuc
        FROM Gradivo g JOIN Izvedba_predmeta i ON i.id_izvedba=g.id_izvedba AND i.aktivna=1
        JOIN Predmet p ON p.id_predmet=i.id_predmet AND p.aktiven=1
        JOIN Dijak_izvedba di ON di.id_izvedba=i.id_izvedba AND di.status='aktiven' JOIN Dijak d ON d.id_dijak=di.id_dijak
        LEFT JOIN Datoteka f ON f.id_datoteka=g.id_datoteka
        WHERE d.id_uporabnik=? AND g.aktivno=1 AND g.objavljeno<=NOW() ORDER BY g.objavljeno DESC`,[req.uporabnik.id]);
    res.json(await Promise.all(vrstice.map(async g=>{const {storage_kljuc,...gradivo}=g;return {...gradivo,datoteka_na_voljo:await obstaja(storage_kljuc)};})));
});
usmerjevalnik.post('/naloge/:id/oddaja',async(req,res,next)=>{
    req.naloga=await preveriNalogo(req);next();
},sprejmiDatoteko,async(req,res)=>{
    try{
        const mime=await preveriDatoteko(req.file,Math.min(Number(req.naloga.max_velikost_bajtov),10*1024*1024));
        const komentar=besedilo(req.body.komentar || '',5000,false);
        const verzija=Number(req.body.verzija);
        if(!Number.isSafeInteger(verzija) || verzija<0)throw napaka(400,'Osvežite seznam nalog in poskusite znova.');
        const rezultat=await transakcija(async povezava=>{
            const naloga=await preveriNalogo(req,povezava,true);
            if(req.file.size>Number(naloga.max_velikost_bajtov))throw napaka(400,'Datoteka presega dovoljeno velikost.');
            const [oddaje]=await povezava.execute('SELECT id_oddaja,verzija FROM Oddaja WHERE id_naloga=? AND id_dijak=? FOR UPDATE',[naloga.id_naloga,naloga.id_dijak]);
            const stara=oddaje[0];
            if(verzija!==(stara?.verzija || 0))throw napaka(409,'Oddaja se je spremenila. Osvežite seznam in ponovno izberite datoteko.');
            const datoteka=await shraniZapis(povezava,req.uporabnik.id,req.file,mime);
            if(stara){
                await povezava.execute('UPDATE Oddaja SET id_datoteka=?,komentar_dijaka=?,oddano_zadnjic=NOW(),verzija=verzija+1 WHERE id_oddaja=?',[datoteka,komentar || null,stara.id_oddaja]);
                return {id:stara.id_oddaja,verzija:verzija+1,nova:false};
            }
            const [vpis]=await povezava.execute('INSERT INTO Oddaja (id_naloga,id_izvedba,id_dijak,id_datoteka,komentar_dijaka) VALUES (?,?,?,?,?)',[naloga.id_naloga,naloga.id_izvedba,naloga.id_dijak,datoteka,komentar || null]);
            return {id:vpis.insertId,verzija:1,nova:true};
        });
        res.status(rezultat.nova ? 201 : 200).json({...rezultat,sporocilo:'Datoteka je uspešno oddana.'});
    }catch(napaka){await odstraniZacasno(req.file);throw napaka;}
});
module.exports=usmerjevalnik;
