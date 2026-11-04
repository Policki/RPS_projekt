async function pripraviGradiva(){
    const mreza=document.getElementById('seznam-gradiv');
    const iskanje=document.getElementById('iskanje-gradiv');
    const razvrsti=document.getElementById('razvrsti-gradiva');
    const filtri=document.querySelector('.gradiva-filtri');
    const predmeti=await pridobiPredmete();if(!predmeti)return;
    const izbran=izbranaIzvedba(predmeti);
    const gradiva=await API.klic('/api/ucenec/gradiva');
    let izbraniPredmet=izbran ? String(izbran.id_predmet) : 'vsa';
    const primerjava=new Intl.Collator('sl');
    function povezava(gradivo){
        if(gradivo.id_datoteka)return gradivo.datoteka_na_voljo ? '/api/datoteke/'+gradivo.id_datoteka : null;
        try{const url=new URL(gradivo.url);return ['http:','https:'].includes(url.protocol) ? url.href : null;}catch{return null;}
    }
    function ikona(oznaka){
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        const uporabi=document.createElementNS('http://www.w3.org/2000/svg','use');uporabi.setAttribute('href','#ikona-'+oznaka);svg.append(uporabi);return svg;
    }
    function oblika(gradivo){
        if(gradivo.id_datoteka){
            const koncnica=gradivo.izvorno_ime.split('.').pop().toUpperCase();
            const bajti=Number(gradivo.velikost_bajtov);
            return koncnica+' · '+(bajti>=1048576 ? (bajti/1048576).toLocaleString('sl-SI',{maximumFractionDigits:1})+' MB' : Math.ceil(bajti/1024)+' KB');
        }
        return gradivo.vrsta==='video' ? 'VIDEO' : 'POVEZAVA';
    }
    function odpri(gradivo){
        const dialog=document.querySelector('.gradivo-podrobnosti');
        nastaviBesedilo('#podrobnosti-naslov',gradivo.naslov);nastaviBesedilo('#podrobnosti-predmet',gradivo.predmet);
        nastaviBesedilo('#podrobnosti-format',oblika(gradivo));nastaviBesedilo('#podrobnosti-opis',gradivo.opis || '');
        const gumb=document.getElementById('podrobnosti-povezava');const naslov=povezava(gradivo);
        gumb.hidden=!naslov;
        if(naslov){gumb.href=naslov;gumb.textContent=gradivo.id_datoteka ? 'Prenesi datoteko' : 'Odpri povezavo';gumb.target=gradivo.id_datoteka ? '_self' : '_blank';gumb.rel='noopener noreferrer';}
        nastaviBesedilo('#gradivo-nedosegljivo',naslov ? '' : 'Datoteka še ni na voljo. Obrni se na profesorja.');dialog.showModal();
    }
    function oznaci(){for(const gumb of filtri.children){const aktiven=gumb.dataset.filter===izbraniPredmet;gumb.classList.toggle('active',aktiven);gumb.setAttribute('aria-pressed',String(aktiven));}}
    function prikazi(){
        const besede=normaliziraj(iskanje.value).split(/\s+/).filter(Boolean);
        const urejena=gradiva.filter(g=>(!izbran || g.id_izvedba===izbran.id_izvedba) && (izbraniPredmet==='vsa' || String(g.id_predmet)===izbraniPredmet) && besede.every(b=>normaliziraj(g.naslov+' '+g.predmet+' '+oblika(g)).includes(b)));
        urejena.sort((a,b)=>razvrsti.value==='naslov' ? primerjava.compare(a.naslov,b.naslov) : razvrsti.value==='predmet' ? primerjava.compare(a.predmet,b.predmet) : (razvrsti.value==='najstarejsa' ? 1 : -1)*a.objavljeno.localeCompare(b.objavljeno));
        mreza.replaceChildren();
        for(const gradivo of urejena){
            const kartica=API.element('article','','gradivo');kartica.dataset.id=gradivo.id_gradivo;kartica.style.setProperty('--barva',barvaPredmeta(gradivo));
            const glava=API.element('div','','gradivo-glava');glava.append(API.element('span',gradivo.predmet,'gradivo-predmet'));
            if(Date.now()-datumGradiva(gradivo.objavljeno).getTime()<7*86400000)glava.append(API.element('span','NOVO','gradivo-novo'));
            const oznaka=API.element('span','','gradivo-ikona');oznaka.append(ikona(gradivo.vrsta==='video' ? 'video' : gradivo.vrsta==='povezava' ? 'povezava' : gradivo.vrsta==='predstavitev' ? 'predstavitev' : 'dokument'));
            const naslov=API.element('h2');naslov.append(API.gumb(gradivo.naslov,()=>odpri(gradivo),''));
            const noga=API.element('footer','','gradivo-noga');const podatki=API.element('div');
            const datum=API.element('time',datumGradiva(gradivo.objavljeno).toLocaleDateString('sl-SI',{day:'numeric',month:'short'}));datum.dateTime=datumGradiva(gradivo.objavljeno).toISOString();
            podatki.append(API.element('p',oblika(gradivo),'gradivo-format'),datum);
            const url=povezava(gradivo);const dejanje=API.element(url ? 'a' : 'button','','gradivo-dejanje');
            if(url){dejanje.href=url;dejanje.target=gradivo.id_datoteka ? '_self' : '_blank';dejanje.rel='noopener noreferrer';dejanje.setAttribute('aria-label',(gradivo.id_datoteka ? 'Prenesi: ' : 'Odpri: ')+gradivo.naslov);}
            else{dejanje.type='button';dejanje.disabled=true;dejanje.title='Datoteka ni na voljo';dejanje.setAttribute('aria-label','Datoteka ni na voljo');}
            dejanje.append(ikona(gradivo.id_datoteka ? 'prenos' : 'puscica'));
            noga.append(podatki,dejanje);kartica.append(glava,oznaka,naslov,noga);mreza.append(kartica);
        }
        document.getElementById('gradiva-prazno').hidden=urejena.length!==0;
        nastaviBesedilo('#rezultati-gradiv','Število prikazanih gradiv: '+urejena.length+'.');
    }
    filtri.replaceChildren();
    const prikazani=new Set();
    const vsi=API.gumb('Vsa gradiva',()=>{izbraniPredmet='vsa';oznaci();prikazi();},'filter');vsi.dataset.filter='vsa';filtri.append(vsi);
    for(const predmet of predmeti){
        if(prikazani.has(predmet.id_predmet))continue;prikazani.add(predmet.id_predmet);
        const gumb=API.gumb(predmet.naziv,()=>{izbraniPredmet=String(predmet.id_predmet);oznaci();prikazi();},'filter');gumb.dataset.filter=predmet.id_predmet;gumb.style.setProperty('--barva',barvaPredmeta(predmet));filtri.append(gumb);
    }
    nastaviBesedilo('#gradiva-povzetek',izbran ? 'Gradiva pri predmetu '+izbran.naziv : gradiva.length+' gradiv iz tvojih predmetov');
    iskanje.addEventListener('input',prikazi);razvrsti.addEventListener('change',prikazi);
    document.getElementById('ponastavi-gradiva').addEventListener('click',()=>{iskanje.value='';izbraniPredmet='vsa';oznaci();prikazi();});
    pripraviOkna();oznaci();prikazi();
}
function datumGradiva(vrednost){return new Date(vrednost.replace(' ','T')+(vrednost.endsWith('Z') ? '' : 'Z'));}
document.addEventListener('DOMContentLoaded',()=>pripraviGradiva().catch(n=>prikaziNapako(n.message)));
