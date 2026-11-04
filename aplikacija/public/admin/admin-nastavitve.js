let nastavitve;
const stikala={auto:'samodejne_kopije',rocnaPotrditev:'rocna_potrditev',novaPrijava:'obvestilo_nova_prijava'};
function prikaziNastavitve() {
    document.getElementById('sola-ime').value=nastavitve.ime_sole || '';
    document.getElementById('sola-mail').value=nastavitve.email_sole || '';
    document.getElementById('leto').value=nastavitve.id_trenutno_leto;
    document.getElementById('cas').value=nastavitve.casovni_pas || 'Europe/Ljubljana';
    document.getElementById('seja').value=nastavitve.potek_seje_minut || 30;
    for(const [kljuc,polje] of Object.entries(stikala))document.querySelector('[data-key='+kljuc+']').setAttribute('aria-checked',String(Boolean(nastavitve[polje])));
    for(const gumb of document.querySelectorAll('[data-freq]'))gumb.classList.toggle('active',gumb.dataset.freq===nastavitve.pogostost_kopij);
    ADMIN.besedilo('freqHint',(nastavitve.pogostost_kopij==='tedensko' ? 'Vsakih sedem dni' : 'Vsak dan')+' po 7. uri; aplikacija mora teči.');
    ADMIN.besedilo('lastBackup',nastavitve.kopije?.zadnja || 'Še ni izdelana');ADMIN.besedilo('diskText','Poraba prostora se ne meri.');document.getElementById('diskBar').style.width='0%';
}
document.addEventListener('DOMContentLoaded',()=>ADMIN.zagon(async()=>{
    const sifranti=await API.klic('/api/admin/sifranti');
    const leta=document.getElementById('leto');leta.replaceChildren();
    sifranti.leta.forEach(l=>{const polje=API.element('option',l.zacetno_leto+'/'+(l.zacetno_leto+1)+' · '+l.status);polje.value=l.id_solsko_leto;leta.append(polje);});
    const seje=document.getElementById('seja');seje.replaceChildren();for(const [vrednost,naziv]of [[30,'30 minut'],[60,'1 ura'],[240,'4 ure']]){const polje=API.element('option',naziv);polje.value=vrednost;seje.append(polje);}
    async function nalozi(){nastavitve=await API.klic('/api/admin/nastavitve');prikaziNastavitve();}
    await nalozi();
    const starsi=document.querySelector('[data-key=starsi]');starsi.disabled=true;starsi.setAttribute('aria-checked','false');starsi.closest('.setting').querySelector('.d').textContent='Ta projekt ima vloge dijak, profesor in administrator.';
    const obvestilo=document.querySelector('[data-key=novaPrijava]');obvestilo.disabled=true;obvestilo.closest('.setting').querySelector('.d').textContent='Pošiljanje e-pošte še ni nastavljeno. Prijave se beležijo v dnevnik.';
    for(const [kljuc,polje]of Object.entries(stikala))document.querySelector('[data-key='+kljuc+']').addEventListener('click',dogodek=>{nastavitve[polje]=!nastavitve[polje];dogodek.currentTarget.setAttribute('aria-checked',String(Boolean(nastavitve[polje])));ADMIN.besedilo('saveStatus','Neshranjene spremembe');});
    document.querySelectorAll('[data-freq]').forEach(gumb=>gumb.addEventListener('click',()=>{nastavitve.pogostost_kopij=gumb.dataset.freq;for(const polje of document.querySelectorAll('[data-freq]'))polje.classList.toggle('active',polje===gumb);}));
    document.getElementById('save').addEventListener('click',async()=>{
        try {
            const p={...nastavitve,ime_sole:document.getElementById('sola-ime').value,email_sole:document.getElementById('sola-mail').value,id_trenutno_leto:document.getElementById('leto').value,casovni_pas:document.getElementById('cas').value,potek_seje_minut:document.getElementById('seja').value};
            const odgovor=await API.klic('/api/admin/nastavitve','PUT',p);ADMIN.besedilo('saveStatus',odgovor.sporocilo);await nalozi();
        }catch(n){API.napaka(n);}
    });
    document.getElementById('reset').addEventListener('click',()=>nalozi().catch(API.napaka));
    document.getElementById('backupNow').addEventListener('click',async dogodek=>{
        dogodek.target.disabled=true;try{await API.klic('/api/admin/kopije','POST');await nalozi();}catch(n){API.napaka(n);}finally{dogodek.target.disabled=false;}
    });
    document.getElementById('export').addEventListener('click',()=>location.assign('/api/admin/izvoz'));
    document.getElementById('archive').addEventListener('click',async()=>{
        if(!confirm('Arhiviram trenutno leto? Podatki bodo ohranjeni, profesorji pa vanj ne bodo več vpisovali.'))return;
        try{const p=await API.klic('/api/admin/arhiv','POST',{id_solsko_leto:nastavitve.id_trenutno_leto});ADMIN.besedilo('saveStatus',p.sporocilo);await nalozi();}catch(n){API.napaka(n);}
    });
}));
