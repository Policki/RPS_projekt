let uporabniki=[];
let izbranaVloga='vsi';
let stran=0;
const velikostStrani=20;
async function naloziUporabnike() {
    uporabniki=await API.klic('/api/admin/uporabniki');
    const stevila=[uporabniki.length,uporabniki.filter(u=>u.vloga==='dijak').length,uporabniki.filter(u=>u.vloga==='profesor').length,uporabniki.filter(u=>u.vloga==='administrator').length];
    document.querySelectorAll('.stat .num').forEach((polje,i)=>polje.textContent=stevila[i]);
    const zadnja=document.querySelectorAll('.stat')[3];
    zadnja.querySelector('.label').textContent='Administratorji';zadnja.querySelector('.hint').textContent='Upravljanje sistema';
    const novi=uporabniki.filter(u=>Date.now()-new Date(u.ustvarjeno)<7*86400000).length;
    document.querySelector('.page-header p').textContent=uporabniki.length+' računov · '+novi+' novih ta teden';
    document.querySelector('.stat .hint b').textContent=novi;
    const zavihki=document.getElementById('tabs');zavihki.replaceChildren();
    for(const [vloga,naziv] of [['vsi','Vsi'],...Object.entries(ADMIN.vloge)]) {
        const gumb=API.gumb(naziv+' '+(vloga==='vsi' ? uporabniki.length : uporabniki.filter(u=>u.vloga===vloga).length),()=>{izbranaVloga=vloga;stran=0;prikaziUporabnike();for(const polje of zavihki.children)polje.classList.toggle('active',polje===gumb);},'tab');
        gumb.classList.toggle('active',vloga===izbranaVloga);zavihki.append(gumb);
    }
    prikaziUporabnike();
}
function prikaziUporabnike() {
    const iskanje=document.getElementById('search').value.toLocaleLowerCase('sl');
    const seznam=uporabniki.filter(u=>(izbranaVloga==='vsi' || u.vloga===izbranaVloga) && [u.ime,u.priimek,u.email,u.uporabnisko_ime].join(' ').toLocaleLowerCase('sl').includes(iskanje));
    const vrstice=document.getElementById('rows');vrstice.replaceChildren();
    seznam.slice(stran*velikostStrani,(stran+1)*velikostStrani).forEach(u=>{
        const vrstica=API.element('div','','row');
        const oseba=API.element('div','','user');const avatar=API.element('div',u.ime[0]+u.priimek[0],'avatar a-'+u.vloga);const opis=API.element('div');opis.append(API.element('div',u.ime+' '+u.priimek,'name'),API.element('div',u.email,'email'));oseba.append(avatar,opis);
        vrstica.append(oseba,API.element('div',ADMIN.vloge[u.vloga]),API.element('div',u.uporabnisko_ime),API.element('div',ADMIN.datum(u.zadnja_prijava)),API.element('div',ADMIN.statusi[u.status],'status'),API.gumb('Uredi',()=>urediUporabnika(u),'more'));
        vrstice.append(vrstica);
    });
    if(!seznam.length) vrstice.append(API.element('div','Ni najdenih uporabnikov.','empty'));
    ADMIN.besedilo('shown','Prikazujem '+Math.min(seznam.length,stran*velikostStrani+1)+'–'+Math.min(seznam.length,(stran+1)*velikostStrani)+' od '+seznam.length);
    const gumbi=document.querySelectorAll('.pager button');gumbi[0].disabled=stran===0;gumbi[1].disabled=(stran+1)*velikostStrani>=seznam.length;
}
function urediUporabnika(uporabnik={status:'aktiven',vloga:'dijak'}) {
    const polja=[{ime:'uporabnisko_ime',naziv:'Uporabniško ime',max:50,obvezno:true},{ime:'ime',naziv:'Ime',max:50,obvezno:true},{ime:'priimek',naziv:'Priimek',max:100,obvezno:true},{ime:'email',naziv:'E-naslov',tip:'email',obvezno:true},{ime:'telefon',naziv:'Telefon',max:32},{ime:'vloga',naziv:'Vloga',moznosti:Object.entries(ADMIN.vloge),zaklenjeno:!!uporabnik.id_uporabnik},{ime:'status',naziv:'Status',moznosti:Object.entries(ADMIN.statusi)}];
    if(!uporabnik.id_uporabnik) polja.push({ime:'geslo',naziv:'Začetno geslo (vsaj 10 znakov)',tip:'password',obvezno:true});
    const dialog=API.obrazec(uporabnik.id_uporabnik ? 'Uredi uporabnika' : 'Dodaj uporabnika',polja,uporabnik,async podatki=>{
        await API.klic('/api/admin/uporabniki'+(uporabnik.id_uporabnik ? '/'+uporabnik.id_uporabnik : ''),uporabnik.id_uporabnik ? 'PUT' : 'POST',podatki);await naloziUporabnike();
    });
    if(uporabnik.id_uporabnik) dialog.append(API.gumb('Izbriši račun brez povezanih podatkov',async()=>{
        if(!confirm('Želite izbrisati ta račun? Račune z zgodovino raje onemogočite.'))return;
        await API.klic('/api/admin/uporabniki/'+uporabnik.id_uporabnik,'DELETE');dialog.close();await naloziUporabnike();
    }));
}
document.addEventListener('DOMContentLoaded',()=>ADMIN.zagon(async()=>{
    await naloziUporabnike();
    document.getElementById('search').addEventListener('input',()=>{stran=0;prikaziUporabnike();});
    const gumbi=document.querySelectorAll('.page-header .actions button');
    gumbi[1].addEventListener('click',()=>urediUporabnika());
    gumbi[0].addEventListener('click',()=>{
        const vrstica=polja=>polja.map(p=>'"'+String(p ?? '').replace(/^[=+@-]/,"'").replaceAll('"','""')+'"').join(';');
        const csv='\uFEFF'+[vrstica(['Ime','Priimek','E-naslov','Vloga','Status']),...uporabniki.map(u=>vrstica([u.ime,u.priimek,u.email,u.vloga,u.status]))].join('\r\n');
        const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=API.element('a');a.href=url;a.download='uporabniki.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    const strani=document.querySelectorAll('.pager button');strani[0].addEventListener('click',()=>{stran--;prikaziUporabnike();});strani[1].addEventListener('click',()=>{stran++;prikaziUporabnike();});
}));
