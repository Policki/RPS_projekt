async function pripraviKoledar() {
    let dogodki = [];
    let izbrani = new Date();
    let mesec = new Date(izbrani.getFullYear(),izbrani.getMonth(),1);
    const datum = dan => `${dan.getFullYear()}-${String(dan.getMonth()+1).padStart(2,'0')}-${String(dan.getDate()).padStart(2,'0')}`;
    const izbira = document.getElementById('event-category');
    izbira.replaceChildren(API.element('option','Osebni dogodek'));
    izbira.disabled = true;
    function prikazi() {
        document.getElementById('month-year').textContent = mesec.toLocaleDateString('sl-SI',{month:'long',year:'numeric'});
        document.getElementById('event-date').value = datum(izbrani);
        document.getElementById('selected-date-title').textContent = izbrani.toLocaleDateString('sl-SI',{day:'numeric',month:'long',year:'numeric'});
        const mreza=document.getElementById('calendar-days'); mreza.replaceChildren();
        const odmik=(mesec.getDay()+6)%7;
        const zadnji=new Date(mesec.getFullYear(),mesec.getMonth()+1,0).getDate();
        for(let i=0;i<odmik;i++) mreza.append(API.element('div','','calendar-day empty'));
        for(let dan=1;dan<=zadnji;dan++) {
            const cas=new Date(mesec.getFullYear(),mesec.getMonth(),dan);
            const gumb=API.gumb('',()=>{izbrani=cas;prikazi();},'calendar-day');
            gumb.append(API.element('span',dan,'day-number'));
            gumb.classList.toggle('selected',datum(cas)===datum(izbrani));
            gumb.classList.toggle('today',datum(cas)===datum(new Date()));
            const dnevni=dogodki.filter(d=>d.datum.slice(0,10)===datum(cas));
            if(dnevni.length) {
                gumb.classList.add('has-events');
                gumb.style.setProperty('--event-color',/^#[0-9a-f]{6}$/i.test(dnevni[0].barva || '') ? dnevni[0].barva : '#cf6b49');
                const oznake=API.element('span','','day-events');
                dnevni.slice(0,2).forEach(d=>oznake.append(API.element('span',d.naslov,'day-event-name')));
                if(dnevni.length>2)oznake.append(API.element('span','+'+(dnevni.length-2),'day-event-more'));
                gumb.append(oznake);
            }
            mreza.append(gumb);
        }
        for(let i=odmik+zadnji;i<42;i++)mreza.append(API.element('div','','calendar-day empty'));
        const seznam=document.getElementById('event-list'); seznam.replaceChildren();
        const izbraniDogodki=dogodki.filter(d=>d.datum.slice(0,10)===datum(izbrani));
        if(!izbraniDogodki.length) seznam.append(API.element('li','Na ta dan ni dogodkov.','empty-events'));
        izbraniDogodki.forEach(d=>{
            const vrstica=API.element('li','','event-item');
            const odstrani=API.gumb('×',async()=>{await API.klic('/api/dogodki/'+d.id,'DELETE');await nalozi();},'remove-event');
            odstrani.setAttribute('aria-label','Odstrani dogodek '+d.naslov);
            vrstica.append(API.element('span',d.naslov,'event-list-title'),odstrani);
            seznam.append(vrstica);
        });
    }
    async function nalozi() { dogodki=await API.klic('/api/dogodki');prikazi(); }
    document.getElementById('prev-month').addEventListener('click',()=>{mesec=new Date(mesec.getFullYear(),mesec.getMonth()-1,1);prikazi();});
    document.getElementById('next-month').addEventListener('click',()=>{mesec=new Date(mesec.getFullYear(),mesec.getMonth()+1,1);prikazi();});
    document.getElementById('event-date').addEventListener('change',dogodek=>{if(dogodek.target.value){izbrani=new Date(dogodek.target.value+'T12:00:00');mesec=new Date(izbrani.getFullYear(),izbrani.getMonth(),1);prikazi();}});
    document.getElementById('event-form').addEventListener('submit',async dogodek=>{
        dogodek.preventDefault();
        const gumb=dogodek.target.querySelector('button[type=submit]');gumb.disabled=true;
        try { await API.klic('/api/dogodki','POST',{naslov:document.getElementById('event-title').value,datum:document.getElementById('event-date').value});document.getElementById('event-title').value='';await nalozi(); }
        catch(napaka){API.napaka(napaka);}finally{gumb.disabled=false;}
    });
    await nalozi();
}
