const assert=require('assert/strict');
const {execFileSync,spawn}=require('child_process');
const path=require('path');
const fs=require('fs');
const koren=path.resolve(__dirname,'../..');
let preizkusi=0;
function preveri(pogoj,opis){assert.ok(pogoj,opis);preizkusi++;console.log('OK '+opis);}
function docker(...argumenti){return execFileSync('docker',argumenti,{cwd:koren,encoding:'utf8',windowsHide:true,maxBuffer:5*1024*1024,env:{...process.env,DB_ROOT_PASSWORD:'test',DB_PASSWORD:'test',SESSION_SECRET:'lokalni-preizkus-seje-ki-ima-vec-kot-32-znakov'}});}
function test(...argumenti){return docker('compose','-p','rps-preizkus','-f','aplikacija/test/compose.yml',...argumenti);}
function produkcija(...argumenti){return docker('compose','-p','rps-produk-test','-f','aplikacija/test/compose.prod.yml',...argumenti);}
async function zagon(){
    const config=JSON.parse(docker('compose','--env-file','.env.example','-f','docker-compose.prod.yml','config','--format','json'));
    preveri(!config.services.aplikacija.ports && !config.services.baza.ports,'produkcijski Node in baza nimata javnih vrat');
    preveri(config.services.baza.volumes.some(v=>v.target==='/var/lib/mysql' && v.type==='volume'),'produkcijska baza ima trajni volumen');
    const razvoj=JSON.parse(docker('compose','--env-file','.env.example','config','--format','json'));
    preveri(razvoj.services.baza.volumes.some(v=>v.target==='/var/lib/mysql' && v.source==='baza_podatki'),'razvojni volumen ima ohranjeno ime');
    if(process.argv.includes('--config'))return;
    const prijava=await fetch('http://127.0.0.1:13000/login',{method:'POST',body:new URLSearchParams({username:'admin',password:'Geslo123!'}),redirect:'manual'});
    const cookie=prijava.headers.getSetCookie()[0].split(';')[0];
    const sql="SELECT COUNT(*) AS seje FROM Http_seje";
    const seje=test('exec','-T','baza','mariadb','--user=test','--password=lokalni-preizkus-baze','sola_is','--batch','--skip-column-names','-e',sql);
    preveri(Number(seje.trim())>0,'seje so zapisane v MariaDB');
    test('restart','aplikacija');
    let odgovor;
    for(let i=0;i<40;i++){
        try{odgovor=await fetch('http://127.0.0.1:13000/api/uporabnik',{headers:{cookie}});if(odgovor.ok)break;}catch{}
        await new Promise(r=>setTimeout(r,250));
    }
    preveri(odgovor?.status===200,'seja preživi restart aplikacije');
    const struktura=produkcija('exec','-T','baza','mariadb','--user=test','--password=lokalni-preizkus-baze','sola_is','--batch','--skip-column-names','-e','SELECT (SELECT COUNT(*) FROM Uporabnik),(SELECT COUNT(*) FROM Nastavitve_sistema),(SELECT COUNT(*) FROM Solsko_leto)');
    preveri(struktura.trim()==='0\t1\t1','produkcijska inicializacija nima razvojnih računov in ima osnovne nastavitve');
    preveri(produkcija('exec','-T','nginx','nginx','-t')!==undefined,'Nginx konfiguracija je veljavna');
    const health=await fetch('http://127.0.0.1:18081/api/health');
    preveri(health.ok && (await health.json()).baza==='povezana','Nginx doseže Node, Node doseže MariaDB');
    preveri(health.headers.get('x-content-type-options')==='nosniff','varnostne glave prek Nginxa');
    for(const ime of ['backup.sh','restore.sh']){
        execFileSync('docker',['compose','-p','rps-produk-test','-f','aplikacija/test/compose.prod.yml','exec','-T','nginx','sh','-n'],{cwd:koren,input:fs.readFileSync(path.join(koren,'skripte',ime)),windowsHide:true,stdio:['pipe','pipe','pipe']});
        preveri(true,'sintaksa '+ime);
    }
    await new Promise((razresi,zavrni)=>{
        const proces=spawn('docker',['compose','-p','rps-produk-test','-f','.test-okolje/prod.yml','exec','-T','aplikacija','node','skripte/dodaj-admin.js'],{cwd:koren,windowsHide:true});
        let izhod='';let korak=0;
        proces.stdout.on('data',p=>{
            izhod+=p.toString();
            if(korak===0 && izhod.includes('Uporabniško ime:')){korak++;proces.stdin.write('test-admin\n');}
            else if(korak===1 && izhod.includes('E-naslov:')){korak++;proces.stdin.write('test-admin@example.org\n');}
            else if(korak===2 && izhod.includes('vnos je skrit')){korak++;proces.stdin.write('PreizkusDolgoGeslo123!\n');}
        });
        proces.once('error',zavrni);proces.once('exit',koda=>koda===0 && izhod.includes('Administrator je ustvarjen.') ? razresi() : zavrni(Error('Ustvarjanje prvega admina ni uspelo.')));
        setTimeout(()=>{proces.kill();zavrni(Error('Časovna omejitev prvega admina.'));},10000).unref();
    });
    preveri(true,'interaktivna skripta ustvari prvega administratorja');
    const preverjanje=`(async()=>{const r=await fetch('http://127.0.0.1:3000/login',{method:'POST',headers:{'x-forwarded-proto':'https',host:'sola.example.org'},body:new URLSearchParams({username:'test-admin',password:'PreizkusDolgoGeslo123!'}),redirect:'manual'});const c=r.headers.get('set-cookie')||'';console.log(JSON.stringify({status:r.status,varno:c.includes('Secure')&&c.includes('HttpOnly')&&c.includes('SameSite=Lax')}));})().catch(()=>process.exit(1))`;
    const varnost=JSON.parse(produkcija('exec','-T','aplikacija','node','-e',preverjanje));
    preveri(varnost.status===302 && varnost.varno,'produkcijski cookie prek HTTPS proxyja je Secure, HttpOnly in SameSite=Lax');
    const http=await fetch('http://127.0.0.1:18081/login',{method:'POST',headers:{'x-forwarded-proto':'https'},body:new URLSearchParams({username:'test-admin',password:'PreizkusDolgoGeslo123!'}),redirect:'manual'});
    preveri(http.status===302 && !http.headers.get('set-cookie'),'Nginx zavrne ponarejeno HTTPS glavo na HTTP povezavi');
    produkcija('exec','-T','baza','mariadb','--user=test','--password=lokalni-preizkus-baze','sola_is','-e',"DELETE FROM Uporabnik WHERE uporabnisko_ime='test-admin'");
    console.log('Uspešno: '+preizkusi+' preverjanj Dockerja.');
}
zagon().catch(n=>{console.error(n.message);process.exitCode=1;});
