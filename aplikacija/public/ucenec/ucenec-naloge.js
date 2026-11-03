const filters = document.querySelectorAll('[data-filter]');
const groups = document.querySelectorAll('.naloge-skupina');
const tasks = [...document.querySelectorAll('.naloga')];
const sort = document.getElementById('razvrsti');
const dialog = document.querySelector('.naloga-podrobnosti');
const collator = new Intl.Collator('sl');
let activeFilter = 'vse';

document.getElementById('stevilo-odprtih').textContent = tasks.filter(task => task.dataset.status === 'odprte').length;
document.getElementById('stevilo-oddanih').textContent = tasks.filter(task => task.dataset.status === 'oddane').length;

function updateTasks() {
    let visibleCount = 0;

    groups.forEach(group => {
        const list = group.querySelector('.naloge-seznam');
        const groupTasks = [...list.querySelectorAll('.naloga')];

        groupTasks.sort((a, b) => {
            if (sort.value === 'naslov') {
                return collator.compare(a.querySelector('h3').textContent, b.querySelector('h3').textContent);
            }
            if (sort.value === 'predmet') {
                return collator.compare(a.dataset.predmet, b.dataset.predmet);
            }
            const direction = a.dataset.status === 'oddane' ? -1 : 1;
            return direction * a.dataset.rok.localeCompare(b.dataset.rok);
        });

        let groupCount = 0;
        groupTasks.forEach(task => {
            const matches = activeFilter === 'vse'
                || task.dataset.status === activeFilter
                || (activeFilter === 'kmalu' && task.dataset.kmalu === 'true');
            task.hidden = !matches;
            if (matches) groupCount++;
            list.append(task);
        });

        group.hidden = groupCount === 0;
        group.querySelector('.stevilo').textContent = groupCount;
        visibleCount += groupCount;
    });

    document.getElementById('rezultati-filtra').textContent = `Število prikazanih nalog: ${visibleCount}.`;
}

filters.forEach(button => {
    button.addEventListener('click', () => {
        activeFilter = button.dataset.filter;
        filters.forEach(filter => {
            const active = filter === button;
            filter.classList.toggle('active', active);
            filter.setAttribute('aria-pressed', String(active));
        });
        updateTasks();
    });
});

sort.addEventListener('change', updateTasks);

document.getElementById('seznam-nalog').addEventListener('click', event => {
    const button = event.target.closest('[data-odpri]');
    if (!button) return;
    const task = button.closest('.naloga');
    document.getElementById('podrobnosti-naslov').textContent = task.querySelector('h3').textContent;
    document.getElementById('podrobnosti-predmet').textContent = task.querySelector('.naloga-predmet p').textContent;
    document.getElementById('podrobnosti-opis').textContent = task.querySelector('.naloga-opis').textContent;
    const submitted = task.dataset.status === 'oddane';
    document.getElementById('podrobnosti-rok').textContent = `${submitted ? 'Oddano' : 'Rok oddaje'}: ${task.querySelector('time').textContent}`;
    document.getElementById('podrobnosti-povezava').href = `/ucenec/predmeti/${task.dataset.povezava}.html`;
    dialog.showModal();
});

dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
        dialog.close();
    }
});

updateTasks();
