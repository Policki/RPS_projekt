const monthYear = document.getElementById("month-year");
const calendarDays = document.getElementById("calendar-days");
const prevMonth = document.getElementById("prev-month");
const nextMonth = document.getElementById("next-month");
const eventForm = document.getElementById("event-form");
const eventTitle = document.getElementById("event-title");
const eventDate = document.getElementById("event-date");
const eventCategory = document.getElementById("event-category");
const selectedDateTitle = document.getElementById("selected-date-title");
const eventList = document.getElementById("event-list");

const months = [
    "Januar", "Februar", "Marec", "April", "Maj", "Junij",
    "Julij", "Avgust", "September", "Oktober", "November", "December"
];

const categoryColors = {
    matematika: "#cf704c",
    informatika: "#7b9058",
    fizika: "#91889e",
    slovenscina: "#b98576",
    anglescina: "#bd9026",
    zgodovina: "#9d8d62"
};

let currentDate = new Date();
let selectedDate = toDateKey(currentDate);
let events = loadEvents();

eventDate.value = selectedDate;

function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function loadEvents() {
    try {
        const storedEvents = JSON.parse(localStorage.getItem("ucenec-koledar-dogodki") || "[]");
        return Array.isArray(storedEvents) ? storedEvents : [];
    } catch {
        return [];
    }
}

function saveEvents() {
    localStorage.setItem("ucenec-koledar-dogodki", JSON.stringify(events));
}

function eventsForDate(dateKey) {
    return events.filter(event => event.date === dateKey);
}

function formatDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return `${day}. ${months[month - 1]} ${year}`;
}

function renderSelectedEvents() {
    selectedDateTitle.textContent = `Dogodki · ${formatDate(selectedDate)}`;
    eventList.innerHTML = "";

    const dayEvents = eventsForDate(selectedDate);
    if (dayEvents.length === 0) {
        const emptyMessage = document.createElement("li");
        emptyMessage.className = "empty-events";
        emptyMessage.textContent = "Za ta dan še ni dogodkov.";
        eventList.appendChild(emptyMessage);
        return;
    }

    dayEvents.forEach(event => {
        const item = document.createElement("li");
        const colorDot = document.createElement("span");
        const title = document.createElement("span");
        const removeButton = document.createElement("button");

        colorDot.className = "event-color-dot";
        colorDot.style.backgroundColor = event.color;
        title.className = "event-list-title";
        title.textContent = event.title;
        removeButton.className = "remove-event";
        removeButton.type = "button";
        removeButton.setAttribute("aria-label", `Odstrani dogodek ${event.title}`);
        removeButton.textContent = "×";
        removeButton.addEventListener("click", () => {
            events = events.filter(savedEvent => savedEvent.id !== event.id);
            saveEvents();
            renderCalendar();
            renderSelectedEvents();
        });

        item.append(colorDot, title, removeButton);
        eventList.appendChild(item);
    });
}

function selectDate(dateKey) {
    selectedDate = dateKey;
    eventDate.value = dateKey;
    renderCalendar();
    renderSelectedEvents();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthYear.textContent = `${months[month]} ${year}`;
    calendarDays.innerHTML = "";

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDay = (firstDay.getDay() + 6) % 7;
    const todayKey = toDateKey(new Date());

    for (let cell = 0; cell < 42; cell++) {
        const day = cell - startingDay + 1;
        const dayElement = document.createElement("button");
        dayElement.type = "button";

        if (day < 1 || day > daysInMonth) {
            dayElement.className = "calendar-day empty";
            dayElement.disabled = true;
            dayElement.setAttribute("aria-hidden", "true");
            calendarDays.appendChild(dayElement);
            continue;
        }

        const dateKey = toDateKey(new Date(year, month, day));
        const dayEvents = eventsForDate(dateKey);
        dayElement.className = "calendar-day";
        dayElement.setAttribute("aria-label", `${day}. ${months[month]} ${year}${dayEvents.length ? `, ${dayEvents.length} dogodkov` : ""}`);
        dayElement.setAttribute("aria-pressed", String(dateKey === selectedDate));

        if (dateKey === todayKey) dayElement.classList.add("today");
        if (dateKey === selectedDate) dayElement.classList.add("selected");
        if (dayEvents.length > 0) {
            dayElement.classList.add("has-events");
            dayElement.style.setProperty("--event-color", dayEvents[0].color);
        }

        const dayNumber = document.createElement("span");
        dayNumber.className = "day-number";
        dayNumber.textContent = day;
        dayElement.appendChild(dayNumber);

        if (dayEvents.length > 0) {
            const eventNames = document.createElement("span");
            eventNames.className = "day-events";
            dayEvents.slice(0, 2).forEach(event => {
                const name = document.createElement("span");
                name.className = "day-event-name";
                name.textContent = event.title;
                eventNames.appendChild(name);
            });
            if (dayEvents.length > 2) {
                const more = document.createElement("span");
                more.className = "day-event-more";
                more.textContent = `+${dayEvents.length - 2} več`;
                eventNames.appendChild(more);
            }
            dayElement.appendChild(eventNames);
        }

        dayElement.addEventListener("click", () => selectDate(dateKey));
        calendarDays.appendChild(dayElement);
    }
}

prevMonth.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    selectDate(toDateKey(currentDate));
});

nextMonth.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    selectDate(toDateKey(currentDate));
});

eventDate.addEventListener("change", () => {
    if (!eventDate.value) return;
    const [year, month] = eventDate.value.split("-").map(Number);
    currentDate = new Date(year, month - 1, 1);
    selectDate(eventDate.value);
});

eventForm.addEventListener("submit", event => {
    event.preventDefault();
    const title = eventTitle.value.trim();
    const date = eventDate.value;
    if (!title || !date) return;

    events.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        date,
        category: eventCategory.value,
        color: categoryColors[eventCategory.value] || "#cf704c"
    });
    saveEvents();

    const [year, month] = date.split("-").map(Number);
    currentDate = new Date(year, month - 1, 1);
    selectedDate = date;
    eventForm.reset();
    eventDate.value = date;
    eventCategory.value = "matematika";
    renderCalendar();
    renderSelectedEvents();
    eventTitle.focus();
});

renderCalendar();
renderSelectedEvents();