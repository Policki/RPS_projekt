const assert=require('node:assert/strict');
const baza=process.env.TEST_URL || 'http://127.0.0.1:13000';
let preizkusi=0;
function preveri(pogoj,opis){assert.ok(pogoj,opis);preizkusi++;console.log('OK '+opis);}
async function klic(seja,pot,metoda='GET',podatki,csrf=true){
    const headers={};if(seja?.piskotek)headers.cookie=seja.piskotek;
    if(csrf && seja?.csrf)headers['x-csrf-token']=seja.csrf;
    let body;
    if(podatki instanceof FormData)body=podatki;
    else if(podatki!==undefined){headers['content-type']='application/json';body=JSON.stringify(podatki);}
    const odgovor=await fetch(baza+pot,{method:metoda,headers,body,redirect:'manual',signal:AbortSignal.timeout(20000)});
    const vsebina=await odgovor.text();let json;try{json=JSON.parse(vsebina);}catch{}
    return {status:odgovor.status,json,vsebina,headers:odgovor.headers};
}
async function prijavi(username,password='Geslo123!'){
    const odgovor=await fetch(baza+'/login',{method:'POST',body:new URLSearchParams({username,password}),redirect:'manual'});
    preveri(odgovor.status===302,'prijava '+username);
    const seja={piskotek:odgovor.headers.getSetCookie()[0].split(';')[0]};
    const profil=await klic(seja,'/api/uporabnik');seja.csrf=profil.json.csrf;
    preveri(!JSON.stringify(profil.json).includes('geslo_hash'),'profil ne razkrije gesla '+username);
    return seja;
}
async function zagon(){
    preveri((await klic(null,'/api/health')).status===200,'health in baza');
    preveri((await klic(null,'/api/admin/uporabniki')).status===401,'API zahteva prijavo');
    const napacna=await fetch(baza+'/login',{method:'POST',body:new URLSearchParams({username:'admin',password:'NapacnoGeslo'}),redirect:'manual'});
    preveri(napacna.status===401,'napačno geslo zavrnjeno');
    const dijak=await prijavi('dijak001');const profesor=await prijavi('profesor01');const admin=await prijavi('admin');
    preveri((await klic(dijak,'/api/profesor/predmeti')).status===403,'dijak nima profesorjevih API-jev');
    preveri((await klic(profesor,'/api/admin/uporabniki')).status===403,'profesor nima admin API-jev');
    preveri((await klic(dijak,'/admin/admin-dashboard.html')).status===403,'zaščiten je tudi HTML');
    preveri((await klic(profesor,'/api/profesor/izvedbe/2/dijaki')).status===403,'tuj razred je zavrnjen');
    preveri((await klic(profesor,'/api/profesor/izvedbe/1/dijaki')).json.length===20,'dijaki lastne izvedbe');
    preveri((await klic(dijak,'/api/moji-predmeti')).json.length===10,'dijakovi obstoječi predmeti');
    for(const pot of ['/api/profesor/dashboard','/api/profesor/predmeti','/api/profesor/gradiva','/api/profesor/naloge'])preveri((await klic(profesor,pot)).status===200,pot);
    for(const pot of ['/api/admin/dashboard','/api/admin/uporabniki','/api/admin/sifranti','/api/admin/nastavitve','/api/admin/izvoz'])preveri((await klic(admin,pot)).status===200,pot);
    preveri((await klic(admin,'/api/admin/statistika')).status===404,'API statistike je odstranjen');
    preveri((await klic(admin,'/admin/admin-statistika.html')).status===404,'stran statistike je odstranjena');
    preveri((await klic(admin,'/api/admin/uporabniki','POST',{},false)).status===403,'CSRF zahteva veljaven žeton');
    preveri((await klic(profesor,'/profesor/api.php')).status===404,'PHP izvorna koda ni javna');
    preveri((await klic(null,'/profesor/api.p%68p')).status===404,'kodirana PHP pot ni javna');
    preveri((await klic(null,'/%70rofil.html')).status===302,'kodirana pot skupnega profila zahteva prijavo');
    for(const [seja,pot]of [[dijak,'/ucenec/profil.html'],[profesor,'/profesor/profesor-profil.html'],[admin,'/admin/admin-profil.html']]){
        const r=await klic(seja,pot);preveri(r.status===302 && r.headers.get('location')==='/profil','stara povezava vodi na skupni profil '+pot);
    }
    preveri((await klic(profesor,'/api/profil','PATCH',{telefon:'041 123 456'})).status===200,'shrani telefon');
    preveri((await klic(profesor,'/api/uporabnik')).json.uporabnik.telefon==='041 123 456','telefon je v bazi');
    preveri((await klic(profesor,'/api/profil','PATCH',{telefon:'<script>'})).status===400,'neveljaven telefon zavrnjen');
    preveri((await klic(profesor,'/api/nastavitve','PATCH',{opomnik_rok:false})).status===200,'shrani obvestila');
    preveri((await klic(profesor,'/api/nastavitve')).json.opomnik_rok===false,'obvestila so v bazi');
    const dogodek=await klic(profesor,'/api/dogodki','POST',{naslov:'Preizkus dogodka',datum:'2026-11-05'});
    preveri(dogodek.status===201,'dodaj dogodek');
    preveri((await klic(admin,'/api/dogodki/'+dogodek.json.id,'DELETE')).status===404,'tuj dogodek je zaščiten');
    preveri((await klic(profesor,'/api/dogodki/'+dogodek.json.id,'DELETE')).status===200,'izbriši lastni dogodek');
    const podatki={uporabnisko_ime:'preizkus01',ime:'Testni',priimek:'Uporabnik',email:'testni@example.org',vloga:'profesor',status:'aktiven',geslo:'PreizkusGeslo123!'};
    const ustvarjen=await klic(admin,'/api/admin/uporabniki','POST',podatki);preveri(ustvarjen.status===201,'admin ustvari uporabnika in profil');
    podatki.ime='Spremenjeni';preveri((await klic(admin,'/api/admin/uporabniki/'+ustvarjen.json.id,'PUT',podatki)).status===200,'admin uredi uporabnika');
    const prva=await prijavi(podatki.uporabnisko_ime,podatki.geslo);
    const druga=await prijavi(podatki.uporabnisko_ime,podatki.geslo);
    preveri((await klic(prva,'/api/geslo','POST',{staro:'Napacno',novo:'NovoPreizkusGeslo123!'})).status===400,'menjava gesla zahteva staro geslo');
    preveri((await klic(prva,'/api/geslo','POST',{staro:podatki.geslo,novo:'NovoPreizkusGeslo123!'})).status===200,'menjava gesla deluje');
    preveri((await klic(druga,'/api/uporabnik')).status===401,'menjava gesla prekliče tudi druge seje');
    await prijavi(podatki.uporabnisko_ime,'NovoPreizkusGeslo123!');
    preveri((await klic(admin,'/api/admin/uporabniki/'+ustvarjen.json.id,'DELETE')).status===200,'admin izbriše nepovezan račun');
    preveri((await klic(admin,'/api/admin/uporabniki/1','DELETE')).status===409,'povezan račun se ne izbriše');
    const sifranti=(await klic(admin,'/api/admin/sifranti')).json;
    const razred=await klic(admin,'/api/admin/sifranti/razredi','POST',{id_program:1,id_solsko_leto:1,letnik:1,oznaka:'TEST',id_razrednik:1});
    preveri(razred.status===201,'ustvari razred');
    const noviRazred=(await klic(admin,'/api/admin/sifranti')).json.razredi.find(r=>r.oznaka==='TEST');
    preveri((await klic(admin,'/api/admin/sifranti/izvedbe','POST',{id_predmet:1,id_razred:noviRazred.id_razred,aktivna:true})).status===201,'ustvari izvedbo');
    const novaIzvedba=(await klic(admin,'/api/admin/sifranti')).json.izvedbe.find(i=>i.id_razred===noviRazred.id_razred);
    preveri((await klic(admin,'/api/admin/sifranti/profesorji','POST',{id_profesor:1,id_izvedba:novaIzvedba.id_izvedba,aktivna:true})).status===201,'dodeli profesorja izvedbi');
    preveri((await klic(admin,'/api/admin/sifranti/dijaki','POST',{id_dijak:1,id_izvedba:novaIzvedba.id_izvedba,status:'aktiven'})).status===400,'dijak mora pripadati razredu izvedbe');
    preveri((await klic(admin,'/api/admin/sifranti/profesorji/1~'+novaIzvedba.id_izvedba,'PUT',{id_profesor:1,id_izvedba:novaIzvedba.id_izvedba,aktivna:false})).status===200,'onemogoči dodelitev profesorja');
    preveri((await klic(admin,'/api/admin/sifranti/profesorji/1~'+novaIzvedba.id_izvedba,'DELETE')).status===200,'odstrani nepovezano dodelitev');
    preveri((await klic(admin,'/api/admin/sifranti/izvedbe/'+novaIzvedba.id_izvedba,'DELETE')).status===200,'odstrani nepovezano izvedbo');
    preveri((await klic(admin,'/api/admin/sifranti/razredi/'+noviRazred.id_razred,'DELETE')).status===200,'odstrani nepovezan razred');
    for(const [vir,p]of [['predmeti',{sifra:'TEST',naziv:'Preizkus predmeta',opis:'',barva:'#123456',aktiven:true}],['programi',{oznaka:'TEST',naziv:'Preizkus programa',aktiven:true}],['leta',{zacetno_leto:2099,datum_zacetka:'2099-09-01',datum_konca:'2100-08-31',status:'odprto'}]]){
        const r=await klic(admin,'/api/admin/sifranti/'+vir,'POST',p);preveri(r.status===201,'ustvari '+vir);
        const novi=(await klic(admin,'/api/admin/sifranti')).json[vir];const zadnji=novi.at(-1);const kljuc=Object.keys(zadnji)[0];
        preveri((await klic(admin,'/api/admin/sifranti/'+vir+'/'+zadnji[kljuc],'PUT',p)).status===200,'uredi '+vir);
        preveri((await klic(admin,'/api/admin/sifranti/'+vir+'/'+zadnji[kljuc],'DELETE')).status===200,'izbriši '+vir);
    }
    const obrazec=new FormData();obrazec.append('datoteka',new Blob(['%PDF-1.4\nPreizkus\n%%EOF'],{type:'application/pdf'}),'preizkus.pdf');
    const gradivo=await klic(profesor,'/api/profesor/izvedbe/1/gradiva','POST',obrazec);preveri(gradivo.status===201,'naloži gradivo');
    const seznam=(await klic(profesor,'/api/profesor/gradiva')).json;const datoteka=seznam.find(g=>g.id===gradivo.json.id);
    preveri((await klic(dijak,'/api/datoteke/'+datoteka.id_datoteka)).status===200,'dijak svoje izvedbe prenese gradivo');
    const drugDijak=await prijavi('dijak041');preveri((await klic(drugDijak,'/api/datoteke/'+datoteka.id_datoteka)).status===403,'tuj dijak ne prenese gradiva');
    preveri((await klic(profesor,'/api/profesor/gradiva/'+gradivo.json.id,'DELETE')).status===200,'profesor umakne gradivo');
    preveri((await klic(dijak,'/api/datoteke/'+datoteka.id_datoteka)).status===403,'umaknjeno gradivo ni dostopno');
    preveri((await klic(profesor,'/api/profesor/izvedbe/2/gradiva','POST',{naslov:'Test',url:'https://example.org'})).status===403,'nalaganje v tujo izvedbo zavrnjeno');
    preveri((await klic(profesor,'/api/profesor/izvedbe/1/gradiva','POST',{naslov:'Test',url:'javascript:alert(1)'})).status===400,'nevarna povezava zavrnjena');
    const rok=new Date(Date.now()+86400000).toISOString();
    const ustvarjenaNaloga=await klic(profesor,'/api/profesor/izvedbe/1/naloge','POST',{naslov:'Preizkus naloge',opis:'Navodila za test',rok_oddaje:rok,max_tock:10});
    preveri(ustvarjenaNaloga.status===201,'ustvari nalogo');
    const mojeNaloge=await klic(dijak,'/api/ucenec/naloge');
    preveri(mojeNaloge.status===200,'dijak dobi dejanske naloge');
    const naloga=mojeNaloge.json.find(n=>n.id_naloga===ustvarjenaNaloga.json.id);
    preveri(naloga && mojeNaloge.json.every(n=>n.id_izvedba<=10),'dijak vidi samo naloge svojih izvedb');
    preveri((await klic(profesor,'/api/ucenec/naloge')).status===403,'profesor ne uporablja dijakovih oddaj');
    async function oddaj(seja,id,vsebina,ime,verzija=0){
        const obrazec=new FormData();obrazec.append('datoteka',new Blob([vsebina]),ime);obrazec.append('verzija',verzija);obrazec.append('komentar','Oddaja iz preizkusa');
        return klic(seja,'/api/ucenec/naloge/'+id+'/oddaja','POST',obrazec);
    }
    preveri((await oddaj(drugDijak,naloga.id_naloga,'SELECT 1;','tuja.sql')).status===403,'dijak ne odda datoteke v tujo izvedbo');
    preveri((await oddaj(dijak,naloga.id_naloga,'program','nedovoljeno.exe')).status===400,'nevaren format je zavrnjen');
    preveri((await oddaj(dijak,naloga.id_naloga,'ni PDF','ponarejena.pdf')).status===400,'ponarejena vrsta je zavrnjena');
    preveri((await oddaj(dijak,naloga.id_naloga,'','prazna.sql')).status===400,'prazna datoteka je zavrnjena');
    preveri((await oddaj(dijak,naloga.id_naloga,new Uint8Array(10*1048576+1),'prevelika.txt')).status===400,'prevelika oddaja je zavrnjena');
    const prvaOddaja=await oddaj(dijak,naloga.id_naloga,'SELECT 1;','prva.sql');
    preveri(prvaOddaja.status===201 && prvaOddaja.json.verzija===1,'datoteka se naloži kot prva oddaja');
    const nalogaPoOddaji=(await klic(dijak,'/api/ucenec/naloge')).json.find(n=>n.id_naloga===naloga.id_naloga);
    preveri(nalogaPoOddaji.datoteka_na_voljo && nalogaPoOddaji.izvorno_ime==='prva.sql','oddaja je vidna po ponovnem branju baze');
    preveri((await klic(dijak,'/api/datoteke/'+nalogaPoOddaji.id_datoteka)).vsebina==='SELECT 1;','dijak prenese svojo oddajo');
    preveri((await klic(profesor,'/api/datoteke/'+nalogaPoOddaji.id_datoteka)).status===200,'profesor prenese dejansko oddajo');
    preveri((await klic(drugDijak,'/api/datoteke/'+nalogaPoOddaji.id_datoteka)).status===403,'drug dijak ne prenese oddaje');
    preveri((await klic(profesor,'/api/profesor/oddaje/'+prvaOddaja.json.id+'/ocena','PUT',{tocke:9,ocena:5,verzija:1})).status===200,'profesor oceni naloženo oddajo');
    const ponovljena=await oddaj(dijak,naloga.id_naloga,'SELECT 2;','druga.sql',1);
    preveri(ponovljena.status===200 && ponovljena.json.verzija===2,'nova datoteka poveča različico oddaje');
    const zadnja=(await klic(dijak,'/api/ucenec/naloge')).json.find(n=>n.id_naloga===naloga.id_naloga);
    preveri(zadnja.ocena===null && zadnja.izvorno_ime==='druga.sql','nova oddaja potrebuje novo oceno');
    preveri((await oddaj(dijak,naloga.id_naloga,'SELECT 3;','zastarela.sql',1)).status===409,'zastarela oddaja ne prepiše novejše');
    const gradivaDijaka=await klic(dijak,'/api/ucenec/gradiva');
    preveri(gradivaDijaka.status===200 && gradivaDijaka.json.every(g=>g.id_izvedba<=10),'dijak dobi samo gradiva svojih izvedb');
    const kratekRok=new Date(Date.now()+2000).toISOString();
    const zaprta=await klic(profesor,'/api/profesor/izvedbe/1/naloge','POST',{naslov:'Kratek rok brez zamude',opis:'Preizkus roka.',rok_oddaje:kratekRok,dovoljena_pozna_oddaja:false});
    const pozna=await klic(profesor,'/api/profesor/izvedbe/1/naloge','POST',{naslov:'Kratek rok z zamudo',opis:'Preizkus pozne oddaje.',rok_oddaje:kratekRok,dovoljena_pozna_oddaja:true});
    preveri(zaprta.status===201 && pozna.status===201,'nalogi za preverjanje roka sta ustvarjeni');
    await new Promise(razresi=>setTimeout(razresi,2500));
    preveri((await oddaj(dijak,zaprta.json.id,'SELECT 5;','prepozno.sql')).status===400,'po roku je oddaja zavrnjena');
    preveri((await oddaj(dijak,pozna.json.id,'SELECT 6;','dovoljena-zamuda.sql')).status===201,'dovoljena pozna oddaja se shrani');
    const ocenjevalec=await prijavi('profesor07');
    preveri((await klic(profesor,'/api/profesor/naloge/5/oddaje')).status===403,'tuje oddaje zavrnjene');
    preveri((await klic(ocenjevalec,'/api/profesor/naloge/5/oddaje')).status===200,'lastne oddaje dosegljive');
    preveri((await klic(ocenjevalec,'/api/profesor/oddaje/1/ocena','PUT',{tocke:999,verzija:1})).status===400,'točke čez maksimum zavrnjene');
    preveri((await klic(ocenjevalec,'/api/profesor/oddaje/1/ocena','PUT',{tocke:9,ocena:5,komentar:'Preizkus',verzija:2})).status===409,'stara verzija oddaje zavrnjena');
    preveri((await klic(ocenjevalec,'/api/profesor/oddaje/1/ocena','PUT',{tocke:9,ocena:5,komentar:'Preizkus',verzija:1})).status===200,'ocenjevanje shranjeno');
    const kopija=await klic(admin,'/api/admin/kopije','POST');preveri(kopija.status===201,'resnični SQL dump');
    preveri((await klic(admin,'/api/admin/nastavitve')).json.kopije.stevilo>0,'kopija obstaja na disku');
    const onemogoci=sifranti.osebe_profesorji[1];
    const u=(await klic(admin,'/api/admin/uporabniki')).json.find(u=>u.uporabnisko_ime==='profesor02');
    const seja=await prijavi('profesor02');
    preveri((await klic(admin,'/api/admin/uporabniki/'+u.id_uporabnik,'PUT',{...u,status:'onemogocen'})).status===200,'onemogoči uporabnika');
    preveri((await klic(seja,'/api/profesor/predmeti')).status===401,'obstoječa seja onemogočenega računa ne deluje');
    await klic(admin,'/api/admin/uporabniki/'+u.id_uporabnik,'PUT',u);
    const leto=sifranti.leta.find(l=>l.id_solsko_leto===1);
    preveri((await klic(admin,'/api/admin/arhiv','POST',{id_solsko_leto:1})).status===200,'arhiviranje ohrani leto');
    preveri((await klic(profesor,'/api/profesor/izvedbe/1/naloge','POST',{naslov:'Preizkus',opis:'Preizkus',rok_oddaje:rok})).status===403,'pisanje v arhivirano leto zavrnjeno');
    preveri((await oddaj(dijak,naloga.id_naloga,'SELECT 4;','arhiv.sql',2)).status===403,'oddajanje v arhivirano leto je zavrnjeno');
    await klic(admin,'/api/admin/sifranti/leta/1','PUT',leto);
    console.log('Uspešno: '+preizkusi+' preverjanj.');
}
zagon().catch(napaka=>{console.error(napaka);process.exitCode=1;});
