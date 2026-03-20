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


// Beim Laden der Seite: gespeicherte Posten anzeigen
let posten = JSON.parse(localStorage.getItem("posten")) || [];
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
    localStorage.setItem("posten", JSON.stringify(posten));
    zeigePosten(neuerPosten, posten.length - 1);
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
        localStorage.setItem("posten", JSON.stringify(posten));
        liste.innerHTML = "";
        posten.forEach((p, i) => zeigePosten(p, i));
        berechneGesamtsumme();
    };

    eintrag.appendChild(loeschenBtn);
    liste.appendChild(eintrag);
}

function berechneNaechstesDatum(datum, intervall, anzahl) {
    if (!datum || intervall === "einmalig") return null;

    const d = new Date(datum);
    const heute = new Date();

    while (d <= heute) {
        if (intervall === "wöchentlich") {
            d.setDate(d.getDate() + 7);
        } else if (intervall === "monatlich") {
            d.setMonth(d.getMonth() + 1);
        } else if (intervall === "alle-x-monate") {
            d.setMonth(d.getMonth() + parseInt(anzahl));
        } else if (intervall === "alle-x-jahre") {
            d.setFullYear(d.getFullYear() + parseInt(anzahl));
        }
    }

    return d.toLocaleDateString("de-DE");
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
        }

        if (p.typ === "einnahme") {
            einnahmen += monatlich;
        } else {
            ausgaben += monatlich;
        }
    });

    const bilanz = einnahmen - ausgaben;
    const anzeige = document.getElementById("gesamtsumme");

    // ✅ Sicher: textContent statt innerHTML
    anzeige.innerHTML = ""; // Erst leeren

    // Hilfsfunktion für Spans mit Stil
    function createSpan(text, color, fontWeight = "normal") {
        const span = document.createElement("span");
        span.style.color = color;
        span.style.fontWeight = fontWeight;
        span.textContent = text;
        return span;
    }

    // 1. Einnahmen
    anzeige.appendChild(createSpan(`Einnahmen: ${einnahmen.toFixed(2)}€`, "#81c784"));

    // Trenner
    anzeige.appendChild(document.createTextNode(" &nbsp;|&nbsp; "));

    // 2. Ausgaben
    anzeige.appendChild(createSpan(`Ausgaben: ${ausgaben.toFixed(2)}€`, "#e74c3c"));

    // Trenner
    anzeige.appendChild(document.createTextNode(" &nbsp;|&nbsp; "));

    // 3. Bilanz (Farbe dynamisch)
    const bilanzColor = bilanz >= 0 ? "#81c784" : "#e74c3c";
    const bilanzPrefix = bilanz >= 0 ? "+" : "";
    anzeige.appendChild(createSpan(`Bilanz: ${bilanzPrefix}${bilanz.toFixed(2)}€`, bilanzColor, "bold"));
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
        if (!p.datum || p.intervall === "einmalig") return;

        const d = new Date(p.datum);
        const ende = new Date(jahr, monat + 1, 0); // letzter Tag des Monats

        while (d <= ende) {
            if (d.getFullYear() === jahr && d.getMonth() === monat) {
                const key = d.getDate();
                if (!faelligkeiten[key]) faelligkeiten[key] = [];
                faelligkeiten[key].push(p);
            }

            if (p.intervall === "wöchentlich") {
                d.setDate(d.getDate() + 7);
            } else if (p.intervall === "monatlich") {
                d.setMonth(d.getMonth() + 1);
            } else if (p.intervall === "alle-x-monate") {
                d.setMonth(d.getMonth() + parseInt(p.anzahl));
            } else if (p.intervall === "alle-x-jahre") {
                d.setFullYear(d.getFullYear() + parseInt(p.anzahl));
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

