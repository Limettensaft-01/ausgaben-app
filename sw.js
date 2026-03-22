self.addEventListener('install', function (e) {
    self.skipWaiting();
});

self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                return caches.delete(key);
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (e) {
    e.respondWith(fetch(e.request));
});

// Einstellungen und Posten vom App empfangen
let gespeicherteEinstellungen = null;
let gespeichertePosten = [];

self.addEventListener('message', function (e) {
    if (e.data.typ === "notif-einstellungen") {
        gespeicherteEinstellungen = e.data.einstellungen;
        gespeichertePosten = e.data.posten;
    }
});

// Täglich zur eingestellten Uhrzeit prüfen
self.addEventListener('periodicsync', function (e) {
    if (e.tag === "notif-pruefung") {
        e.waitUntil(sendeNotifications());
    }
});

async function sendeNotifications() {
    if (!gespeicherteEinstellungen || !gespeicherteEinstellungen.aktiv) return;

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    for (const p of gespeichertePosten) {
        if (p.typ === "einkauf" || p.typ === "erinnerung" || p.vonEinkauf) continue;
        if (!p.datum) continue;

        const naechstesStr = berechneNaechstesDatum(p.datum, p.intervall, p.anzahl);
        if (!naechstesStr) continue;

        const teile = naechstesStr.split(".");
        const naechstes = new Date(teile[2], teile[1] - 1, teile[0]);
        naechstes.setHours(0, 0, 0, 0);

        const diffTage = Math.round((naechstes - heute) / (1000 * 60 * 60 * 24));

        if (diffTage === 0 || diffTage === gespeicherteEinstellungen.tage) {
            await self.registration.showNotification(
                diffTage === 0 ? "💸 Heute fällig!" : `⏰ In ${diffTage} Tagen fällig`,
                {
                    body: `${p.name} — ${p.betrag}€`,
                    icon: "/ausgaben-app/icon.png"
                }
            );
        }
    }
}

function berechneNaechstesDatum(datum, intervall, anzahl) {
    if (!datum || intervall === "einmalig") return null;
    const d = new Date(datum);
    const heute = new Date();
    let iterationen = 0;
    while (d <= heute && iterationen < 100) {
        iterationen++;
        if (intervall === "wöchentlich") d.setDate(d.getDate() + 7);
        else if (intervall === "monatlich") d.setMonth(d.getMonth() + 1);
        else if (intervall === "alle-x-monate") d.setMonth(d.getMonth() + parseInt(anzahl));
        else if (intervall === "alle-x-jahre") d.setFullYear(d.getFullYear() + parseInt(anzahl));
    }
    return iterationen >= 100 ? null : d.toLocaleDateString("de-DE");
}