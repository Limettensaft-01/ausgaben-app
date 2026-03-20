// XSS-Schutz: HTML-Escape für Benutzereingaben (Backup für Fälle wo innerHTML nötig ist)
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

const form = document.getElementById("ausgaben-form");
const liste = document.getElementById("posten-liste");
const intervallSelect = document.getElementById("intervall");
const anzahlContainer = document.getElementById("intervall-anzahl-container");

intervallSelect.addEventListener("change", function () {
    const brauchtAnzahl = intervallSelect.value === "alle-x-monate" ||
        intervallSelect.value === "alle-x-jahre";
    anzahlContainer.style.display = brauchtAnzahl ? "block" : "none";

    if (intervallSelect.value === "alle-x-monate") {
        document.getElementById("intervall-anzahl-label").textContent = "Wie viele Monate?";
    } else if (intervallSelect.value === "alle-x-jahre") {
        document.getElementById("intervall-anzahl-label").textContent = "Wie viele Jahre?";
    }
});

// Sortierfunktion: Einnahmen zuerst, dann Ausgaben
function sortierePosten() {
    return posten.sort((a, b) => {
        if (a.typ === "einnahme" && b.typ === "ausgabe") return -1;
        if (a.typ === "ausgabe" && b.typ === "einnahme") return 1;
        return 0;
    });
}

// Beim Laden der Seite: gespeicherte Posten anzeigen
let posten = JSON.parse(localStorage.getItem("posten")) || [];
sortierePosten(); // ✅ HIER HINZUFÜGEN
posten.forEach((p, i) => zeigePosten(p, i));
berechneGesamtsumme();

form.addEventListener("submit", function (event) {
    event.preventDefault();

    const neuerPosten = {
        typ: document.getElementById("typ").value,
        name: document.getElementById("name").value,
        betrag: document.getElementById("betrag").value,
        datum: document.getElementById("datum").value,
        intervall: document.getElementById("intervall").value,
        anzahl: document.getElementById("intervall-anzahl").value || 1
    };

    posten.push(neuerPosten);
    sortierePosten(); // ✅ HIER HINZUFÜGEN
    localStorage.setItem("posten", JSON.stringify(posten));
    liste.innerHTML = ""; // ✅ ALTE LISTE LEEREN
    posten.forEach((p, i) => zeigePosten(p, i)); // ✅ NEU RENDERN
    berechneGesamtsumme();
    form.reset();
});

function formatIntervall(intervall, anzahl) {
    if (intervall === "einmalig") return "Einmalig";
    if (intervall === "wöchentlich") return "Wöchentlich";
    if (intervall === "monatlich") return "Monatlich";
    if (intervall === "alle-x-monate") return "Alle " + anzahl + " Monate";
    if (intervall === "alle-x-jahre") return anzahl == 1 ? "Jährlich" : "Alle " + anzahl + " Jahre";
    return intervall;
}

function zeigePosten(p, index) {
    const eintrag = document.createElement("li");
    eintrag.classList.add(p.typ === "einnahme" ? "einnahme-eintrag" : "ausgabe-eintrag");
    const naechstesDatum = berechneNaechstesDatum(p.datum, p.intervall, p.anzahl);

    // Name
    const nameSpan = document.createElement("span");
    nameSpan.className = "tag name";
    nameSpan.textContent = p.name; // ✅ Automatisch sicher!
    eintrag.appendChild(nameSpan);

    // Betrag
    const betragSpan = document.createElement("span");
    betragSpan.className = "tag betrag";
    betragSpan.textContent = p.betrag + "€"; // ✅ Automatisch sicher!
    eintrag.appendChild(betragSpan);

    // Intervall
    const intervallSpan = document.createElement("span");
    intervallSpan.className = "tag intervall";
    intervallSpan.textContent = formatIntervall(p.intervall, p.anzahl); // ✅ formatIntervall gibt nur feste Strings zurück
    eintrag.appendChild(intervallSpan);

    // Fälligkeit (optional)
    if (naechstesDatum) {
        const datumSpan = document.createElement("span");
        datumSpan.className = "tag faelligkeit";
        datumSpan.textContent = "📅 " + naechstesDatum; // ✅ Automatisch sicher!
        eintrag.appendChild(datumSpan);
    } else {
        const placeholder = document.createElement("span");
        placeholder.className = "tag";
        placeholder.style.visibility = "hidden";
        eintrag.appendChild(placeholder);
    }

    // Löschen-Button
    const loeschenBtn = document.createElement("button");
    loeschenBtn.textContent = "✕";
    loeschenBtn.classList.add("loeschen");
    loeschenBtn.onclick = function () {
        posten.splice(index, 1);
        sortierePosten(); // ✅ HIER HINZUFÜGEN
        localStorage.setItem("posten", JSON.stringify(posten));
        liste.innerHTML = ""; // ✅ ALTE LISTE LEEREN
        posten.forEach((p, i) => zeigePosten(p, i)); // ✅ NEU RENDERN
        berechneGesamtsumme();
    };

    eintrag.appendChild(loeschenBtn);
    liste.appendChild(eintrag);

    // ✅ Trennlinie nach dem letzten Einnahmen-Eintrag
    if (p.typ === "einnahme" && index < posten.length - 1 && posten[index + 1].typ === "ausgabe") {
        const trenner = document.createElement("hr");
        trenner.className = "trennlinie";
        liste.appendChild(trenner);
    }

}

