const { Writable }=require('stream');
const readline=require('readline/promises');
const bcrypt=require('bcrypt');
const pool=require('../server/db');
let skrito=false;
const izhod=new Writable({write(vsebina,kodiranje,koncano){if(!skrito)process.stdout.write(vsebina);koncano();}});
const vnos=readline.createInterface({input:process.stdin,output:izhod,terminal:true});
async function zagon(){
    const ime=(await vnos.question('Uporabniško ime: ')).trim();
    const email=(await vnos.question('E-naslov: ')).trim();
    process.stdout.write('Geslo (vsaj 12 znakov; vnos je skrit): ');skrito=true;
    const geslo=await vnos.question('');skrito=false;process.stdout.write('\n');
    if(!/^[a-zA-Z0-9_.-]{3,50}$/.test(ime)||!/^\S+@\S+\.\S+$/.test(email)||geslo.length<12||Buffer.byteLength(geslo)>72)throw new Error('Preverite uporabniško ime, e-naslov in dolžino gesla.');
    await pool.execute("INSERT INTO Uporabnik (uporabnisko_ime,ime,priimek,email,geslo_hash,vloga,status) VALUES (?,'Skrbnik','Sistema',?,?,'administrator','aktiven')",[ime,email,await bcrypt.hash(geslo,12)]);
    console.log('Administrator je ustvarjen.');
}
zagon().catch(n=>{console.error(n.code==='ER_DUP_ENTRY'?'Račun že obstaja.':n.message);process.exitCode=1;}).finally(async()=>{vnos.close();await pool.end();});
