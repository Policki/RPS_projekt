const monthYear = document.getElementById("month-year");
const calendarDays = document.getElementById("calendar-days");

const prevMonth = document.getElementById("prev-month");
const nextMonth = document.getElementById("next-month");

let currentDate = new Date();

const months = [
    "Januar",
    "Februar",
    "Marec",
    "April",
    "Maj",
    "Junij",
    "Julij",
    "Avgust",
    "September",
    "Oktober",
    "November",
    "December"
];

function renderCalendar() {

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYear.textContent = `${months[month]} ${year}`;

    calendarDays.innerHTML = "";

    // Prvi dan v mesecu
    const firstDay = new Date(year, month, 1);

    // Koliko dni ima mesec
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // JavaScript začne teden z nedeljo
    // Mi želimo ponedeljek
    let startingDay = firstDay.getDay();

    startingDay = startingDay === 0 ? 6 : startingDay - 1;

    // Prazna mesta pred prvim dnevom
    for (let i = 0; i < startingDay; i++) {

        const emptyDay = document.createElement("div");

        emptyDay.classList.add("calendar-day", "empty");

        calendarDays.appendChild(emptyDay);
    }

    // Dnevi
    for (let day = 1; day <= daysInMonth; day++) {

        const dayElement = document.createElement("div");

        dayElement.classList.add("calendar-day");

        dayElement.textContent = day;

        // preveri današnji dan
        const today = new Date();

        if (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {
            dayElement.classList.add("today");
        }

        // klik na dan
        dayElement.addEventListener("click", () => {

            document
                .querySelectorAll(".calendar-day.selected")
                .forEach(day => {
                    day.classList.remove("selected");
                });

            dayElement.classList.add("selected");

            console.log(
                `Izbran datum: ${day}. ${month + 1}. ${year}`
            );
        });

        calendarDays.appendChild(dayElement);
    }
}

// prejšnji mesec

prevMonth.addEventListener("click", () => {

    currentDate.setMonth(
        currentDate.getMonth() - 1
    );

    renderCalendar();
});

// naslednji mesec

nextMonth.addEventListener("click", () => {

    currentDate.setMonth(
        currentDate.getMonth() + 1
    );

    renderCalendar();
});

renderCalendar();