function berechneNaechstesDatum(datum, intervall, anzahl) {
    if (!datum || intervall === "einmalig") return null;

    const d = new Date(datum);
    const heute = new Date();

    // Schutz vor Endlosschleife: Maximal 100 Iterationen
    let iterationen = 0;
    const maxIterationen = 100;

    while (d <= heute && iterationen < maxIterationen) {
        iterationen++;

        if (intervall === "wöchentlich") {
            d.setDate(d.getDate() + 7);
        } else if (intervall === "monatlich") {
            // Robuster: Tag speichern, Monat erhöhen, dann Tag wieder setzen
            const tag = d.getDate();
            d.setMonth(d.getMonth() + 1);
            // Falls der Tag im neuen Monat nicht existiert (31. Jan → 3. März),
            // auf den letzten Tag des Monats korrigieren
            if (d.getDate() !== tag) {
                d.setDate(0); // Setzt auf letzten Tag des Vormonats
            }
        } else if (intervall === "alle-x-monate") {
            const tag = d.getDate();
            d.setMonth(d.getMonth() + parseInt(anzahl));
            if (d.getDate() !== tag) {
                d.setDate(0);
            }
        } else if (intervall === "alle-x-jahre") {
            const tag = d.getDate();
            d.setFullYear(d.getFullYear() + parseInt(anzahl));
            // Bei Schaltjahren: 29. Feb → 28. Feb
            if (d.getDate() !== tag) {
                d.setDate(0);
            }
        }
    }

    return iterationen >= maxIterationen ? null : d.toLocaleDateString("de-DE");
}

function berechneGesamtsumme() {
    let ausgaben = 0;
    let einnahmen = 0;

    posten.forEach(function (p) {
        const betrag = parseFloat(p.betrag);
        let monatlich = 0;

        if (p.intervall === "wöchentlich") {
            monatlich = betrag * 4.33;
        } else if (p.intervall === "monatlich") {
            monatlich = betrag;
        } else if (p.intervall === "alle-x-monate") {
            monatlich = betrag / parseFloat(p.anzahl);
        } else if (p.intervall === "alle-x-jahre") {
            monatlich = betrag / (parseFloat(p.anzahl) * 12);
        } else {
            monatlich = 0;
        }

        if (p.typ === "einnahme") {
            einnahmen += monatlich;
        } else {
            ausgaben += monatlich;
        }
    });

    const bilanz = einnahmen - ausgaben;
    const anzeige = document.getElementById("gesamtsumme");

    // ✅ Leeren und neu aufbauen
    anzeige.innerHTML = "";

    // Hilfsfunktion für Spans mit Stil
    function createSpan(text, color, fontWeight = "normal") {
        const span = document.createElement("span");
        span.style.color = color;
        span.style.fontWeight = fontWeight;
        span.textContent = text;
        return span;
    }

    // ✅ Echte Leerzeichen statt &nbsp;
    anzeige.appendChild(createSpan(`Einnahmen: ${einnahmen.toFixed(2)}€ (monatlich)`, "#81c784"));
    anzeige.appendChild(document.createTextNode(" | "));
    anzeige.appendChild(createSpan(`Ausgaben: ${ausgaben.toFixed(2)}€ (monatlich)`, "#e74c3c"));
    anzeige.appendChild(document.createTextNode(" | "));
    anzeige.appendChild(createSpan(`Bilanz: ${bilanz >= 0 ? '+' : ''}${bilanz.toFixed(2)}€ (monatlich)`, bilanz >= 0 ? "#81c784" : "#e74c3c", "bold"));
}

