document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { uporabnik, sola } = await API.identiteta();
        const vloge = { dijak:'Dijak', profesor:'Profesor', administrator:'Administrator' };
        const ime = uporabnik.ime+' '+uporabnik.priimek;
        document.getElementById('profil-ime').textContent = ime;
        document.getElementById('profil-polno-ime').textContent = ime;
        document.querySelector('.profil-avatar').textContent = uporabnik.ime[0]+uporabnik.priimek[0];
        document.querySelector('.profil-vloga').textContent = vloge[uporabnik.vloga];
        document.querySelector('.profil-razred').textContent = uporabnik.razred || vloge[uporabnik.vloga];
        document.getElementById('profil-razred').textContent = uporabnik.razred || 'Ni podatka';
        document.getElementById('profil-razrednik').textContent = uporabnik.razrednik || 'Ni podatka';
        document.getElementById('pomoc-razrednik').textContent = uporabnik.razrednik || 'Ni podatka';
        const email = document.getElementById('profil-email'); email.textContent = uporabnik.email; email.href = 'mailto:'+uporabnik.email;
        const kontakt = document.querySelector('.kontakt-povezava');
        kontakt.href = 'mailto:'+(sola.email_sole || '');
        kontakt.querySelector('strong').textContent = sola.ime_sole || 'Šola';
        kontakt.querySelector('strong').nextElementSibling.textContent = sola.email_sole || 'Ni podatka';
        document.querySelector('.kontakt-avatar').textContent = uporabnik.razrednik?.[0] || '—';
        if (uporabnik.vloga !== 'dijak') {
            document.getElementById('profil-razred').closest('.profil-vrstica').hidden = true;
            document.getElementById('profil-razrednik').closest('.profil-vrstica').hidden = true;
            document.getElementById('pomoc-razrednik').closest('.kontakt-vrstica').hidden = true;
            document.querySelector('.kartica-glava p').textContent = 'Ime in e-naslov ureja administrator. Telefon lahko spremeniš sam.';
        }
        document.getElementById('profil-telefon').textContent = uporabnik.telefon || 'Ni podatka';
        document.querySelectorAll('[data-odpri-dialog]').forEach(gumb => gumb.addEventListener('click', () => {
            document.getElementById('telefon-nov').value = uporabnik.telefon || '';
            document.getElementById('telefon-dialog').showModal();
        }));
        document.querySelectorAll('[data-zapri-dialog]').forEach(gumb => gumb.addEventListener('click', () => gumb.closest('dialog').close()));
        document.getElementById('telefon-obrazec').addEventListener('submit', async dogodek => {
            dogodek.preventDefault();
            try {
                const telefon = document.getElementById('telefon-nov').value.trim();
                await API.klic('/api/profil','PATCH',{ telefon });
                uporabnik.telefon = telefon;
                document.getElementById('profil-telefon').textContent = telefon || 'Ni podatka';
                document.getElementById('telefon-dialog').close();
            } catch(napaka) { document.getElementById('telefon-napaka').textContent = napaka.message; }
        });
        document.getElementById('spremeni-geslo').addEventListener('click', () => API.obrazec('Spremeni geslo',[
            {ime:'staro',naziv:'Trenutno geslo',tip:'password',obvezno:true}, {ime:'novo',naziv:'Novo geslo (vsaj 10 znakov)',tip:'password',obvezno:true}
        ],{}, async podatki => { await API.klic('/api/geslo','POST',podatki); location.assign('/'); }));
        const poti = uporabnik.vloga === 'administrator' ? [
            ['dashboard','/admin-dashboard','Nadzorna plošča'], ['uporabniki','/admin/admin_uporabniki.html','Uporabniki'], ['predmeti','/admin/admin-predmeti.html','Predmeti'], ['koledar','/admin/admin-koledar.html','Koledar']
        ] : uporabnik.vloga === 'profesor' ? [
            ['dashboard','/profesor-dashboard','Nadzorna plošča'],...['predmeti','naloge','gradiva','koledar'].map(ime => [ime,'/profesor/profesor-'+ime+'.html',ime])
        ] : [
            ['dashboard','/ucenec-dasboard','Nadzorna plošča'],...['predmeti','naloge','gradiva'].map(ime => [ime,'/ucenec/ucenec-'+ime+'.html',ime]),['koledar','/ucenec/usenec-koledar.html','Koledar']
        ];
        const meni = document.getElementById('profil-navigacija');
        const nastavitve = {dijak:'/ucenec/nastavitve.html',profesor:'/profesor/profesor-nastavitve.html',administrator:'/admin/admin-nastavitve.html'};
        for (const [kljuc,pot,naziv] of [...poti,['spacer'],['profil','/profil','Profil'],['nastavitve',nastavitve[uporabnik.vloga],'Nastavitve']]) {
            const ovitek = API.element('div','','icon');
            if (kljuc === 'spacer') { ovitek.className='spacer'; meni.append(ovitek); continue; }
            const povezava = API.element('a'); povezava.href=pot; povezava.title=naziv; povezava.setAttribute('aria-label',naziv);
            ovitek.append(povezava); meni.append(ovitek);
        }
        poenotiNavigacijo();
    } catch(napaka) { API.napaka(napaka); }
});
