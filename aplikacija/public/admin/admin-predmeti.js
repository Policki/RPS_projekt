let sifranti;
let filterPredmetov='vsi';
const imenaVirov={predmeti:'Predmeti',programi:'Programi',leta:'Šolska leta',razredi:'Razredi',izvedbe:'Izvedbe predmetov',profesorji:'Profesorji pri izvedbah',dijaki:'Dijaki pri izvedbah',vpisi:'Vpisi v razrede'};
const kljuciVirov={predmeti:['id_predmet'],programi:['id_program'],leta:['id_solsko_leto'],razredi:['id_razred'],izvedbe:['id_izvedba'],profesorji:['id_profesor','id_izvedba'],dijaki:['id_dijak','id_izvedba'],vpisi:['id_dijak','id_solsko_leto']};
function nazivRazreda(id) {
    const r=sifranti.razredi.find(r=>r.id_razred===Number(id));
    if(!r)return 'Ni razreda';
    const leto=sifranti.leta.find(l=>l.id_solsko_leto===r.id_solsko_leto);
    return r.letnik+'. '+r.oznaka+' · '+(leto ? leto.zacetno_leto+'/'+(leto.zacetno_leto+1) : '');
}
function nazivIzvedbe(id) {
    const i=sifranti.izvedbe.find(i=>i.id_izvedba===Number(id));
    return i ? (sifranti.predmeti.find(p=>p.id_predmet===i.id_predmet)?.naziv || '')+' · '+nazivRazreda(i.id_razred) : 'Ni izvedbe';
}
function oznakaZapisa(vir,zapis) {
    if(vir==='predmeti'||vir==='programi')return zapis.naziv;
    if(vir==='leta')return zapis.zacetno_leto+'/'+(zapis.zacetno_leto+1)+' · '+zapis.status;
    if(vir==='razredi')return nazivRazreda(zapis.id_razred);
    if(vir==='izvedbe')return nazivIzvedbe(zapis.id_izvedba)+' · '+(zapis.aktivna ? 'aktivna' : 'neaktivna');
    if(vir==='vpisi')return (sifranti.osebe_dijaki.find(d=>d.id_dijak===zapis.id_dijak)?.naziv || '')+' · '+nazivRazreda(zapis.id_razred);
    return (vir==='profesorji' ? sifranti.osebe_profesorji.find(p=>p.id_profesor===zapis.id_profesor)?.naziv : sifranti.osebe_dijaki.find(d=>d.id_dijak===zapis.id_dijak)?.naziv)+' · '+nazivIzvedbe(zapis.id_izvedba)+' · '+(vir==='profesorji' ? zapis.aktivna ? 'aktiven' : 'neaktiven' : zapis.status);
}
function poljaVira(vir,urejanje) {
    const moznosti=(vir,kljuc,naziv)=>sifranti[vir].map(p=>[p[kljuc],naziv(p)]);
    const aktivnost={ime:'aktiven',naziv:'Aktiven',tip:'checkbox'};
    const leto={ime:'id_solsko_leto',naziv:'Šolsko leto',moznosti:moznosti('leta','id_solsko_leto',l=>l.zacetno_leto+'/'+(l.zacetno_leto+1))};
    const razred={ime:'id_razred',naziv:'Razred',moznosti:moznosti('razredi','id_razred',r=>nazivRazreda(r.id_razred))};
    const izvedba={ime:'id_izvedba',naziv:'Izvedba',zaklenjeno:urejanje && ['profesorji','dijaki'].includes(vir),moznosti:moznosti('izvedbe','id_izvedba',i=>nazivIzvedbe(i.id_izvedba))};
    const dijak={ime:'id_dijak',naziv:'Dijak',zaklenjeno:urejanje,moznosti:moznosti('osebe_dijaki','id_dijak',d=>d.naziv)};
    const profesor={ime:'id_profesor',naziv:'Profesor',zaklenjeno:urejanje,moznosti:moznosti('osebe_profesorji','id_profesor',p=>p.naziv)};
    return {
        predmeti:[{ime:'sifra',naziv:'Šifra',max:20,obvezno:true},{ime:'naziv',naziv:'Naziv',max:100,obvezno:true},{ime:'opis',naziv:'Opis',tip:'textarea',max:5000},{ime:'barva',naziv:'Barva',tip:'color',privzeto:'#7b9058'},aktivnost],
        programi:[{ime:'oznaka',naziv:'Oznaka',max:20,obvezno:true},{ime:'naziv',naziv:'Naziv',max:150,obvezno:true},aktivnost],
        leta:[{ime:'zacetno_leto',naziv:'Začetno leto',tip:'number',obvezno:true},{ime:'datum_zacetka',naziv:'Začetek',tip:'date',obvezno:true},{ime:'datum_konca',naziv:'Konec',tip:'date',obvezno:true},{ime:'status',naziv:'Status',moznosti:[['odprto','Odprto'],['arhivirano','Arhivirano']]}],
        razredi:[{ime:'id_program',naziv:'Program',moznosti:moznosti('programi','id_program',p=>p.naziv)},leto,{ime:'letnik',naziv:'Letnik',moznosti:[1,2,3,4].map(n=>[n,n+'.'])},{ime:'oznaka',naziv:'Oznaka oddelka',max:10,obvezno:true},{ime:'id_razrednik',naziv:'Razrednik',moznosti:[['','Brez razrednika'],...profesor.moznosti]}],
        izvedbe:[{ime:'id_predmet',naziv:'Predmet',zaklenjeno:urejanje,moznosti:moznosti('predmeti','id_predmet',p=>p.naziv)},{...razred,zaklenjeno:urejanje},{ime:'aktivna',naziv:'Aktivna',tip:'checkbox'}],
        profesorji:[profesor,izvedba,{ime:'aktivna',naziv:'Aktiven',tip:'checkbox'}],
        dijaki:[dijak,izvedba,{ime:'status',naziv:'Status vpisa',moznosti:[['caka','Čaka potrditev'],['aktiven','Aktiven'],['izpisan','Izpisan']]}],
        vpisi:[dijak,{...leto,zaklenjeno:urejanje},razred]
    }[vir];
}
function urediZapis(vir,zapis={},poShrambi) {
    const urejanje=kljuciVirov[vir].every(k=>zapis[k]!=null);
    const vrednosti={aktiven:true,aktivna:true,...zapis};
    for(const k of ['datum_zacetka','datum_konca'])if(vrednosti[k])vrednosti[k]=vrednosti[k].slice(0,10);
    const id=urejanje ? kljuciVirov[vir].map(k=>zapis[k]).join('~') : '';
    const dialog=API.obrazec((urejanje ? 'Uredi: ' : 'Dodaj: ')+imenaVirov[vir],poljaVira(vir,urejanje),vrednosti,async p=>{
        await API.klic('/api/admin/sifranti/'+vir+(urejanje ? '/'+id : ''),urejanje ? 'PUT' : 'POST',p);await naloziPredmete();if(poShrambi)poShrambi();
    });
    if(urejanje)dialog.append(API.gumb('Izbriši nepovezan zapis',async()=>{
        if(!confirm('Izbrišem zapis? Povezane podatke in zgodovino sistem ohrani.'))return;
        await API.klic('/api/admin/sifranti/'+vir+'/'+id,'DELETE');dialog.close();await naloziPredmete();if(poShrambi)poShrambi();
    }));
}
function upravljanje(zacetni='programi') {
    const okno=API.okno('Programi, razredi in povezave');
    const izbira=API.element('select');
    for(const [vir,naziv]of Object.entries(imenaVirov)){const moznost=API.element('option',naziv);moznost.value=vir;izbira.append(moznost);}
    izbira.value=zacetni;
    const iskanje=API.element('input');iskanje.type='search';iskanje.placeholder='Poišči zapis';iskanje.setAttribute('aria-label','Poišči zapis');
    const seznam=API.element('div');
    function prikazi(){
        seznam.replaceChildren();const vir=izbira.value;
        const zapisi=sifranti[vir].filter(z=>oznakaZapisa(vir,z).toLocaleLowerCase('sl').includes(iskanje.value.toLocaleLowerCase('sl')));
        seznam.append(API.element('p',zapisi.length+' zapisov; prikazanih največ 50.'));
        zapisi.slice(0,50).forEach(z=>seznam.append(API.gumb(oznakaZapisa(vir,z),()=>urediZapis(vir,z,prikazi))));
        if(!zapisi.length)seznam.append(API.element('p','Ni zapisov.'));
    }
    okno.append(izbira,iskanje,API.gumb('Dodaj zapis',()=>urediZapis(izbira.value,{},prikazi)),seznam);
    izbira.addEventListener('change',prikazi);iskanje.addEventListener('input',prikazi);prikazi();
}
async function naloziPredmete() { sifranti=await API.klic('/api/admin/sifranti');prikaziPredmete(); }
function prikaziPredmete() {
    const q=document.getElementById('search').value.toLocaleLowerCase('sl');
    const seznam=document.getElementById('subjects');seznam.replaceChildren();
    let brez=0;let prikazano=0;
    sifranti.predmeti.forEach(p=>{
        const izvedbe=sifranti.izvedbe.filter(i=>i.id_predmet===p.id_predmet && i.aktivna);
        const povezave=sifranti.profesorji.filter(pi=>pi.aktivna && izvedbe.some(i=>i.id_izvedba===pi.id_izvedba));
        const ucitelji=[...new Set(povezave.map(pi=>sifranti.osebe_profesorji.find(u=>u.id_profesor===pi.id_profesor)?.naziv).filter(Boolean))];
        const manjka=!izvedbe.length || izvedbe.some(i=>!povezave.some(pi=>pi.id_izvedba===i.id_izvedba));if(manjka)brez++;
        if((filterPredmetov==='brez' && !manjka) || !(p.naziv+' '+ucitelji.join(' ')).toLocaleLowerCase('sl').includes(q))return;
        prikazano++;
        const kartica=API.element('article','','subject'+(manjka ? ' unassigned' : ''));
        const crta=API.element('div','','bar');crta.style.backgroundColor=p.barva;
        const telo=API.element('div','','body');
        telo.append(API.element('h2',p.naziv+(p.aktiven ? '' : ' · neaktiven')),API.element('div',ucitelji.join(', ') || 'Brez učitelja','tname'));
        const razredi=API.element('div','','chips');izvedbe.forEach(i=>razredi.append(API.element('span',nazivRazreda(i.id_razred),'chip')));
        telo.append(razredi,API.gumb('Uredi predmet',()=>urediZapis('predmeti',p)),API.gumb('Izvedbe in vpisi',()=>upravljanje('izvedbe')));kartica.append(crta,telo);seznam.append(kartica);
    });
    if(!prikazano)seznam.append(API.element('p','Ni najdenih predmetov.','empty'));
    ADMIN.besedilo('statSubjects',sifranti.predmeti.length);ADMIN.besedilo('statUnassigned',brez);
    document.querySelector('.stat .num').textContent=sifranti.razredi.length;
    document.querySelector('.stat .hint').textContent='V evidentiranih šolskih letih';
    document.querySelector('.page-header p').textContent=sifranti.razredi.length+' razredov · '+brez+' predmetov brez popolne dodelitve učiteljev';
    ADMIN.besedilo('shown','Prikazujem '+prikazano+' od '+sifranti.predmeti.length+' predmetov');
    const letniki=document.getElementById('years');letniki.replaceChildren();
    for(const letnik of [1,2,3,4]){
        const vrstica=API.element('div','','year');vrstica.append(API.element('div',letnik+'. letnik','ylabel'));
        const razredi=API.element('div','','classes');sifranti.razredi.filter(r=>r.letnik===letnik).forEach(r=>razredi.append(API.gumb(nazivRazreda(r.id_razred),()=>urediZapis('razredi',r),'class y'+letnik)));vrstica.append(razredi);letniki.append(vrstica);
    }
}
document.addEventListener('DOMContentLoaded',()=>ADMIN.zagon(async()=>{
    await naloziPredmete();
    const zavihki=document.getElementById('tabs');
    for(const [filter,naziv] of [['vsi','Vsi predmeti'],['brez','Brez učitelja']])zavihki.append(API.gumb(naziv,()=>{filterPredmetov=filter;prikaziPredmete();},'tab'));
    document.getElementById('search').addEventListener('input',prikaziPredmete);
    const gumbi=document.querySelectorAll('.page-header .actions button');gumbi[0].textContent='Programi in razredi';gumbi[0].addEventListener('click',()=>upravljanje());gumbi[1].addEventListener('click',()=>urediZapis('predmeti'));
}));
