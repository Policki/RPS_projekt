const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawn}=require('child_process');
const naslov=process.env.TEST_URL || process.argv.find(vrednost=>/^https?:\/\//.test(vrednost)) || 'http://localhost:3000';
const brskalnik=spawn(process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',[
    '--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-pipe',
    '--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'rps-prijava-'))
],{stdio:['ignore','ignore','pipe','pipe','pipe'],windowsHide:true});
brskalnik.stderr.resume();
let stevec=0;
let medpomnilnik='';
let izvor;
const zahteve=new Map();
brskalnik.stdio[4].on('data',podatki=>{
    medpomnilnik+=podatki.toString();
    let meja;
    while((meja=medpomnilnik.indexOf('\0'))!==-1){
        const zapis=medpomnilnik.slice(0,meja);medpomnilnik=medpomnilnik.slice(meja+1);
        if(!zapis)continue;
        const p=JSON.parse(zapis);
        if(p.method==='Network.requestWillBeSent' && p.params.request.method==='POST' && p.params.request.url.endsWith('/login'))izvor=p.params.request.headers.Origin;
        if(zahteve.has(p.id)){
            const obljuba=zahteve.get(p.id);zahteve.delete(p.id);
            p.error ? obljuba.zavrni(Error(JSON.stringify(p.error))) : obljuba.razresi(p.result);
        }
    }
});
function ukaz(method,params={},sessionId){
    return new Promise((razresi,zavrni)=>{
        const id=++stevec;zahteve.set(id,{razresi,zavrni});
        brskalnik.stdio[3].write(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})})+'\0');
    });
}
const casovnik=setTimeout(()=>{console.error('Prijava je presegla časovno omejitev.');brskalnik.kill();process.exit(1);},45000);
async function zagon(){
    const stran=await fetch(naslov+'/');
    if(!process.argv.includes('--pokazi'))assert.equal(stran.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
    const {targetId}=await ukaz('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await ukaz('Target.attachToTarget',{targetId,flatten:true});
    await ukaz('Page.enable',{},sessionId);await ukaz('Network.enable',{},sessionId);
    async function preberi(izraz){
        const r=await ukaz('Runtime.evaluate',{expression:izraz,returnByValue:true,awaitPromise:true},sessionId);
        if(r.exceptionDetails)throw Error(r.exceptionDetails.text);
        return r.result.value;
    }
    async function pocakaj(pogoj){
        for(let i=0;i<100;i++){
            try{if(await preberi('document.readyState==="complete" && ('+pogoj+')'))return;}catch{}
            await new Promise(r=>setTimeout(r,100));
        }
        throw Error('Stran se ni naložila.');
    }
    for(const [uporabnik,vloga,pot]of [['dijak001','dijak','/ucenec-dasboard'],['profesor01','profesor','/profesor-dashboard'],['admin','administrator','/admin-dashboard']]){
        await ukaz('Network.clearBrowserCookies',{},sessionId);
        await ukaz('Page.navigate',{url:naslov+'/'},sessionId);
        await pocakaj('Boolean(document.getElementById("username"))');
        await preberi(`document.getElementById('username').value=${JSON.stringify(uporabnik)};document.getElementById('password').value='Geslo123!';document.querySelector('form').requestSubmit()`);
        await pocakaj('location.pathname!=="/"');
        const stanje=await preberi('({pot:location.pathname,besedilo:document.body.innerText.slice(0,120)})');
        if(process.argv.includes('--pokazi')){console.log(JSON.stringify({uporabnik,izvor,...stanje}));continue;}
        assert.equal(stanje.pot,pot,uporabnik+' je zavrnjen: '+stanje.besedilo);
        const seja=await preberi(`fetch('/api/uporabnik').then(async r=>({status:r.status,podatki:await r.json()}))`);
        assert.equal(seja.status,200);assert.equal(seja.podatki.uporabnik.vloga,vloga);
        console.log('OK oddaja prijavnega obrazca, preusmeritev in seja: '+uporabnik+' ('+izvor+')');
    }
    if(process.argv.includes('--pokazi'))return;
    for(const izvor of ['https://tuja-stran.example','null']){
        const odgovor=await fetch(naslov+'/login',{method:'POST',headers:{origin:izvor},body:new URLSearchParams({username:'admin',password:'Geslo123!'}),redirect:'manual'});
        assert.equal(odgovor.status,403);
        console.log('OK zavrnjen nedovoljen izvor: '+izvor);
    }
    const napacna=await fetch(naslov+'/login',{method:'POST',headers:{origin:new URL(naslov).origin},body:new URLSearchParams({username:'admin',password:'NapacnoGeslo'}),redirect:'manual'});
    assert.equal(napacna.status,401);
    console.log('OK napačno geslo vrne 401, ne 403');
}
zagon().catch(napaka=>{console.error(napaka);process.exitCode=1;}).finally(()=>{clearTimeout(casovnik);brskalnik.kill();});