document.getElementById("rechner-btn").addEventListener("click", function () {
    const betrag = parseFloat(document.getElementById("rechner-betrag").value);
    const intervall = document.getElementById("rechner-intervall").value;

    if (isNaN(betrag) || betrag <= 0) {
        alert("Bitte einen gültigen Betrag eingeben!");
        return;
    }

    let proWoche, proMonat, proJahr;

    if (intervall === "täglich") {
        proWoche = betrag * 7;
        proMonat = betrag * 30.44;
        proJahr = betrag * 365;
    } else if (intervall === "werktags") {
        proWoche = betrag * 5;
        proMonat = betrag * 21.7;
        proJahr = betrag * 260;
    } else if (intervall === "wöchentlich") {
        proWoche = betrag;
        proMonat = betrag * 4.33;
        proJahr = betrag * 52;
    } else if (intervall === "monatlich") {
        proWoche = betrag / 4.33;
        proMonat = betrag;
        proJahr = betrag * 12;
    }

    const ergebnis = document.getElementById("rechner-ergebnis");
    ergebnis.style.display = "block";
    ergebnis.innerHTML = `
    <div class="ergebnis-zeile"><span>Pro Woche:</span><span>${proWoche.toFixed(2)}€</span></div>
    <div class="ergebnis-zeile"><span>Pro Monat:</span><span>${proMonat.toFixed(2)}€</span></div>
    <div class="ergebnis-zeile"><span>Pro Jahr:</span><span>${proJahr.toFixed(2)}€</span></div>
  `;
});


let kalenderDatum = new Date();

function alleFaelligkeitenImMonat(jahr, monat) {
    const faelligkeiten = {};

    posten.forEach(p => {
        if (!p.datum) return;

        const d = new Date(p.datum);
        const ende = new Date(jahr, monat + 1, 0);

        // Einmalige Ausgaben
        if (p.intervall === "einmalig") {
            if (d.getFullYear() === jahr && d.getMonth() === monat) {
                const key = d.getDate();
                if (!faelligkeiten[key]) faelligkeiten[key] = [];
                faelligkeiten[key].push(p);
            }
            return;
        }

        // Schutz vor Endlosschleife
        let iterationen = 0;
        const maxIterationen = 100;

        while (d <= ende && iterationen < maxIterationen) {
            iterationen++;

            if (d.getFullYear() === jahr && d.getMonth() === monat) {
                const key = d.getDate();
                if (!faelligkeiten[key]) faelligkeiten[key] = [];
                faelligkeiten[key].push(p);
            }

            if (p.intervall === "wöchentlich") {
                d.setDate(d.getDate() + 7);
            } else if (p.intervall === "monatlich") {
                const tag = d.getDate();
                d.setMonth(d.getMonth() + 1);
                if (d.getDate() !== tag) d.setDate(0);
            } else if (p.intervall === "alle-x-monate") {
                const tag = d.getDate();
                d.setMonth(d.getMonth() + parseInt(p.anzahl));
                if (d.getDate() !== tag) d.setDate(0);
            } else if (p.intervall === "alle-x-jahre") {
                const tag = d.getDate();
                d.setFullYear(d.getFullYear() + parseInt(p.anzahl));
                if (d.getDate() !== tag) d.setDate(0);
            } else {
                break;
            }
        }
    });

    return faelligkeiten;
}

function bautKalender() {
    const jahr = kalenderDatum.getFullYear();
    const monat = kalenderDatum.getMonth();
    const heute = new Date();

    document.getElementById("kalender-titel").textContent =
        kalenderDatum.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

    const kalender = document.getElementById("kalender");
    kalender.innerHTML = "";

    ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach(tag => {
        const zelle = document.createElement("div");
        zelle.className = "kalender-tag-name";
        zelle.textContent = tag;
        kalender.appendChild(zelle);
    });

    const faelligkeiten = alleFaelligkeitenImMonat(jahr, monat);

    const ersterTag = new Date(jahr, monat, 1);
    let startTag = ersterTag.getDay();
    startTag = startTag === 0 ? 6 : startTag - 1;
    for (let i = 0; i < startTag; i++) {
        const leer = document.createElement("div");
        leer.className = "kalender-tag leer";
        kalender.appendChild(leer);
    }

    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    for (let tag = 1; tag <= tageImMonat; tag++) {
        const zelle = document.createElement("div");
        zelle.className = "kalender-tag";

        const istHeute = tag === heute.getDate() &&
            monat === heute.getMonth() &&
            jahr === heute.getFullYear();
        if (istHeute) zelle.classList.add("heute");

        const nummer = document.createElement("div");
        nummer.className = "tag-nummer";
        nummer.textContent = tag;
        zelle.appendChild(nummer);

        if (faelligkeiten[tag]) {
            zelle.classList.add("hat-faelligkeit");
            zelle.style.cursor = "pointer";

            faelligkeiten[tag].forEach(p => {
                const label = document.createElement("div");
                label.className = "kalender-faelligkeit";
                label.textContent = p.name;
                zelle.appendChild(label);
            });

            zelle.addEventListener("click", function () {
                zeigeTagDetail(tag, monat, jahr, faelligkeiten[tag]);
            });
        }

        kalender.appendChild(zelle);
    }
}

