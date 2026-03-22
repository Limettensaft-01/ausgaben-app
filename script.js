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
window.addEventListener("load", function () {
    document.getElementById("bilanz-monat").value = new Date().getMonth();
    berechneGesamtsumme();
    zeichneChart();
    bautKalender();
    zeigeEinkaufListe();
    berechneEinkaufStatistik();
});


form.addEventListener("submit", function (event) {
    event.preventDefault();

    const neuerPosten = {
        typ: document.getElementById("typ").value,
        kategorie: document.getElementById("kategorie").value,
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
    zeichneChart();
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
    if (p.typ === "einkauf") return; // Einkäufe nicht in der Postenliste anzeigen
    if (p.vonEinkauf) return;
    const einkaufEintrag = document.createElement("li");

    einkaufEintrag.style.cursor = "pointer";
    einkaufEintrag.addEventListener("click", function (e) {
        if (e.target.classList.contains("loeschen")) return;
        zeigeDetail(p);
    });

    if (p.vonEinkauf) einkaufEintrag.classList.add("einkauf-eintrag");
    einkaufEintrag.classList.add(p.typ === "einnahme" ? "einnahme-eintrag" : "ausgabe-eintrag");
    const naechstesDatum = berechneNaechstesDatum(p.datum, p.intervall, p.anzahl);

    // Name
    const nameSpan = document.createElement("span");
    nameSpan.className = "tag name";
    nameSpan.textContent = p.name; // ✅ Automatisch sicher!
    einkaufEintrag.appendChild(nameSpan);

    // Betrag
    const betragSpan = document.createElement("span");
    betragSpan.className = "tag betrag";
    betragSpan.textContent = p.betrag + "€"; // ✅ Automatisch sicher!
    einkaufEintrag.appendChild(betragSpan);

    // Intervall
    const intervallSpan = document.createElement("span");
    intervallSpan.className = "tag intervall";
    intervallSpan.textContent = p.vonEinkauf ? "🛒 Einkauf" : formatIntervall(p.intervall, p.anzahl);
    einkaufEintrag.appendChild(intervallSpan);

    const kategorieSpan = document.createElement("span");
    kategorieSpan.className = "tag kategorie";
    kategorieSpan.textContent = formatKategorie(p.kategorie);
    einkaufEintrag.appendChild(kategorieSpan);

    // Fälligkeit (optional)
    if (p.intervall === "einmalig" && p.datum) {
        const datumSpan = document.createElement("span");
        datumSpan.className = "tag einmalig-datum";
        const d = new Date(p.datum);
        const istMobil2 = window.innerWidth <= 600;
        datumSpan.textContent = "📌 " + (istMobil2 ? d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) : d.toLocaleDateString("de-DE"));
        einkaufEintrag.appendChild(datumSpan);
    } else if (naechstesDatum) {
        const datumSpan = document.createElement("span");
        datumSpan.className = "tag faelligkeit";
        const istMobil = window.innerWidth <= 600;
        datumSpan.textContent = "📅 " + (istMobil ? naechstesDatum.split('.').slice(0, 2).join('.') + '.' : naechstesDatum);
        einkaufEintrag.appendChild(datumSpan);
    } else {
        const placeholder = document.createElement("span");
        placeholder.className = "tag";
        placeholder.style.visibility = "hidden";
        einkaufEintrag.appendChild(placeholder);
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
        zeichneChart();
    };

    einkaufEintrag.appendChild(loeschenBtn);
    liste.appendChild(einkaufEintrag);

    // ✅ Trennlinie nach dem letzten Einnahmen-Eintrag
    if (p.typ === "einnahme" && index < posten.length - 1 && posten[index + 1].typ === "ausgabe") {
        const trenner = document.createElement("hr");
        trenner.className = "trennlinie";
        liste.appendChild(trenner);
    }

}

function formatKategorie(kategorie) {
    const kategorien = {
        wohnen: "🏠",
        essen: "🍔",
        transport: "🚗",
        freizeit: "🎮",
        gesundheit: "💊",
        kleidung: "👕",
        technik: "📱",
        einnahme: "💰",
        sonstiges: "📦"
    };
    return kategorien[kategorie] || "📦";
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
    const monat = parseInt(document.getElementById("bilanz-monat").value);
    const jahr = parseInt(document.getElementById("bilanz-jahr").value);

    let monatsEinnahmen = 0;
    let monatsAusgaben = 0;
    let jahresEinnahmen = 0;
    let jahresAusgaben = 0;
    let einkaufAusgaben = 0;
    let einkaufAusgabenJahr = 0;

    const heute = new Date();
    const aktuellerMonat = heute.getMonth();
    const aktuellesJahr = heute.getFullYear();

    posten.forEach(function (p) {
        if (p.typ === "einkauf" && p.abgehakt && p.abgehaktDatum) {
            const abgehaktDatum = new Date(p.abgehaktDatum);
            if (abgehaktDatum.getMonth() === monat &&
                abgehaktDatum.getFullYear() === jahr) {
                einkaufAusgaben += parseFloat(p.betrag) || 0;
            }
            if (abgehaktDatum.getFullYear() === jahr) {
                einkaufAusgabenJahr += parseFloat(p.betrag) || 0;
            }
            return;
        }

        if (p.vonEinkauf) return;
        if (!p.datum) return;
        const betrag = parseFloat(p.betrag) || 0;

        // Alle Fälligkeiten im gewählten Monat
        const faelligkeitenMonat = alleFaelligkeitenImMonat(jahr, monat);
        const faelltInMonat = Object.values(faelligkeitenMonat).flat().some(f => f === p);
        if (faelltInMonat) {
            if (p.typ === "einnahme") monatsEinnahmen += betrag;
            else if (p.typ === "ausgabe") monatsAusgaben += betrag;
        }

        // Alle Fälligkeiten im gewählten Jahr
        for (let m = 0; m < 12; m++) {
            const faelligkeitenJahr = alleFaelligkeitenImMonat(jahr, m);
            const faelltInJahr = Object.values(faelligkeitenJahr).flat().some(f => f === p);
            if (faelltInJahr) {
                if (p.typ === "einnahme") jahresEinnahmen += betrag;
                else if (p.typ === "ausgabe") jahresAusgaben += betrag;
            }
        }
    });

    const monatsBilanz = monatsEinnahmen - (monatsAusgaben + einkaufAusgaben);
    const jahresBilanz = jahresEinnahmen - (jahresAusgaben + einkaufAusgabenJahr);

    document.getElementById("bilanz-einnahmen").textContent = monatsEinnahmen.toFixed(2) + "€";
    document.getElementById("bilanz-ausgaben").textContent = (monatsAusgaben + einkaufAusgaben).toFixed(2) + "€";
    document.getElementById("bilanz-gesamt").textContent = (monatsBilanz >= 0 ? "+" : "") + monatsBilanz.toFixed(2) + "€";
    document.getElementById("bilanz-gesamt").style.color = monatsBilanz >= 0 ? "#81c784" : "#e74c3c";

    document.getElementById("bilanz-jahr-einnahmen").textContent = jahresEinnahmen.toFixed(2) + "€";
    document.getElementById("bilanz-jahr-ausgaben").textContent = (jahresAusgaben + einkaufAusgabenJahr).toFixed(2) + "€";
    document.getElementById("bilanz-jahr-gesamt").textContent = (jahresBilanz >= 0 ? "+" : "") + jahresBilanz.toFixed(2) + "€";
    document.getElementById("bilanz-jahr-gesamt").style.color = jahresBilanz >= 0 ? "#81c784" : "#e74c3c";

    document.getElementById("bilanz-einkaufe").textContent = einkaufAusgaben.toFixed(2) + "€";
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

// Jahres-Dropdown befüllen und Standardwerte setzen
const bilanzJahrSelect = document.getElementById("bilanz-jahr");
const aktuellesJahrBilanz = new Date().getFullYear();
for (let j = aktuellesJahrBilanz - 2; j <= aktuellesJahrBilanz + 5; j++) {
    const option = document.createElement("option");
    option.value = j;
    option.textContent = j;
    if (j === aktuellesJahrBilanz) option.selected = true;
    bilanzJahrSelect.appendChild(option);
}

// Aktuellen Monat vorauswählen
document.getElementById("bilanz-monat").value = new Date().getMonth();

// Bei Änderung neu berechnen
document.getElementById("bilanz-monat").addEventListener("change", function () {
    berechneGesamtsumme();
    zeichneChart();
});
document.getElementById("bilanz-jahr").addEventListener("change", function () {
    berechneGesamtsumme();
    zeichneChart();
});

function alleFaelligkeitenImMonat(jahr, monat) {
    const faelligkeiten = {};

    posten.forEach(p => {
        if (!p.datum) return;
        if (p.typ === "einkauf") return;
        if (p.vonEinkauf) return;

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

// ============================================
// BACKUP EXPORT & IMPORT
// ============================================

// Backup herunterladen (JSON)
document.getElementById("backup-export-btn").addEventListener("click", function () {
    const backup = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        posten: posten
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);
});

// Backup wiederherstellen (JSON)
document.getElementById("backup-import-btn").addEventListener("click", function () {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const backup = JSON.parse(e.target.result);

                // Validierung
                if (!backup.posten || !Array.isArray(backup.posten)) {
                    alert("❌ Ungültiges Backup-Format!");
                    return;
                }

                // Bestätigung
                const count = backup.posten.length;
                if (confirm(`📥 ${count} Einträge importieren?\n\n⚠️ Aktuelle Daten werden überschrieben!`)) {
                    posten = backup.posten;
                    localStorage.setItem("posten", JSON.stringify(posten));

                    // UI aktualisieren
                    liste.innerHTML = "";
                    sortierePosten();
                    posten.forEach((p, i) => zeigePosten(p, i));
                    berechneGesamtsumme();
                    zeichneChart();

                    alert("✅ Backup erfolgreich importiert!");
                }
            } catch (error) {
                alert("❌ Fehler beim Lesen der Datei:\n" + error.message);
            }
        };

        reader.readAsText(file);
    };

    input.click();
});


// ============================================
// EINKAUFLISTE
// ============================================

// Einkauf hinzufügen
document.getElementById("einkauf-form").addEventListener("submit", function (event) {
    event.preventDefault();

    const neuerEinkauf = {
        typ: "einkauf",
        name: document.getElementById("einkauf-name").value,
        betrag: document.getElementById("einkauf-betrag").value,
        notiz: document.getElementById("einkauf-notiz").value,
        abgehakt: false,
        abgehaktDatum: null
    };

    posten.push(neuerEinkauf);
    localStorage.setItem("posten", JSON.stringify(posten));
    zeigeEinkaufListe();
    berechneEinkaufStatistik();
    berechneGesamtsumme();
    zeichneChart(); // Monatsbilanz aktualisieren
    document.getElementById("einkauf-form").reset();
});

// Einkaufsliste anzeigen
function zeigeEinkaufListe() {
    const liste = document.getElementById("einkauf-liste");
    liste.innerHTML = "";

    const einkaufen = posten.filter(p => p.typ === "einkauf" && !p.versteckt);

    // Sortieren: zuerst ungehäckt, dann nach Datum
    einkaufen.sort((a, b) => {
        if (a.abgehakt !== b.abgehakt) return a.abgehakt ? 1 : -1;
        return new Date(a.datum || 0) - new Date(b.datum || 0);
    });

    if (einkaufen.length === 0) {
        liste.innerHTML = "<li style='text-align:center;color:#666;'>Noch keine Artikel in der Einkaufsliste</li>";
        return;
    }

    einkaufen.forEach((p, index) => {
        const eintrag = document.createElement("li");
        eintrag.className = p.abgehakt ? "einkauf-abgehakt" : "einkauf-offen";

        // Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = p.abgehakt;
        checkbox.addEventListener("change", function () {
            p.abgehakt = this.checked;
            p.abgehaktDatum = this.checked ? new Date().toISOString().split('T')[0] : null;

            if (this.checked) {
                // Als einmaligen Posten hinzufügen
                const neuerPosten = {
                    typ: "ausgabe",
                    name: p.name,
                    betrag: p.betrag,
                    datum: p.abgehaktDatum, // Abhak-Datum als Datum
                    intervall: "einmalig",
                    anzahl: 1,
                    vonEinkauf: true // Markierung damit wir ihn später finden können
                };
                posten.push(neuerPosten);
            } else {
                // Posten wieder entfernen wenn Haken weggenommen
                const index = posten.findIndex(x => x.vonEinkauf && x.name === p.name && x.datum === p.abgehaktDatum);
                if (index !== -1) posten.splice(index, 1);
                p.abgehaktDatum = null;
            }

            localStorage.setItem("posten", JSON.stringify(posten));
            const postenListe = document.getElementById("posten-liste");
            postenListe.innerHTML = "";
            sortierePosten();
            posten.forEach((pp, i) => zeigePosten(pp, i));
            zeigeEinkaufListe();
            berechneEinkaufStatistik();
            berechneGesamtsumme();
            zeichneChart();
        });
        eintrag.appendChild(checkbox);

        // Name
        const nameSpan = document.createElement("span");
        nameSpan.className = "einkauf-name";
        nameSpan.textContent = p.name;
        eintrag.appendChild(nameSpan);

        // Betrag
        const betragSpan = document.createElement("span");
        betragSpan.className = "einkauf-betrag";
        betragSpan.textContent = p.betrag + "€";
        eintrag.appendChild(betragSpan);

        // Datum
        const datumSpan = document.createElement("span");
        datumSpan.className = "einkauf-datum";
        if (p.notiz) {
            if (p.notiz.startsWith("http")) {
                const link = document.createElement("a");
                link.href = p.notiz;
                link.textContent = "🔗 Link";
                link.target = "_blank";
                link.style.color = "#4fc3f7";
                eintrag.appendChild(link);
            } else {
                datumSpan.textContent = `📝 ${p.notiz}`;
                eintrag.appendChild(datumSpan);
            }
        }
        eintrag.appendChild(datumSpan);

        // Abgehakt-Datum anzeigen
        if (p.abgehakt && p.abgehaktDatum) {
            const abgehaktSpan = document.createElement("span");
            abgehaktSpan.className = "einkauf-abgehakt-datum";
            abgehaktSpan.textContent = ` [abgehakt: ${p.abgehaktDatum}]`;
            eintrag.appendChild(abgehaktSpan);
        }

        // Löschen-Button
        const loeschenBtn = document.createElement("button");
        loeschenBtn.textContent = "✕";
        loeschenBtn.className = "loeschen";
        loeschenBtn.onclick = function () {
            if (p.abgehakt) {
                p.versteckt = true;
            } else {
            posten.splice(posten.indexOf(p), 1);
            }
            localStorage.setItem("posten", JSON.stringify(posten));
            zeigeEinkaufListe();
            berechneEinkaufStatistik();
            berechneGesamtsumme();
            zeichneChart();
        };
        eintrag.appendChild(loeschenBtn);

        liste.appendChild(eintrag);
    });
}

// Statistik berechnen
function berechneEinkaufStatistik() {
    const einkaufen = posten.filter(p => p.typ === "einkauf" && !p.versteckt);

    let geplant = 0;
    let getatigt = 0;

    const heute = new Date();
    const aktuellerMonat = heute.getMonth();
    const aktuellesJahr = heute.getFullYear();

    einkaufen.forEach(p => {
        if (p.abgehakt && p.abgehaktDatum) {
            const abgehaktDatum = new Date(p.abgehaktDatum);
            if (abgehaktDatum.getMonth() === aktuellerMonat && abgehaktDatum.getFullYear() === aktuellesJahr) {
                getatigt += parseFloat(p.betrag);
            }
        } else {
            geplant += parseFloat(p.betrag);
        }
    });

    document.getElementById("einkauf-geplant").textContent = geplant.toFixed(2) + "€";
    document.getElementById("einkauf-getatigt").textContent = getatigt.toFixed(2) + "€";
}

const tabBtns = document.querySelectorAll(".tab-btn");
const bereiche = {
    erfassen: document.getElementById("bereich-erfassen"),
    posten: document.getElementById("bereich-posten"),
    kalender: document.getElementById("bereich-kalender"),
    rechner: document.getElementById("bereich-rechner"),
    einkauf: document.getElementById("bereich-einkauf"), // ✅ NEU
    einstellungen: document.getElementById("bereich-einstellungen")
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
            if (ziel === "einkauf") zeigeEinkaufListe(); // ✅ NEU
        }
    });
});

