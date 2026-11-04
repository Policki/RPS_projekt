let nalogeDijaka=[];
let izbranaNaloga;
function datumNaloge(vrednost){return new Date(vrednost.replace(' ','T')+(vrednost.endsWith('Z') ? '' : 'Z'));}
function lahkoOdda(naloga){return naloga.stanje_leta==='odprto' && (!naloga.rok_potekel || Boolean(naloga.dovoljena_pozna_oddaja));}
async function pripraviNaloge(){
    const seznam=document.getElementById('seznam-nalog');
    const dialog=document.querySelector('.naloga-podrobnosti');
    const filtri=[...document.querySelectorAll('[data-filter]')];
    const razvrsti=document.getElementById('razvrsti');
    let izbraniFilter='vse';
    const predmeti=await pridobiPredmete();
    if(!predmeti)return;
    const izbran=izbranaIzvedba(predmeti);
    const oblika={day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'};
    const primerjava=new Intl.Collator('sl');
    pripraviOkna();
    function odpriNalogo(naloga){
        izbranaNaloga=naloga;
        nastaviBesedilo('#podrobnosti-naslov',naloga.naslov);
        nastaviBesedilo('#podrobnosti-predmet',naloga.predmet+' · '+naloga.profesor);
        nastaviBesedilo('#podrobnosti-opis',naloga.opis);
        nastaviBesedilo('#podrobnosti-rok','Rok oddaje: '+datumNaloge(naloga.rok_oddaje).toLocaleString('sl-SI',oblika));
        document.getElementById('podrobnosti-povezava').href=povezavaPredmeta(predmeti.find(p=>p.id_izvedba===naloga.id_izvedba));
        const oddaja=document.getElementById('trenutna-oddaja');oddaja.replaceChildren();
        if(naloga.id_oddaja){
            oddaja.append(API.element('p','Oddano: '+datumNaloge(naloga.oddano_zadnjic).toLocaleString('sl-SI',oblika)+' · različica '+naloga.verzija));
            const povezava=API.element(naloga.datoteka_na_voljo ? 'a' : 'span',naloga.izvorno_ime || 'Oddana datoteka');
            if(naloga.datoteka_na_voljo)povezava.href='/api/datoteke/'+naloga.id_datoteka;
            else povezava.textContent+=' (datoteka ni na voljo)';
            oddaja.append(povezava);
            const ocena=[];
            if(naloga.tocke!==null)ocena.push('Točke: '+naloga.tocke+(naloga.max_tock ? ' / '+naloga.max_tock : ''));
            if(naloga.ocena!==null)ocena.push('Ocena: '+naloga.ocena);
            if(naloga.komentar)ocena.push(naloga.komentar);
            oddaja.append(API.element('p',ocena.join(' · ') || 'Oddaja čaka na pregled.'));
        }
        const obrazec=document.getElementById('oddaja-obrazec');obrazec.reset();obrazec.hidden=!lahkoOdda(naloga);
        document.getElementById('oddaja-komentar').value=naloga.komentar_dijaka || '';
        nastaviBesedilo('#oddaja-napaka','');
        nastaviBesedilo('#oddaja-omejitev','Največ '+Math.min(10,Number(naloga.max_velikost_bajtov)/1048576).toLocaleString('sl-SI')+' MB. Dovoljeni formati: PDF, Word, PowerPoint, XLSX, TXT, SQL, ZIP, PNG in JPG.');
        nastaviBesedilo('#oddaja-zaprta',naloga.stanje_leta!=='odprto' ? 'Šolsko leto je arhivirano.' : naloga.rok_potekel && !naloga.dovoljena_pozna_oddaja ? 'Rok za oddajo je potekel.' : '');
        document.getElementById('oddaja-poslji').textContent=naloga.id_oddaja ? 'Zamenjaj oddajo' : 'Oddaj datoteko';
        dialog.showModal();
    }
    function prikazi(){
        const zdaj=new Date();
        const konecTedna=new Date(zdaj);konecTedna.setDate(zdaj.getDate()+((7-zdaj.getDay())%7));konecTedna.setHours(23,59,59,999);
        const naslednji=new Date(konecTedna);naslednji.setDate(naslednji.getDate()+7);
        const skupine=new Map(['Rok je potekel','Ta teden','Naslednji teden','Pozneje','Oddane naloge'].map(n=>[n,[]]));
        const urejene=[...nalogeDijaka].sort((a,b)=>razvrsti.value==='naslov' ? primerjava.compare(a.naslov,b.naslov) : razvrsti.value==='predmet' ? primerjava.compare(a.predmet,b.predmet) : datumNaloge(a.rok_oddaje)-datumNaloge(b.rok_oddaje));
        let stevilo=0;
        for(const naloga of urejene){
            const rok=datumNaloge(naloga.rok_oddaje);
            const kmalu=!naloga.id_oddaja && rok>=zdaj && rok- zdaj<=7*86400000;
            if((izbraniFilter==='odprte' && naloga.id_oddaja) || (izbraniFilter==='oddane' && !naloga.id_oddaja) || (izbraniFilter==='kmalu' && !kmalu))continue;
            const ime=naloga.id_oddaja ? 'Oddane naloge' : naloga.rok_potekel ? 'Rok je potekel' : rok<=konecTedna ? 'Ta teden' : rok<=naslednji ? 'Naslednji teden' : 'Pozneje';
            skupine.get(ime).push(naloga);stevilo++;
        }
        seznam.replaceChildren();
        for(const [ime,naloge]of skupine){
            if(!naloge.length)continue;
            const skupina=API.element('section','','naloge-skupina');
            const naslov=API.element('h2',ime+' ');naslov.append(API.element('span',naloge.length,'stevilo'));
            const vrstice=API.element('div','','naloge-seznam');
            for(const naloga of naloge){
                const vrstica=API.element('article','','naloga'+(naloga.id_oddaja ? ' naloga-oddana' : ''));
                vrstica.dataset.id=naloga.id_naloga;vrstica.style.setProperty('--barva',barvaPredmeta(naloga));
                const predmet=API.element('div','','naloga-predmet');
                const opis=API.element('div');opis.append(API.element('h3',naloga.naslov),API.element('p',naloga.predmet+' · '+naloga.profesor));
                predmet.append(API.element('span',naloga.sifra,'naloga-ikona'),opis);
                const rok=API.element('div','','naloga-rok');
                const datum=API.element('time',datumNaloge(naloga.rok_oddaje).toLocaleString('sl-SI',{day:'numeric',month:'short'}));datum.dateTime=datumNaloge(naloga.rok_oddaje).toISOString();
                rok.append(datum,API.element('span',naloga.id_oddaja ? 'oddano' : naloga.rok_potekel ? 'rok je potekel' : 'do '+datumNaloge(naloga.rok_oddaje).toLocaleTimeString('sl-SI',{hour:'2-digit',minute:'2-digit'})));
                const dejanja=API.element('div','','naloga-dejanje');
                dejanja.append(API.gumb(naloga.id_oddaja ? 'Oddano' : lahkoOdda(naloga) ? 'Oddaj' : 'Odpri',()=>odpriNalogo(naloga),naloga.id_oddaja ? 'oznaka oznaka-oddano' : 'gumb'+(lahkoOdda(naloga) ? ' gumb-glavni' : '')));
                vrstica.append(predmet,API.element('p',naloga.opis,'naloga-opis'),rok,dejanja);vrstice.append(vrstica);
            }
            skupina.append(naslov,vrstice);seznam.append(skupina);
        }
        document.getElementById('naloge-prazno').hidden=stevilo!==0;
        nastaviBesedilo('#rezultati-filtra','Število prikazanih nalog: '+stevilo+'.');
        nastaviBesedilo('#stevilo-odprtih',nalogeDijaka.filter(n=>!n.id_oddaja).length);
        nastaviBesedilo('#stevilo-oddanih',nalogeDijaka.filter(n=>n.id_oddaja).length);
    }
    async function nalozi(){
        const podatki=await API.klic('/api/ucenec/naloge');
        nalogeDijaka=izbran ? podatki.filter(n=>n.id_izvedba===izbran.id_izvedba) : podatki;
        nastaviBesedilo('.naloge-glava p',izbran ? 'Naloge pri predmetu '+izbran.naziv : 'Vse naloge iz tvojih predmetov na enem mestu');
        prikazi();
    }
    filtri.forEach(gumb=>gumb.addEventListener('click',()=>{
        izbraniFilter=gumb.dataset.filter;
        filtri.forEach(f=>{f.classList.toggle('active',f===gumb);f.setAttribute('aria-pressed',String(f===gumb));});prikazi();
    }));
    razvrsti.addEventListener('change',prikazi);
    document.getElementById('oddaja-obrazec').addEventListener('submit',async dogodek=>{
        dogodek.preventDefault();
        const datoteka=document.getElementById('oddaja-datoteka').files[0];
        if(!datoteka)return;
        if(datoteka.size>Math.min(Number(izbranaNaloga.max_velikost_bajtov),10*1048576)){nastaviBesedilo('#oddaja-napaka','Datoteka presega dovoljeno velikost.');return;}
        const gumb=document.getElementById('oddaja-poslji');gumb.disabled=true;
        try{
            const podatki=new FormData();podatki.append('datoteka',datoteka);podatki.append('komentar',document.getElementById('oddaja-komentar').value);podatki.append('verzija',izbranaNaloga.verzija || 0);
            await API.klic('/api/ucenec/naloge/'+izbranaNaloga.id_naloga+'/oddaja','POST',podatki);
            dialog.close();await nalozi();nastaviBesedilo('#oddaja-sporocilo','Datoteka je uspešno oddana.');
        }catch(napaka){nastaviBesedilo('#oddaja-napaka',napaka.message);}finally{gumb.disabled=false;}
    });
    await nalozi();
}
document.addEventListener('DOMContentLoaded',()=>pripraviNaloge().catch(n=>prikaziNapako(n.message)));