function zeigeTagDetail(tag, monat, jahr, posten) {
    const datum = new Date(jahr, monat, tag);
    const datumText = datum.toLocaleDateString("de-DE", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    document.getElementById("tag-detail-titel").textContent = datumText;

    const liste = document.getElementById("tag-detail-liste");
    liste.innerHTML = "";

    posten.forEach(p => {
        const eintrag = document.createElement("li");

        // Text-Teil mit textContent
        const textSpan = document.createElement("span");
        textSpan.textContent = p.name + " — " + p.betrag + "€ — " + formatIntervall(p.intervall, p.anzahl);
        eintrag.appendChild(textSpan);

        // Button mit onclick (hier müssen wir die Parameter escapen für das Attribut)
        const button = document.createElement("button");
        button.className = "kalender-hinzufuegen";
        button.textContent = "📅 Google Calendar";

        // ✅ Parameter escapen für das onclick-Attribut
        const safeName = escapeHtml(p.name);
        const safeBetrag = escapeHtml(p.betrag);
        const safeDatum = `${jahr}-${String(monat + 1).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;

        button.setAttribute("onclick", `zuGoogleKalender('${safeName}', '${safeBetrag}', '${safeDatum}')`);
        eintrag.appendChild(button);

        liste.appendChild(eintrag);
    });

    document.getElementById("tag-detail").style.display = "block";
}

document.getElementById("tag-detail-schliessen").addEventListener("click", function () {
    document.getElementById("tag-detail").style.display = "none";
});

function zuGoogleKalender(name, betrag, datum) {
    // ✅ Parameter nochmal escapen, bevor sie in die URL kommen
    const safeName = encodeURIComponent(name);
    const safeBetrag = encodeURIComponent(betrag);
    const start = datum.replace(/-/g, "");
    const end = datum.replace(/-/g, "");
    const titel = safeName + " — " + safeBetrag + "€";
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titel)}&dates=${start}/${end}`;
    window.open(url, "_blank");
}

document.getElementById("kalender-zurueck").addEventListener("click", function () {
    kalenderDatum.setMonth(kalenderDatum.getMonth() - 1);
    bautKalender();
});

document.getElementById("kalender-vor").addEventListener("click", function () {
    kalenderDatum.setMonth(kalenderDatum.getMonth() + 1);
    bautKalender();
});

bautKalender();

document.getElementById("csv-export-btn").addEventListener("click", function () {
    let csv = "Typ;Name;Betrag;Datum;Intervall\n";

    posten.forEach(function (p) {
        const typ = p.typ === "einnahme" ? "Einnahme" : "Ausgabe";

        // ✅ CSV-Injection Schutz: Prüfen, ob Name mit =, +, -, @ beginnt
        let safeName = p.name;
        if (p.name.startsWith('=') || p.name.startsWith('+') || p.name.startsWith('-') || p.name.startsWith('@')) {
            safeName = "'" + p.name; // Apostroph zwingt Excel, es als Text zu behandeln
        }

        // Auch den Betrag sicher machen (falls jemand dort Formeln eingibt)
        let safeBetrag = p.betrag;
        if (p.betrag.startsWith('=') || p.betrag.startsWith('+') || p.betrag.startsWith('-') || p.betrag.startsWith('@')) {
            safeBetrag = "'" + p.betrag;
        }

        csv += `${typ};${safeName};${safeBetrag}€;${p.datum};${formatIntervall(p.intervall, p.anzahl)}\n`;
    });

    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ausgaben.csv";
    link.click();
});

const tabBtns = document.querySelectorAll(".tab-btn");
const bereiche = {
    erfassen: document.getElementById("bereich-erfassen"),
    posten: document.getElementById("bereich-posten"),
    kalender: document.getElementById("bereich-kalender"),
    rechner: document.getElementById("bereich-rechner")
};

tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
        const ziel = btn.getAttribute("data-tab");

        tabBtns.forEach(b => b.classList.remove("aktiv"));
        btn.classList.add("aktiv");

        if (window.innerWidth <= 600) {
            Object.values(bereiche).forEach(b => b.style.display = "none");
            bereiche[ziel].style.display = "block";

            if (ziel === "kalender") bautKalender();
        }
    });
});

