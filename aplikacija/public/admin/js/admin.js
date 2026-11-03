/* ============================================================
   Skupna JavaScript koda: komunikacija s PHP API-jem,
   obvestila, pogovorna okna in oblikovanje datumov.
   Uporaba na vsaki strani:  await Admin.init();
   ============================================================ */
(function () {
    'use strict';

    const BASE = 'api/';
    const LOGIN_PAGE = 'admin-prijava.html';
    let csrf = null;
    let mePromise = null;

    class ApiError extends Error {
        constructor(message, status, data) {
            super(message);
            this.status = status;
            this.data = data || null;
        }
    }

    function goLogin() {
        const here = location.pathname.split('/').pop() || '';
        if (here === LOGIN_PAGE) return;
        location.href = LOGIN_PAGE + (here && here !== LOGIN_PAGE ? '?next=' + encodeURIComponent(here) : '');
    }

    function buildUrl(endpoint, params) {
        let url = BASE + endpoint;
        if (params) {
            const qs = new URLSearchParams();
            Object.keys(params).forEach((k) => {
                const v = params[k];
                if (v !== undefined && v !== null && v !== '') qs.set(k, v);
            });
            const s = qs.toString();
            if (s) url += (url.indexOf('?') === -1 ? '?' : '&') + s;
        }
        return url;
    }

    async function send(endpoint, opts) {
        opts = opts || {};
        const method = opts.method || 'GET';
        const headers = { Accept: 'application/json' };
        const init = { method, headers, credentials: 'same-origin' };

        if (method !== 'GET') {
            if (!csrf) await me();
            headers['X-CSRF-Token'] = csrf;
        }
        if (opts.body !== undefined) {
            headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(opts.body);
        }

        let res;
        try {
            res = await fetch(buildUrl(endpoint, opts.params), init);
        } catch (e) {
            throw new ApiError('Strežnik ni dosegljiv. Preveri, ali teče Apache in MySQL.', 0);
        }
        if (res.status === 401 && endpoint.indexOf('login.php') !== 0) {
            goLogin();
            throw new ApiError('Seja je potekla.', 401);
        }
        return res;
    }

    async function api(endpoint, opts) {
        const res = await send(endpoint, opts);
        let data = null;
        try { data = await res.json(); } catch (e) { /* prazen ali neveljaven odgovor */ }
        if (!res.ok) {
            throw new ApiError((data && data.error) || 'Napaka na strežniku (' + res.status + ').', res.status, data);
        }
        return data;
    }

    function me() {
        if (!mePromise) {
            mePromise = api('me.php').then((d) => { csrf = d.csrf; return d; });
            mePromise.catch(() => { mePromise = null; });
        }
        return mePromise;
    }

    async function init() {
        return me();
    }

    async function logout() {
        try { await api('logout.php', { method: 'POST' }); } catch (e) { /* vseeno nadaljuj */ }
        location.href = LOGIN_PAGE;
    }

    /* Prenos datoteke iz API-ja (CSV, JSON) prek fetch, da napake prikažemo lepo. */
    async function download(endpoint, params, filename) {
        const res = await send(endpoint, { params });
        if (!res.ok) {
            let msg = 'Prenos ni uspel.';
            try { msg = (await res.json()).error || msg; } catch (e) {}
            throw new ApiError(msg, res.status);
        }
        const blob = await res.blob();
        saveBlob(blob, filename);
    }

    function saveBlob(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    /* ---------- Datumi ---------- */
    function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    function dayDiff(d) { return Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000); }
    function daysAgo(n) {
        if (n === 2) return 'Pred 2 dnevoma';
        return 'Pred ' + n + ' dnevi';
    }
    function fmtDay(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        const n = dayDiff(d);
        if (n <= 0) return 'Danes';
        if (n === 1) return 'Včeraj';
        if (n < 30) return daysAgo(n);
        return d.toLocaleDateString('sl-SI');
    }
    function fmtWhen(iso) {
        if (!iso) return 'Še ni bilo';
        const d = new Date(iso);
        const n = dayDiff(d);
        if (n <= 0) return 'Danes, ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
        return fmtDay(iso);
    }

    /* ---------- Obvestila (toast) ---------- */
    let toastBox = null;
    function toast(message, type) {
        if (!toastBox) {
            toastBox = document.createElement('div');
            toastBox.className = 'ui-toasts';
            toastBox.setAttribute('role', 'status');
            toastBox.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastBox);
        }
        const t = document.createElement('div');
        t.className = 'ui-toast' + (type === 'error' ? ' ui-toast-error' : '');
        t.textContent = message;
        toastBox.appendChild(t);
        setTimeout(() => {
            t.classList.add('out');
            setTimeout(() => t.remove(), 250);
        }, type === 'error' ? 5000 : 2800);
    }

    /* ---------- Pogovorno okno z obrazcem ---------- */
    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function modal(opts) {
        return new Promise((resolve) => {
            const fields = opts.fields || [];
            const previous = document.activeElement;
            const overlay = el('div', 'ui-overlay');
            const box = el('div', 'ui-modal');
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-modal', 'true');
            const titleId = 'ui-title-' + Math.random().toString(36).slice(2);
            box.setAttribute('aria-labelledby', titleId);

            const h = el('h2', 'ui-title', opts.title || '');
            h.id = titleId;
            box.appendChild(h);
            if (opts.description) box.appendChild(el('p', 'ui-desc', opts.description));

            const form = el('form', 'ui-form');
            form.noValidate = false;
            const inputs = {};
            const wrappers = {};

            fields.forEach((f) => {
                const wrap = el('div', 'ui-field');
                const id = 'ui-f-' + f.name + '-' + Math.random().toString(36).slice(2, 6);
                const label = el('label', null, f.label);
                label.htmlFor = id;
                wrap.appendChild(label);
                let input;

                if (f.type === 'select') {
                    input = el('select');
                    (f.options || []).forEach((o) => {
                        const op = el('option', null, o.label);
                        op.value = o.value;
                        input.appendChild(op);
                    });
                    input.value = f.value !== undefined && f.value !== null ? String(f.value) : '';
                } else if (f.type === 'checkboxes') {
                    input = el('div', 'ui-checks');
                    input.id = id;
                    const chosen = (f.value || []).map(String);
                    (f.options || []).forEach((o) => {
                        const lab = el('label', 'ui-check');
                        const cb = el('input');
                        cb.type = 'checkbox';
                        cb.value = o.value;
                        cb.checked = chosen.indexOf(String(o.value)) !== -1;
                        lab.appendChild(cb);
                        lab.appendChild(el('span', null, o.label));
                        input.appendChild(lab);
                    });
                } else {
                    input = el('input');
                    input.type = f.type || 'text';
                    if (f.value !== undefined && f.value !== null) input.value = f.value;
                    if (f.placeholder) input.placeholder = f.placeholder;
                    if (f.maxLength) input.maxLength = f.maxLength;
                    if (f.minLength) input.minLength = f.minLength;
                    if (f.autocomplete) input.autocomplete = f.autocomplete;
                }
                if (f.type !== 'checkboxes') {
                    input.id = id;
                    if (f.required) input.required = true;
                }
                wrap.appendChild(input);
                if (f.hint) wrap.appendChild(el('div', 'ui-hint', f.hint));
                form.appendChild(wrap);
                inputs[f.name] = input;
                wrappers[f.name] = wrap;
            });

            const errBox = el('div', 'ui-error');
            errBox.setAttribute('role', 'alert');
            form.appendChild(errBox);

            const actions = el('div', 'ui-actions');
            const cancel = el('button', 'ui-btn', opts.cancelLabel || 'Prekliči');
            cancel.type = 'button';
            const submit = el('button', 'ui-btn ' + (opts.danger ? 'ui-btn-danger-solid' : 'ui-btn-primary'), opts.submitLabel || 'Shrani');
            submit.type = 'submit';
            if (opts.hideCancel !== true) actions.appendChild(cancel);
            actions.appendChild(submit);
            form.appendChild(actions);
            box.appendChild(form);
            overlay.appendChild(box);

            function values() {
                const v = {};
                fields.forEach((f) => {
                    if (wrappers[f.name].hidden) { v[f.name] = null; return; }
                    if (f.type === 'checkboxes') {
                        v[f.name] = Array.prototype.slice.call(inputs[f.name].querySelectorAll('input:checked'))
                            .map((c) => c.value);
                    } else {
                        v[f.name] = inputs[f.name].value;
                    }
                });
                return v;
            }

            function refreshVisibility() {
                const v = values();
                fields.forEach((f) => {
                    if (typeof f.showIf !== 'function') return;
                    const raw = {};
                    fields.forEach((g) => {
                        raw[g.name] = g.type === 'checkboxes' ? null : inputs[g.name].value;
                    });
                    const show = !!f.showIf(raw);
                    wrappers[f.name].hidden = !show;
                    if (inputs[f.name].required !== undefined && f.type !== 'checkboxes') {
                        inputs[f.name].disabled = !show;
                    }
                });
                return v;
            }
            form.addEventListener('input', refreshVisibility);
            form.addEventListener('change', refreshVisibility);

            function close(result) {
                document.removeEventListener('keydown', onKey, true);
                overlay.remove();
                document.body.classList.remove('ui-lock');
                if (previous && previous.focus) previous.focus();
                resolve(result);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.stopPropagation(); close(null); }
            }

            cancel.addEventListener('click', () => close(null));
            overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errBox.textContent = '';
                submit.disabled = true;
                cancel.disabled = true;
                try {
                    const result = opts.onSubmit ? await opts.onSubmit(values()) : true;
                    close(result === undefined ? true : result);
                } catch (err) {
                    errBox.textContent = err && err.message ? err.message : 'Napaka.';
                    submit.disabled = false;
                    cancel.disabled = false;
                }
            });

            document.addEventListener('keydown', onKey, true);
            document.body.classList.add('ui-lock');
            document.body.appendChild(overlay);
            refreshVisibility();
            const first = form.querySelector('input:not([type=checkbox]):not(:disabled), select:not(:disabled)');
            (first || submit).focus();
        });
    }

    async function confirmDialog(opts) {
        const r = await modal({
            title: opts.title,
            description: opts.text,
            submitLabel: opts.confirmLabel || 'Potrdi',
            danger: !!opts.danger,
            onSubmit: opts.onConfirm || (() => true)
        });
        return r !== null;
    }

    /* ---------- Meni z dejanji (pri vrstici) ---------- */
    let openMenu = null;
    function closeMenu() {
        if (openMenu) {
            openMenu.remove();
            openMenu = null;
            document.removeEventListener('mousedown', outside, true);
            document.removeEventListener('keydown', menuKey, true);
        }
    }
    function outside(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
    function menuKey(e) { if (e.key === 'Escape') closeMenu(); }

    function menu(anchor, items) {
        closeMenu();
        const m = el('div', 'ui-menu');
        m.setAttribute('role', 'menu');
        items.forEach((it) => {
            const b = el('button', 'ui-menu-item' + (it.danger ? ' danger' : ''), it.label);
            b.type = 'button';
            b.setAttribute('role', 'menuitem');
            b.addEventListener('click', () => { closeMenu(); it.onClick(); });
            m.appendChild(b);
        });
        document.body.appendChild(m);
        const r = anchor.getBoundingClientRect();
        const w = m.offsetWidth;
        m.style.top = Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 6 + window.scrollY) + 'px';
        m.style.left = Math.max(8, r.right - w + window.scrollX) + 'px';
        openMenu = m;
        setTimeout(() => {
            document.addEventListener('mousedown', outside, true);
            document.addEventListener('keydown', menuKey, true);
        }, 0);
        const first = m.querySelector('button');
        if (first) first.focus();
    }

    window.Admin = {
        api, init, me, logout, download, saveBlob,
        toast, modal, confirm: confirmDialog, menu,
        fmtWhen, fmtDay, ApiError
    };
})();
