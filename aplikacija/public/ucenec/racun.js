const notificationKey = 'ucenec-nastavitve-obvestila-v1';
const phoneKey = 'ucenec-profil-telefon-v1';
const notificationInputs = [...document.querySelectorAll('[data-obvestilo]')];
const phoneValue = document.getElementById('profil-telefon');
const phoneInput = document.getElementById('telefon-nov');
const phoneForm = document.getElementById('telefon-obrazec');
const phoneError = document.getElementById('telefon-napaka');
const status = document.getElementById('racun-status');

function showStatus(message, error = false) {
    status.textContent = message;
    status.dataset.napaka = String(error);
}

function isValidPhone(value) {
    const digits = value.replace(/\D/g, '');
    return /^\+?[\d\s()-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
}

if (notificationInputs.length) {
    try {
        const stored = JSON.parse(localStorage.getItem(notificationKey) || '{}');
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
            notificationInputs.forEach(input => {
                if (typeof stored[input.dataset.obvestilo] === 'boolean') {
                    input.checked = stored[input.dataset.obvestilo];
                }
            });
        }
    } catch {
        // Keep the default choices if browser storage is unavailable or invalid.
    }

    notificationInputs.forEach(input => input.addEventListener('change', () => {
        const choices = Object.fromEntries(notificationInputs.map(toggle => [toggle.dataset.obvestilo, toggle.checked]));
        try {
            localStorage.setItem(notificationKey, JSON.stringify(choices));
            showStatus('Izbire obvestil so shranjene v tem brskalniku.');
        } catch {
            showStatus('Izbire ni mogoče shraniti. Sprememba velja le do osvežitve strani.', true);
        }
    }));
}

if (phoneValue) {
    try {
        const stored = localStorage.getItem(phoneKey);
        if (stored && stored.length <= 32 && isValidPhone(stored)) phoneValue.textContent = stored;
    } catch {
        // Keep the displayed example when browser storage is unavailable.
    }

    phoneInput.addEventListener('input', () => {
        phoneError.textContent = '';
        phoneInput.removeAttribute('aria-invalid');
    });

    phoneForm.addEventListener('submit', event => {
        event.preventDefault();
        const value = phoneInput.value.trim();
        if (!isValidPhone(value)) {
            phoneError.textContent = 'Vnesi veljavno telefonsko številko s 7–15 števkami.';
            phoneInput.setAttribute('aria-invalid', 'true');
            phoneInput.focus();
            return;
        }

        phoneValue.textContent = value;
        try {
            localStorage.setItem(phoneKey, value);
            showStatus('Telefonska številka je shranjena v tem brskalniku.');
        } catch {
            showStatus('Številke ni mogoče shraniti. Sprememba velja le do osvežitve strani.', true);
        }
        document.getElementById('telefon-dialog').close();
    });
}

document.querySelectorAll('[data-odpri-dialog]').forEach(button => {
    button.addEventListener('click', () => {
        const dialog = document.getElementById(button.dataset.odpriDialog);
        if (dialog.id === 'telefon-dialog') {
            phoneInput.value = phoneValue.textContent;
            phoneError.textContent = '';
            phoneInput.removeAttribute('aria-invalid');
        }
        dialog.showModal();
        if (dialog.id === 'telefon-dialog') phoneInput.focus();
    });
});

document.querySelectorAll('[data-zapri-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog').close());
});

document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
        const bounds = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
            dialog.close();
        }
    });
});
