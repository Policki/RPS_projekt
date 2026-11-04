const fs=require('fs');
const os=require('os');
const path=require('path');
const assert=require('assert/strict');
const {spawn}=require('child_process');
const naslov=process.env.TEST_URL || 'http://127.0.0.1:13000';
const chrome=process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const zacasna=fs.mkdtempSync(path.join(os.tmpdir(),'rps-brskalnik-'));
const brskalnik=spawn(chrome,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-pipe','--user-data-dir='+zacasna],{stdio:['ignore','ignore','pipe','pipe','pipe'],windowsHide:true});
brskalnik.stderr.on('data',()=>{});
let stevec=0;let medpomnilnik='';let preverjanja=0;
const zahteve=new Map();const izjeme=[];
brskalnik.stdio[4].on('data',vsebina=>{
    medpomnilnik+=vsebina.toString();let meja;
    while((meja=medpomnilnik.indexOf('\0'))!==-1){
        const zapis=medpomnilnik.slice(0,meja);medpomnilnik=medpomnilnik.slice(meja+1);if(!zapis)continue;
        const p=JSON.parse(zapis);
        if(p.method==='Runtime.exceptionThrown')izjeme.push(p.params.exceptionDetails.exception?.description || p.params.exceptionDetails.text);
        if(zahteve.has(p.id)){const obljuba=zahteve.get(p.id);zahteve.delete(p.id);p.error ? obljuba.zavrni(Error(JSON.stringify(p.error))) : obljuba.razresi(p.result);}
    }
});
function ukaz(method,params={},sessionId){return new Promise((razresi,zavrni)=>{const id=++stevec;zahteve.set(id,{razresi,zavrni});brskalnik.stdio[3].write(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})})+'\0');});}
function preveri(pogoj,opis){assert.ok(pogoj,opis);preverjanja++;console.log('OK '+opis);}
const casovnik=setTimeout(()=>{console.error('Preizkus je presegel čas.');brskalnik.kill();process.exit(1);},180000);
async function zagon(){
    const {targetId}=await ukaz('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await ukaz('Target.attachToTarget',{targetId,flatten:true});
    await ukaz('Page.enable',{},sessionId);await ukaz('Runtime.enable',{},sessionId);await ukaz('Network.enable',{},sessionId);
    await ukaz('Page.addScriptToEvaluateOnNewDocument',{source:`window.preizkusNapake=[];window.preizkusZahteve=0;window.confirm=()=>true;window.addEventListener('error',d=>{if(d.message)window.preizkusNapake.push(d.message)});window.addEventListener('unhandledrejection',d=>window.preizkusNapake.push(String(d.reason)));const prvotni=window.fetch;window.fetch=async(...p)=>{window.preizkusZahteve++;try{return await prvotni(...p)}finally{window.preizkusZahteve--}};`},sessionId);
    const vrednost=async izraz=>{const r=await ukaz('Runtime.evaluate',{expression:izraz,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    const mereProfesorja={};
    let trenutnaVloga;
    let nalogaZaOddajo;
    async function mereNavigacije(){return vrednost(`({ozadje:getComputedStyle(document.querySelector('nav.sidebar')).backgroundColor,polozaj:getComputedStyle(document.querySelector('nav.sidebar')).position,nav:(()=>{const r=document.querySelector('nav.sidebar').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})(),ikone:[...document.querySelectorAll('nav .icon')].map(p=>{const r=p.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100)})})`);}
    async function pocakaj(){
        for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,100));if(await vrednost('document.readyState==="complete" && window.preizkusZahteve===0')){await new Promise(r=>setTimeout(r,150));return;}}
        throw Error('Stran se ni naložila.');
    }
    async function odpri(pot,sirina=1440,visina=900){
        await ukaz('Emulation.setDeviceMetricsOverride',{width:sirina,height:visina,deviceScaleFactor:1,mobile:false},sessionId);
        await ukaz('Page.navigate',{url:naslov+pot},sessionId);await pocakaj();
        const stanje=await vrednost(`({napake:window.preizkusNapake,sporocilo:document.getElementById('api-sporocilo')?.textContent,aktivne:document.querySelectorAll('nav [aria-current="page"]').length,profil:[...document.querySelectorAll('nav a')].filter(a=>a.href.endsWith('/profil')).length})`);
        preveri(stanje.napake?.length===0 && !stanje.sporocilo,pot+' brez JS/API napak '+JSON.stringify(stanje));
        preveri(stanje.aktivne===1,pot+' ena aktivna navigacijska ikona');
        preveri(stanje.profil===1,pot+' skupni profil');
        if(trenutnaVloga==='profesor01'){
            const mere=await mereNavigacije();
            const kljuc=sirina+'x'+visina;
            preveri(mere.polozaj==='fixed' && mere.nav[0]===0 && mere.nav[1]===0 && mere.nav[2]===70 && mere.nav[3]===visina,'stalna navigacija '+pot+' '+kljuc);
            if(mereProfesorja[kljuc])assert.deepEqual(mere,mereProfesorja[kljuc],'Mere navigacije se spremenijo pri '+pot);
            else mereProfesorja[kljuc]=mere;
        }
    }
    const ikone={};
    for(const [uporabnik,poti]of [
        ['profesor01',['/profesor-dashboard','/profesor/profesor-predmeti.html','/profesor/profesor-gradiva.html','/profesor/profesor-naloge.html','/profesor/profesor-koledar.html','/profesor/profesor-nastavitve.html','/profil']],
        ['admin',['/admin-dashboard','/admin/admin_uporabniki.html','/admin/admin-predmeti.html','/admin/admin-koledar.html','/admin/admin-nastavitve.html','/profil']],
        ['dijak001',['/ucenec-dasboard','/ucenec/ucenec-predmeti.html','/ucenec/ucenec-naloge.html','/ucenec/ucenec-gradiva.html','/ucenec/usenec-koledar.html','/profil']]
    ]){
        trenutnaVloga=uporabnik;
        const prijava=await fetch(naslov+'/login',{method:'POST',body:new URLSearchParams({username:uporabnik,password:'Geslo123!'}),redirect:'manual'});
        assert.equal(prijava.status,302);const piskotek=prijava.headers.getSetCookie()[0].split(';')[0];const meja=piskotek.indexOf('=');
        await ukaz('Network.setCookie',{name:piskotek.slice(0,meja),value:piskotek.slice(meja+1),url:naslov,httpOnly:true,sameSite:'Lax'},sessionId);
        for(const pot of poti)await odpri(pot);
        if(uporabnik==='profesor01'){
            await odpri('/profesor/profesor-predmeti.html');
            await vrednost(`document.querySelector('#predmeti-seznam [tabindex]').click()`);await pocakaj();
            preveri(await vrednost(`document.querySelector('dialog[open]').textContent.includes('aktiven')`),'kartica odpre dejanski seznam dijakov');
            await vrednost(`document.querySelector('dialog[open]').close()`);
            await vrednost('window.scrollTo(0,document.documentElement.scrollHeight)');
            preveri((await mereNavigacije()).nav[1]===0,'navigacija ostane na mestu ob drsenju');
            await vrednost('window.scrollTo(0,0)');
            const slika=await ukaz('Page.captureScreenshot',{format:'png'},sessionId);fs.mkdirSync(path.join(korenSlike()),{recursive:true});fs.writeFileSync(path.join(korenSlike(),'profesor-predmeti.png'),Buffer.from(slika.data,'base64'));
            await odpri('/profesor/profesor-naloge.html');
            await vrednost(`[...document.querySelectorAll('button')].find(g=>g.textContent==='Nova naloga').click()`);await pocakaj();
            await vrednost(`(()=>{const f=document.querySelector('dialog form');f.elements.naslov.value='Naloga iz brskalnika';f.elements.opis.value='Preizkus obrazca';const d=new Date(Date.now()+86400000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());f.elements.rok_oddaje.value=d.toISOString().slice(0,16);f.requestSubmit();})()`);await pocakaj();
            preveri(await vrednost(`!document.querySelector('dialog[open]') && document.getElementById('naloge-seznam').textContent.includes('Naloga iz brskalnika')`),'obrazec za novo nalogo shrani v bazo');
            const identiteta=await(await fetch(naslov+'/api/uporabnik',{headers:{cookie:piskotek}})).json();
            const odgovor=await fetch(naslov+'/api/profesor/izvedbe/1/naloge',{method:'POST',headers:{cookie:piskotek,'x-csrf-token':identiteta.csrf,'content-type':'application/json'},body:JSON.stringify({naslov:'Oddaja datoteke iz brskalnika',opis:'Priloži datoteko SQL.',rok_oddaje:new Date(Date.now()+86400000).toISOString(),max_tock:10})});
            assert.equal(odgovor.status,201);nalogaZaOddajo=(await odgovor.json()).id;
            const gradivo=new FormData();gradivo.append('datoteka',new Blob(['%PDF-1.4\nGradivo iz brskalnika\n%%EOF']),'gradivo-iz-brskalnika.pdf');
            const nalozeno=await fetch(naslov+'/api/profesor/izvedbe/1/gradiva',{method:'POST',headers:{cookie:piskotek,'x-csrf-token':identiteta.csrf},body:gradivo});assert.equal(nalozeno.status,201);
            for(const [sirina,visina]of [[390,600],[1440,500]])for(const pot of poti)await odpri(pot,sirina,visina);
            await odpri('/profil');
        }
        if(uporabnik==='admin'){
            preveri(await vrednost(`![...document.querySelectorAll('nav a')].some(a=>a.href.includes('statistika'))`),'administratorski meni nima statistike');
            await odpri('/admin/admin_uporabniki.html');
            await vrednost(`document.querySelector('.page-header .btn-primary').click();const f=document.querySelector('dialog form');f.elements.uporabnisko_ime.value='brskalnik01';f.elements.ime.value='Testni';f.elements.priimek.value='Brskalnik';f.elements.email.value='brskalnik@example.org';f.elements.vloga.value='profesor';f.elements.geslo.value='PreizkusBrskalnik123!';f.requestSubmit()`);await pocakaj();
            await vrednost(`document.getElementById('search').value='brskalnik01';document.getElementById('search').dispatchEvent(new Event('input'))`);
            preveri(await vrednost(`!document.querySelector('dialog[open]') && document.getElementById('rows').textContent.includes('Testni Brskalnik')`),'admin obrazec ustvari uporabnika');
            await vrednost(`document.querySelector('#rows button').click();[...document.querySelectorAll('dialog button')].find(g=>g.textContent.startsWith('Izbriši')).click()`);await pocakaj();
            preveri(await vrednost(`document.getElementById('rows').textContent.includes('Ni najdenih uporabnikov')`),'admin obrazec izbriše račun');
            await odpri('/admin/admin-predmeti.html');
            const slika=await ukaz('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.join(korenSlike(),'admin-predmeti.png'),Buffer.from(slika.data,'base64'));
            await vrednost(`document.querySelector('.page-header .actions button').click();[...document.querySelectorAll('dialog button')].find(g=>g.textContent==='Dodaj zapis').click();const f=[...document.querySelectorAll('dialog form')].at(-1);f.elements.oznaka.value='BRSK';f.elements.naziv.value='Program iz brskalnika';f.requestSubmit()`);await pocakaj();
            preveri(await vrednost(`document.querySelector('dialog[open]').textContent.includes('Program iz brskalnika')`),'admin obrazec za program shrani v bazo');
            await vrednost(`[...document.querySelectorAll('dialog button')].find(g=>g.textContent==='Program iz brskalnika').click();[...document.querySelectorAll('dialog button')].find(g=>g.textContent.startsWith('Izbriši')).click()`);await pocakaj();
            preveri(await vrednost(`!document.querySelector('dialog[open]').textContent.includes('Program iz brskalnika')`),'admin obrazec odstrani nepovezan program');
            await odpri('/profil');
        }
        if(uporabnik==='dijak001'){
            await odpri('/ucenec/ucenec-naloge.html');
            await vrednost(`document.querySelector('.naloga[data-id="${nalogaZaOddajo}"] button').click()`);
            const potDatoteke=path.join(zacasna,'resitev.sql');fs.writeFileSync(potDatoteke,'SELECT 42;');
            await ukaz('DOM.enable',{},sessionId);
            const {root}=await ukaz('DOM.getDocument',{},sessionId);
            const {nodeId}=await ukaz('DOM.querySelector',{nodeId:root.nodeId,selector:'#oddaja-datoteka'},sessionId);
            await ukaz('DOM.setFileInputFiles',{nodeId,files:[potDatoteke]},sessionId);
            await vrednost(`document.getElementById('oddaja-obrazec').requestSubmit()`);await pocakaj();
            preveri(await vrednost(`!document.querySelector('dialog[open]') && document.querySelector('.naloga[data-id="${nalogaZaOddajo}"]').textContent.includes('Oddano')`),'dijak odda dejansko datoteko prek obrazca');
            await odpri('/ucenec/ucenec-naloge.html');
            await vrednost(`document.querySelector('.naloga[data-id="${nalogaZaOddajo}"] button').click()`);
            preveri(await vrednost(`document.getElementById('trenutna-oddaja').textContent.includes('resitev.sql')`),'oddaja ostane shranjena po osvežitvi');
            preveri(await vrednost(`fetch(document.querySelector('#trenutna-oddaja a').href).then(r=>r.text()).then(v=>v==='SELECT 42;')`),'oddano datoteko je mogoče prenesti');
            await odpri('/ucenec/ucenec-gradiva.html');
            preveri(await vrednost(`document.querySelectorAll('.gradivo a[href^="/api/datoteke/"]').length>0`),'gradivo ima dejansko povezavo za prenos');
            preveri(await vrednost(`fetch(document.querySelector('.gradivo a[href^="/api/datoteke/"]').href).then(r=>r.text()).then(v=>v.startsWith('%PDF-1.4'))`),'dijak prenese profesorjevo datoteko');
            await odpri('/ucenec/ucenec-naloge.html',390,600);
            preveri(await vrednost('document.documentElement.scrollWidth<=innerWidth+1'),'dijakove naloge brez vodoravnega drsenja');
            const slika=await ukaz('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.join(korenSlike(),'dijak-naloge-mobilno.png'),Buffer.from(slika.data,'base64'));
            await odpri('/profil');
        }
        if(uporabnik!=='dijak001'){
            await odpri(uporabnik==='admin' ? '/admin/admin-koledar.html' : '/profesor/profesor-koledar.html');
            await vrednost(`document.getElementById('event-title').value='Dogodek iz brskalnika';document.getElementById('event-form').requestSubmit()`);await pocakaj();
            preveri(await vrednost(`document.getElementById('event-list').textContent.includes('Dogodek iz brskalnika')`),'koledar shrani dogodek '+uporabnik);
            await vrednost(`document.querySelector('#event-list .remove-event').click()`);await pocakaj();
            preveri(await vrednost(`!document.getElementById('event-list').textContent.includes('Dogodek iz brskalnika')`),'koledar odstrani dogodek '+uporabnik);
            await odpri('/profil');
        }
        const nove=await vrednost(`Object.fromEntries([...document.querySelectorAll('nav a')].map(a=>[(a.getAttribute('title')||a.getAttribute('aria-label')||a.parentElement.title).toLowerCase(),a.querySelector('svg')?.innerHTML]))`);
        for(const [kljuc,svg]of Object.entries(nove)){if(ikone[kljuc])preveri(ikone[kljuc]===svg,'enotna ikona '+kljuc);ikone[kljuc]=svg;}
        await odpri('/profil',390);
        preveri(await vrednost('document.documentElement.scrollWidth<=innerWidth+1'),'profil brez vodoravnega drsenja '+uporabnik);
        if(uporabnik==='dijak001'){const slika=await ukaz('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.join(korenSlike(),'profil-mobilno.png'),Buffer.from(slika.data,'base64'));}
        await vrednost(`document.querySelector('[data-odpri-dialog]').click();document.getElementById('telefon-nov').value='041 555 111';document.getElementById('telefon-obrazec').requestSubmit()`);await pocakaj();
        preveri(await vrednost(`document.getElementById('profil-telefon').textContent==='041 555 111' && !document.getElementById('telefon-dialog').open`),'telefon prek skupnega profila '+uporabnik);
    }
    const adminPrijava=await fetch(naslov+'/login',{method:'POST',body:new URLSearchParams({username:'admin',password:'Geslo123!'}),redirect:'manual'});
    const adminCookie=adminPrijava.headers.getSetCookie()[0].split(';')[0];
    const identiteta=await (await fetch(naslov+'/api/uporabnik',{headers:{cookie:adminCookie}})).json();
    const glave={cookie:adminCookie,'x-csrf-token':identiteta.csrf,'content-type':'application/json'};
    const ustvarjen=await fetch(naslov+'/api/admin/uporabniki',{method:'POST',headers:glave,body:JSON.stringify({uporabnisko_ime:'demo-prazen',ime:'Testni',priimek:'Profesor',email:'prazen@example.org',vloga:'profesor',status:'aktiven',geslo:'PreizkusPrazen123!'})});
    assert.equal(ustvarjen.status,201);const nov=await ustvarjen.json();
    try{
        const prijava=await fetch(naslov+'/login',{method:'POST',body:new URLSearchParams({username:'demo-prazen',password:'PreizkusPrazen123!'}),redirect:'manual'});
        const cookie=prijava.headers.getSetCookie()[0].split(';')[0];const meja=cookie.indexOf('=');
        await ukaz('Network.setCookie',{name:cookie.slice(0,meja),value:cookie.slice(meja+1),url:naslov,httpOnly:true,sameSite:'Lax'},sessionId);
        for(const [pot,id,sporocilo]of [
            ['/profesor/profesor-predmeti.html','predmeti-seznam','Nimate dodeljenih predmetov.'],
            ['/profesor/profesor-gradiva.html','gradiva-seznam','Gradiv še ni.'],
            ['/profesor/profesor-naloge.html','naloge-seznam','Ni objavljenih nalog.']
        ]){await odpri(pot);preveri(await vrednost(`document.getElementById(${JSON.stringify(id)}).textContent.includes(${JSON.stringify(sporocilo)})`),'prazno stanje '+pot);}
        await ukaz('Network.setBlockedURLs',{urls:['*api/profesor/dashboard*']},sessionId);
        await ukaz('Page.navigate',{url:naslov+'/profesor-dashboard'},sessionId);await pocakaj();
        preveri(await vrednost(`Boolean(document.getElementById('api-sporocilo')?.textContent) && window.preizkusNapake.length===0`),'nedosegljiv API prikaže obvestilo brez izjeme');
        await ukaz('Network.setBlockedURLs',{urls:[]},sessionId);
    }finally{await fetch(naslov+'/api/admin/uporabniki/'+nov.id,{method:'DELETE',headers:glave});}
    preveri(izjeme.length===0,'brez izjem v brskalniku '+JSON.stringify(izjeme));
    console.log('Uspešno: '+preverjanja+' preverjanj brskalnika.');
}
function korenSlike(){return path.resolve(__dirname,'../../.test-okolje/slike');}
zagon().catch(n=>{console.error(n);process.exitCode=1;}).finally(()=>{clearTimeout(casovnik);brskalnik.kill();});