window.addEventListener("load", function () {
    bautKalender();
    zeichneChart();
});

function zeigeDetail(p) {
    document.getElementById("detail-name").textContent = p.name + " — " + p.betrag + "€";

    const inhalt = document.getElementById("detail-inhalt");
    inhalt.innerHTML = "";

    const felder = [
        { label: "Typ", wert: p.typ === "einnahme" ? "💰 Einnahme" : "💸 Ausgabe" },
        { label: "Betrag", wert: p.betrag + "€" },
        { label: "Kategorie", wert: formatKategorie(p.kategorie) + " " + formatKategorieName(p.kategorie) },
        { label: "Intervall", wert: p.vonEinkauf ? "🛒 Einkauf" : formatIntervall(p.intervall, p.anzahl) },
        { label: "Datum", wert: p.datum ? new Date(p.datum).toLocaleDateString("de-DE") : "—" },
        { label: "Nächste Fälligkeit", wert: berechneNaechstesDatum(p.datum, p.intervall, p.anzahl) || "—" }
    ];

    felder.forEach(f => {
        const karte = document.createElement("div");
        karte.className = "detail-karte";
        karte.innerHTML = `
      <div class="detail-karte-label">${f.label}</div>
      <div class="detail-karte-wert">${f.wert}</div>
    `;
        inhalt.appendChild(karte);
    });

    document.getElementById("detail-overlay").style.display = "block";
    document.getElementById("detail-panel").classList.add("offen");
}

