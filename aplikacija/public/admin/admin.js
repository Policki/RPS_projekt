const ADMIN = {
    vloge:{dijak:'Dijak',profesor:'Profesor',administrator:'Administrator'},
    statusi:{aktiven:'Aktiven',caka:'Čaka potrditev',onemogocen:'Onemogočen'},
    besedilo(id,besedilo) { const polje=document.getElementById(id);if(polje)polje.textContent=besedilo; },
    datum(datum) { return datum ? new Date(datum).toLocaleString('sl-SI') : 'Ni podatka'; },
    async zagon(dejanje) {
        try { const {uporabnik}=await API.identiteta();if(uporabnik.vloga!=='administrator')throw new Error('Nimate dovoljenja.');await dejanje(uporabnik); }
        catch(napaka){API.napaka(napaka);}
    }
};
document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.stat .num').forEach(polje=>polje.textContent='—');
    document.querySelector('.page-header p')?.replaceChildren(document.createTextNode('Nalagam podatke …'));
});
