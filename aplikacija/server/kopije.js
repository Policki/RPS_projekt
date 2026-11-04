const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');
const pool = require('./db');
const { napaka } = require('./pomoc');
const mapa = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '../backup'));
let vTeku = false;
async function stanje() {
    let datoteke=[];
    try { datoteke=(await fs.readdir(mapa)).filter(ime=>/^sola-.*\.sql$/.test(ime)).sort().reverse(); } catch (napaka) { if (napaka.code!=='ENOENT') throw napaka; }
    return { zadnja:datoteke[0] || null, stevilo:datoteke.length, v_teku:vTeku };
}
async function ustvari() {
    if (vTeku) throw napaka(409,'Varnostna kopija se že izvaja.');
    vTeku=true;
    const ime='sola-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sql';
    const zacasna=path.join(mapa,ime+'.delno');
    try {
        await fs.mkdir(mapa,{recursive:true,mode:0o700});
        const proces=spawn(process.env.DB_DUMP_BIN || 'mariadb-dump',['--host='+process.env.DB_HOST,'--port='+(process.env.DB_PORT || '3306'),'--user='+process.env.DB_USER,'--single-transaction','--skip-lock-tables','--hex-blob',process.env.DB_NAME],{env:{...process.env,MYSQL_PWD:process.env.DB_PASSWORD},windowsHide:true});
        proces.stderr.resume();
        const koncano=new Promise((razresi,zavrni)=>{ proces.once('error',zavrni); proces.once('exit',koda=>koda===0 ? razresi() : zavrni(napaka(500,'Izdelava kopije ni uspela.'))); });
        await Promise.all([pipeline(proces.stdout,createWriteStream(zacasna,{flags:'wx',mode:0o600})),koncano]);
        await fs.rename(zacasna,path.join(mapa,ime));
        return { sporocilo:'Kopija baze ustvarjena.', datoteka:ime };
    } catch (napaka) { await fs.unlink(zacasna).catch(()=>{}); throw napaka; }
    finally { vTeku=false; }
}
function zacniUrnik() {
    setInterval(async()=>{
        try {
            const [vrstice]=await pool.query('SELECT samodejne_kopije,pogostost_kopij,ura_kopije,casovni_pas FROM Nastavitve_sistema WHERE id_nastavitve=1');
            const nastavitev=vrstice[0];
            if (!nastavitev?.samodejne_kopije || vTeku) return;
            const ura=new Intl.DateTimeFormat('en-GB',{timeZone:nastavitev.casovni_pas,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
            if (ura<nastavitev.ura_kopije.slice(0,5)) return;
            const zadnja=(await stanje()).zadnja;
            const razmik=nastavitev.pogostost_kopij==='tedensko' ? 7*86400000 : 86400000;
            if (zadnja && Date.now()-(await fs.stat(path.join(mapa,zadnja))).mtimeMs<razmik-60000) return;
            await ustvari();
        } catch (napaka) { console.error('Samodejna kopija ni uspela:',napaka.code || napaka.message); }
    },60000).unref();
}
module.exports={stanje,ustvari,zacniUrnik};