function schliesseDetail() {
    document.getElementById("detail-overlay").style.display = "none";
    document.getElementById("detail-panel").classList.remove("offen");
}

document.getElementById("detail-schliessen").addEventListener("click", schliesseDetail);
document.getElementById("detail-overlay").addEventListener("click", schliesseDetail);

function formatKategorieName(kategorie) {
    const kategorien = {
        wohnen: "Wohnen",
        essen: "Essen & Trinken",
        transport: "Transport",
        freizeit: "Freizeit",
        gesundheit: "Gesundheit",
        kleidung: "Kleidung",
        technik: "Technik",
        einnahme: "Einnahme",
        sonstiges: "Sonstiges"
    };
    return kategorien[kategorie] || "Sonstiges";

    
}

let chartSegmente = [];

function zeichneChart() {
    const canvas = document.getElementById("ausgaben-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const monat = parseInt(document.getElementById("bilanz-monat").value);
    const jahr = parseInt(document.getElementById("bilanz-jahr").value);

    const kategoriefarben = {
        wohnen: "#4fc3f7", essen: "#81c784", transport: "#ffb74d",
        freizeit: "#ce93d8", gesundheit: "#ef9a9a", kleidung: "#80cbc4",
        technik: "#90caf9", einnahme: "#a5d6a7", sonstiges: "#bcaaa4"
    };

    const kategorienSummen = {};
    const faelligkeiten = alleFaelligkeitenImMonat(jahr, monat);
    Object.values(faelligkeiten).flat().forEach(p => {
        if (p.typ !== "ausgabe") return;
        const kat = p.kategorie || "sonstiges";
        kategorienSummen[kat] = (kategorienSummen[kat] || 0) + parseFloat(p.betrag);
    });

    const total = Object.values(kategorienSummen).reduce((a, b) => a + b, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    chartSegmente = [];

    if (total === 0) {
        ctx.fillStyle = "#444";
        ctx.beginPath();
        ctx.arc(60, 60, 50, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    let startWinkel = -Math.PI / 2;
    Object.entries(kategorienSummen).forEach(([kat, summe]) => {
        const winkel = (summe / total) * Math.PI * 2;

        chartSegmente.push({
            kat,
            summe,
            startWinkel,
            endWinkel: startWinkel + winkel,
            farbe: kategoriefarben[kat] || "#888"
        });

        ctx.beginPath();
        ctx.moveTo(60, 60);
        ctx.arc(60, 60, 50, startWinkel, startWinkel + winkel);
        ctx.closePath();
        ctx.fillStyle = kategoriefarben[kat] || "#888";
        ctx.fill();
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = 2;
        ctx.stroke();
        startWinkel += winkel;
    });

    ctx.beginPath();
    ctx.arc(60, 60, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#202020";
    ctx.fill();
}

document.getElementById("ausgaben-chart").addEventListener("click", function (e) {
    const canvas = this;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - 60;
    const y = e.clientY - rect.top - 60;
    const distanz = Math.sqrt(x * x + y * y);

    if (distanz < 28 || distanz > 50) return;

    let winkel = Math.atan2(y, x);
    if (winkel < -Math.PI / 2) winkel += Math.PI * 2;

    const segment = chartSegmente.find(s => {
        let start = s.startWinkel;
        let end = s.endWinkel;
        if (start < -Math.PI / 2) start += Math.PI * 2;
        if (end < -Math.PI / 2) end += Math.PI * 2;
        return winkel >= start && winkel <= end;
    });

    if (!segment) return;

    document.getElementById("detail-name").textContent =
        formatKategorie(segment.kat) + " " + formatKategorieName(segment.kat);

    const inhalt = document.getElementById("detail-inhalt");
    inhalt.innerHTML = "";

    const monat = parseInt(document.getElementById("bilanz-monat").value);
    const jahr = parseInt(document.getElementById("bilanz-jahr").value);
    const faelligkeiten = alleFaelligkeitenImMonat(jahr, monat);

    const allePosten = Object.values(faelligkeiten).flat().filter(p =>
        p.typ === "ausgabe" && (p.kategorie || "sonstiges") === segment.kat
    );

    const posten = allePosten.filter((p, index, self) =>
        index === self.indexOf(p)
    );

    const gesamtKarte = document.createElement("div");
    gesamtKarte.className = "detail-karte";
    gesamtKarte.style.gridColumn = "1 / -1";
    gesamtKarte.innerHTML = `
        <div class="detail-karte-label">Gesamt diesen Monat</div>
        <div class="detail-karte-wert" style="color: ${segment.farbe}; font-size: 18px;">${segment.summe.toFixed(2)}€</div>
    `;
    inhalt.appendChild(gesamtKarte);

    posten.forEach(p => {
        const karte = document.createElement("div");
        karte.className = "detail-karte";
        karte.innerHTML = `
            <div class="detail-karte-label">${p.name}</div>
            <div class="detail-karte-wert">${p.betrag}€ — ${formatIntervall(p.intervall, p.anzahl)}</div>
        `;
        inhalt.appendChild(karte);
    });

    document.getElementById("detail-overlay").style.display = "block";
    document.getElementById("detail-panel").classList.add("offen");
});

document.getElementById("einkaufe-karte").addEventListener("click", function () {
    const heute = new Date();
    const monat = parseInt(document.getElementById("bilanz-monat").value);
    const jahr = parseInt(document.getElementById("bilanz-jahr").value);

    const monatsEinkaufe = posten.filter(p =>
        p.typ === "einkauf" && p.abgehakt && p.abgehaktDatum &&
        new Date(p.abgehaktDatum).getMonth() === monat &&
        new Date(p.abgehaktDatum).getFullYear() === jahr
    );

    document.getElementById("detail-name").textContent = "🛒 Einkäufe diesen Monat";
    const inhalt = document.getElementById("detail-inhalt");
    inhalt.innerHTML = "";

    if (monatsEinkaufe.length === 0) {
        const leer = document.createElement("div");
        leer.className = "detail-karte";
        leer.style.gridColumn = "1 / -1";
        leer.innerHTML = `<div class="detail-karte-wert">Keine Einkäufe diesen Monat</div>`;
        inhalt.appendChild(leer);
    } else {
        let gesamt = 0;
        monatsEinkaufe.forEach(p => {
            gesamt += parseFloat(p.betrag) || 0;
            const karte = document.createElement("div");
            karte.className = "detail-karte";
            karte.style.cursor = "pointer";
            karte.style.gridColumn = "1 / -1";
            karte.innerHTML = `
                <div class="detail-karte-label">${p.name} — ${p.abgehaktDatum}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="detail-karte-wert">${parseFloat(p.betrag).toFixed(2)}€</div>
                    <button style="background:#e74c3c; padding:2px 8px; font-size:11px; border:none; border-radius:4px; color:white; cursor:pointer;">↩ Rückgängig</button>
                </div>
            `;
            karte.querySelector("button").addEventListener("click", function (e) {
                e.stopPropagation();
                p.abgehakt = false;
                p.abgehaktDatum = null;
                localStorage.setItem("posten", JSON.stringify(posten));
                schliesseDetail();
                zeigeEinkaufListe();
                berechneEinkaufStatistik();
                berechneGesamtsumme();
                zeichneChart();
            });    
            inhalt.appendChild(karte);
        });

        const gesamtKarte = document.createElement("div");
        gesamtKarte.className = "detail-karte";
        gesamtKarte.style.gridColumn = "1 / -1";
        gesamtKarte.style.borderLeft = "3px solid #4fc3f7";
        gesamtKarte.innerHTML = `
            <div class="detail-karte-label">Gesamt</div>
            <div class="detail-karte-wert" style="color: #4fc3f7">${gesamt.toFixed(2)}€</div>
        `;
        inhalt.appendChild(gesamtKarte);
    }

    document.getElementById("detail-overlay").style.display = "block";
    document.getElementById("detail-panel").classList.add("offen");
});

document.getElementById("einkauf-leeren-btn").addEventListener("click", function () {
    if (confirm("Alle Einkäufe aus der Liste entfernen?")) {
        // Abgehakte nur verstecken, nicht-abgehakte komplett löschen
        posten.forEach(p => {
            if (p.typ === "einkauf" && p.abgehakt) {
                p.versteckt = true;
            }
        });
        posten = posten.filter(p => !(p.typ === "einkauf" && !p.abgehakt));
        localStorage.setItem("posten", JSON.stringify(posten));
        zeigeEinkaufListe();
        berechneEinkaufStatistik();
        berechneGesamtsumme();
        zeichneChart();
    }
});