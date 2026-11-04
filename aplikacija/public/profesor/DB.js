const DB_CONFIG = { prijava: '/', stolpciNastavitve: { tedenski_povzetek:'tedenski_povzetek',opomnik_rok:'opomnik_rok',novi_vpisi:'novi_vpisi' } };
const Odjava = { izvedi: async () => location.assign('/logout') };
const Nastavitve = { preberi: () => API.klic('/api/nastavitve'), shrani: (eposta,podatki) => API.klic('/api/nastavitve','PATCH',podatki) };
const Dashboard = { preberi: () => API.klic('/api/profesor/dashboard') };
const Predmeti = { preberi: () => API.klic('/api/profesor/predmeti') };
const Naloge = { preberi: () => API.klic('/api/profesor/naloge') };
const Gradiva = {
    preberi: () => API.klic('/api/profesor/gradiva'),
    naslovDatoteke: (eposta,id) => '/api/datoteke/'+id,
    dodajDatoteko: (eposta,id,datoteka) => { const podatki=new FormData();podatki.append('datoteka',datoteka);return API.klic('/api/profesor/izvedbe/'+id+'/gradiva','POST',podatki); },
    dodajPovezavo: (eposta,id,naslov,url) => API.klic('/api/profesor/izvedbe/'+id+'/gradiva','POST',{naslov:naslov || url,url})
};
