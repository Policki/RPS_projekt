const cards = [...document.querySelectorAll('.gradivo')];
const filters = document.querySelectorAll('[data-filter]');
const search = document.getElementById('iskanje-gradiv');
const sort = document.getElementById('razvrsti-gradiva');
const grid = document.getElementById('seznam-gradiv');
const emptyState = document.getElementById('gradiva-prazno');
const dialog = document.querySelector('.gradivo-podrobnosti');
const collator = new Intl.Collator('sl');
let activeFilter = 'vsa';

function normalize(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sl');
}

function setFilter(value) {
    activeFilter = value;
    filters.forEach(button => {
        const active = button.dataset.filter === value;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function updateCards() {
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let count = 0;

    const sortedCards = [...cards].sort((a, b) => {
        if (sort.value === 'naslov') {
            return collator.compare(a.querySelector('h2').textContent, b.querySelector('h2').textContent);
        }
        if (sort.value === 'predmet') {
            return collator.compare(a.querySelector('.gradivo-predmet').textContent, b.querySelector('.gradivo-predmet').textContent)
                || b.dataset.datum.localeCompare(a.dataset.datum);
        }
        const direction = sort.value === 'najstarejsa' ? 1 : -1;
        return direction * a.dataset.datum.localeCompare(b.dataset.datum);
    });

    sortedCards.forEach(card => {
        const searchable = normalize(`${card.querySelector('h2').textContent} ${card.querySelector('.gradivo-predmet').textContent} ${card.querySelector('.gradivo-format').textContent}`);
        const matchesSubject = activeFilter === 'vsa' || card.dataset.predmet === activeFilter;
        const matchesSearch = terms.every(term => searchable.includes(term));
        card.hidden = !(matchesSubject && matchesSearch);
        if (!card.hidden) count++;
        grid.append(card);
    });

    grid.hidden = count === 0;
    emptyState.hidden = count !== 0;
    document.getElementById('rezultati-gradiv').textContent = `Število prikazanih gradiv: ${count}.`;
}

filters.forEach(button => button.addEventListener('click', () => {
    setFilter(button.dataset.filter);
    updateCards();
}));

search.addEventListener('input', updateCards);
sort.addEventListener('change', updateCards);
document.getElementById('ponastavi-gradiva').addEventListener('click', () => {
    search.value = '';
    setFilter('vsa');
    updateCards();
    search.focus();
});

grid.addEventListener('click', event => {
    const button = event.target.closest('[data-podrobnosti]');
    if (!button) return;
    const card = button.closest('.gradivo');
    document.getElementById('podrobnosti-naslov').textContent = card.querySelector('h2').textContent;
    document.getElementById('podrobnosti-predmet').textContent = card.querySelector('.gradivo-predmet').textContent;
    document.getElementById('podrobnosti-format').textContent = card.querySelector('.gradivo-format').textContent;
    document.getElementById('podrobnosti-povezava').href = `/ucenec/predmeti/${card.dataset.predmet}.html`;
    dialog.showModal();
});

dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
        dialog.close();
    }
});

updateCards();
