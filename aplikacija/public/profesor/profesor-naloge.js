async function odpriOddaje(id) {
    const podatki=await API.klic('/api/profesor/naloge/'+id+'/oddaje');
    const dialog=API.okno(podatki.naloga.naslov);
    dialog.append(API.element('p',podatki.naloga.opis));
    if(!podatki.oddaje.length) dialog.append(API.element('p','Oddaj še ni.'));
    podatki.oddaje.forEach(oddaja=>{
        const vrstica=API.element('div','','vrstica');
        const prenos=API.element('a','Prenesi oddajo','gumb'); prenos.href='/api/datoteke/'+oddaja.id_datoteka;
        vrstica.append(API.element('span',oddaja.ime+' '+oddaja.priimek+' · verzija '+oddaja.verzija),prenos,API.gumb('Oceni',()=>API.obrazec('Oceni oddajo',[
            {ime:'tocke',naziv:'Točke'+(podatki.naloga.max_tock ? ' / '+podatki.naloga.max_tock : ''),tip:'number',min:0,najvec:podatki.naloga.max_tock || 9999,korak:'0.01'},
            {ime:'ocena',naziv:'Ocena (1–5)',moznosti:[['','Brez ocene'],...[1,2,3,4,5].map(n=>[n,n])]},
            {ime:'komentar',naziv:'Komentar',tip:'textarea',max:5000}
        ],oddaja,async vrednosti=>{await API.klic('/api/profesor/oddaje/'+oddaja.id_oddaja+'/ocena','PUT',{...vrednosti,verzija:oddaja.verzija});dialog.close();await naloziNaloge();})));
        dialog.append(vrstica);
    });
}
async function naloziNaloge() {
    const podatki=await API.klic('/api/profesor/naloge');
    nastaviBesedilo('opis-naloge','Nalog za pregled: '+podatki.za_pregled+'.');
    nastaviBesedilo('naloge-stevilo',podatki.za_pregled);
    nastaviObroc(podatki.teden_oddano,podatki.teden_pregledano);
    const seznam=document.getElementById('naloge-seznam');seznam.replaceChildren();
    if(!podatki.naloge.length) prikaziPrazno(seznam,'Ni objavljenih nalog.');
    podatki.naloge.forEach(n=>{
        const vrstica=ustvariVrstico(n.barva,n.naziv,n.oznaka+' · '+n.razred+' · '+n.za_pregled+' za pregled','Rok: '+oblikujDatum(n.rok));
        vrstica.append(API.gumb('Oddaje',()=>odpriOddaje(n.id)));seznam.append(vrstica);
    });
}
document.addEventListener('DOMContentLoaded',async()=>{
    try {
        await naloziNaloge();
        const gumb=API.gumb('Nova naloga',async()=>{
            const {predmeti}=await API.klic('/api/profesor/predmeti');
            if(!predmeti.length) throw new Error('Nimate dodeljenih izvedb.');
            API.obrazec('Nova naloga',[
                {ime:'id_izvedba',naziv:'Predmet in razred',moznosti:predmeti.map(p=>[p.id,p.naziv+' · '+p.razred])},
                {ime:'naslov',naziv:'Naslov',obvezno:true,max:200},{ime:'opis',naziv:'Navodila',tip:'textarea',obvezno:true,max:10000},
                {ime:'rok_oddaje',naziv:'Rok oddaje',tip:'datetime-local',obvezno:true}, {ime:'max_tock',naziv:'Največ točk',tip:'number',min:0,korak:'0.01'},
                {ime:'dovoljena_pozna_oddaja',naziv:'Dovoli pozno oddajo',tip:'checkbox'}
            ],{},async p=>{p.rok_oddaje=new Date(p.rok_oddaje).toISOString();await API.klic('/api/profesor/izvedbe/'+p.id_izvedba+'/naloge','POST',p);await naloziNaloge();});
        });
        document.getElementById('naloge-seznam').before(gumb);
    }catch(n){API.napaka(n);}
});
