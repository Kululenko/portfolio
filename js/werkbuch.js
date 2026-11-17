/* Werkbuch. Kleine Helfer ohne Abhaengigkeiten und ohne Anfragen nach aussen.
   1 leiste   mitlaufende Leiste: gruener Fortschrittsstrich auf jeder Seite,
              auf der Startseite zusaetzlich der Abschnitt, in dem man liest
   2 videos   Videos starten erst, wenn sie 600 ms im Blickfeld sind, nie bei Datensparmodus,
              2G, "weniger Bewegung" oder unter 700 px Breite; eigener Knopf zum Abspielen
              und Anhalten, er steht rechts in der Zeile am Rahmen (.abzug__kopf), nie auf dem Bild.
              Unter 700 px oeffnet "Abspielen" das Video im Vollbild (Querformat quer), wo es das
              Geraet erlaubt; sonst spielt es wie bisher im Rahmen. Fuer das Vollbild nimmt es die
              grosse Datei (source ohne media), am iPhone spielt das Geraet es selbst im Vollbild
   3 stift    Stiftmarken: Kreis, Pfeil und Notiz aus data-kreis am figure
   4 lupe     Bilder gross im Dialog (Esc schliesst, Fokus bleibt im Dialog).
              Am Handy oeffnen Querformate und grosse Hochformate gleich in der grossen Stufe,
              Handy-Aufnahmen (data-lupe-art="handy") in Fensterbreite
   5 falten   weitere Bilder einer Reihe am Handy eingeklappt (data-falten);
              nach dem Aufklappen rueckt das erste neue Bild ins Blickfeld
   6 kopieren Knoepfe "Adresse kopieren" (button[data-kopieren], auch mehrere je Seite),
              nur mit Zwischenablage
   7 weich    weiches Scrollen fuer Sprunglinks erst nach dem Laden, nie bei "weniger Bewegung"
              (der Sprung auf index.html#<key> beim Laden bleibt sofort)
   Ohne JavaScript bleibt alles lesbar: Videos als Posterbild mit Link "Video oeffnen",
   Bilder als Links auf die grosse Datei, Notizen als Text unter dem Bild,
   "Fuer Entwickler: Aufbau" als details. */
(function () {
  "use strict";

  var ruhig = window.matchMedia("(prefers-reduced-motion: reduce)");
  var schmal = window.matchMedia("(max-width: 699.98px)");
  var kannBeobachten = "IntersectionObserver" in window;
  var SVG = "http://www.w3.org/2000/svg";

  function alle(auswahl, wurzel) { return Array.prototype.slice.call((wurzel || document).querySelectorAll(auswahl)); }

  /* ---------- 1 Leiste ---------- */
  function leiste() {
    var balken = document.querySelector(".leiste");
    if (!balken) { return; }

    // Fortschrittsstrich: steht er nicht im HTML, setzt ihn das Script
    if (!balken.querySelector(".leiste__fortschritt")) {
      var strich = document.createElement("div");
      strich.className = "leiste__fortschritt";
      strich.setAttribute("aria-hidden", "true");
      strich.appendChild(document.createElement("span"));
      balken.appendChild(strich);
    }

    // Startseite: Wege mit Ziel auf dieser Seite. Fallstudien und Unterseiten haben keine.
    var wege = [];
    if (!balken.classList.contains("leiste--fall")) {
      alle(".leiste__wege a[href^='#']", balken).forEach(function (a) {
        var id = a.getAttribute("href").slice(1);
        var ziel = id ? document.getElementById(decodeURIComponent(id)) : null;
        if (ziel) { wege.push({ link: a, ziel: ziel }); }
      });
    }

    var wurzel = document.documentElement;
    var wartet = false;
    var aktiv = null;

    function markieren(neu) {
      if (neu === aktiv) { return; }
      if (aktiv) { aktiv.link.removeAttribute("aria-current"); }
      if (neu) { neu.link.setAttribute("aria-current", "true"); }
      aktiv = neu;
    }

    function messen() {
      wartet = false;
      var hoehe = window.innerHeight;
      var weg = wurzel.scrollHeight - hoehe;
      var y = window.pageYOffset || wurzel.scrollTop || 0;
      var anteil = weg > 0 ? Math.min(1, Math.max(0, y / weg)) : 0;
      balken.style.setProperty("--fortschritt", anteil.toFixed(3));
      if (!wege.length) { return; }

      // Messlinie im oberen Drittel unter der Leiste: Abschnitt, der sie gerade kreuzt
      var linie = balken.offsetHeight + Math.round(hoehe * 0.3);
      var neu = null;
      for (var i = 0; i < wege.length; i++) {
        var r = wege[i].ziel.getBoundingClientRect();
        if (r.top <= linie && r.bottom > linie) { neu = wege[i]; }
      }
      // Am Seitenende gilt der letzte sichtbare Abschnitt (Kontakt ist kurz und erreicht die Linie oft nicht)
      if (weg > 0 && y >= weg - 4) {
        for (var j = wege.length - 1; j >= 0; j--) {
          if (wege[j].ziel.getBoundingClientRect().top < hoehe) { neu = wege[j]; break; }
        }
      }
      markieren(neu);
    }

    function anstossen() { if (!wartet) { wartet = true; window.requestAnimationFrame(messen); } }
    window.addEventListener("scroll", anstossen, { passive: true });
    window.addEventListener("resize", anstossen);
    window.addEventListener("load", anstossen);
    messen();
  }

  /* ---------- 2 Videos ---------- */
  // Datensparmodus oder sehr langsames Netz: nichts startet von selbst
  function sparen() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData || /2g$/.test(c.effectiveType || "")));
  }

  // Vollbild am Handy (G10). Die Aufnahmen sind vom Rechner, in 340 px Breite ist ihre Schrift nicht lesbar.
  // Jede Schnittstelle wird vorher abgefragt; fehlt sie oder lehnt das Geraet ab, spielt das Video im Rahmen.
  //   Android, iPad, Firefox: Element-Vollbild (requestFullscreen, aelter webkitRequestFullscreen),
  //                           danach Querformat sperren, wenn die Aufnahme quer ist
  //   iPhone:                 nur das Video selbst (webkitEnterFullscreen), erst wenn seine Daten da sind
  function imVollbild() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function vollbild(v) {
    var quer = (parseFloat(v.getAttribute("width")) || 0) > (parseFloat(v.getAttribute("height")) || 0);
    function drehen() {
      if (!quer) { return; }
      try {
        var o = window.screen && screen.orientation;
        if (o && o.lock) {
          var q = o.lock("landscape");
          if (q && q.catch) { q.catch(function () { /* Drehen nicht erlaubt: bleibt, wie das Geraet steht */ }); }
        }
      } catch (e) { /* keine Sperre moeglich */ }
    }
    function nurVideo() {
      if (!v.webkitEnterFullscreen) { return; }
      function rein() {
        // schon im Vollbild (das Geraet spielt ohne playsinline selbst im Vollbild): nichts zu tun
        if (v.webkitDisplayingFullscreen) { return; }
        try { v.webkitEnterFullscreen(); } catch (e) { /* bleibt im Rahmen */ }
      }
      if (v.readyState >= 1) { rein(); return; }
      if (v.__wartetAufVollbild) { return; }
      v.__wartetAufVollbild = true;
      v.addEventListener("loadedmetadata", function () {
        v.__wartetAufVollbild = false;
        // wer inzwischen "Anhalten" gedrueckt hat, bekommt kein Vollbild
        if (!v.paused) { rein(); }
      }, { once: true });
    }
    var erlaubt = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    try {
      if (erlaubt && v.requestFullscreen) {
        var p = v.requestFullscreen();
        if (p && p.then) { p.then(drehen, nurVideo); } else { drehen(); }
        return;
      }
      if (erlaubt && v.webkitRequestFullscreen) {
        v.webkitRequestFullscreen();
        drehen();
        return;
      }
    } catch (e) { /* weiter mit dem Weg fuer das iPhone */ }
    nurVideo();
  }

  function videos() {
    var clips = alle(".clip video");
    if (!clips.length) { return; }
    var WARTEN = 600;

    function abspielen(v) {
      var p = v.play();
      if (p && p.catch) { p.catch(function () { /* Start nicht erlaubt: Poster bleibt stehen */ }); }
    }
    function vonSelbst(v) {
      // Wer selbst auf Abspielen gedrueckt hat, bekommt das Video auch nach dem Zurueckscrollen wieder
      if (v.dataset.angehalten === "ja") { return false; }
      if (v.dataset.gewollt === "ja") { return true; }
      // Am Handy startet nichts von selbst: die Aufnahmen sind vom Rechner, die Schrift waere winzig
      return !ruhig.matches && !schmal.matches && !sparen();
    }

    var io = null;
    if (kannBeobachten) {
      io = new IntersectionObserver(function (eintraege) {
        eintraege.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting) {
            v.dataset.sichtbar = "ja";
            if (v.paused && !v.__uhr && vonSelbst(v)) {
              // erst nach 600 ms im Blickfeld starten: beim schnellen Durchscrollen laedt nichts
              v.__uhr = window.setTimeout(function () {
                v.__uhr = null;
                if (v.dataset.sichtbar === "ja" && vonSelbst(v)) { abspielen(v); }
              }, WARTEN);
            }
          } else {
            v.dataset.sichtbar = "nein";
            if (v.__uhr) { window.clearTimeout(v.__uhr); v.__uhr = null; }
            // im Vollbild und kurz danach (das Geraet dreht zurueck) laeuft das Video weiter
            if (!v.paused && !v.__vollbild && imVollbild() !== v) { v.pause(); }
          }
        });
      }, { threshold: 0.4 });
    }

    // Vollbild am Handy mit der grossen Datei (Runde 5, B15): die 720er-Datei waere quer kaum lesbar.
    // Setzt src nur einmal; danach spielt das Video auch im Rahmen die grosse Datei.
    function grosseDatei(v) {
      var quelle = v.querySelector("source:not([media])");
      if (!quelle || !quelle.src || v.currentSrc === quelle.src || v.getAttribute("src")) { return; }
      v.src = quelle.src;
    }
    // iPhone (nur das Video kann ins Vollbild, kein Element-Vollbild): ohne playsinline spielt das Geraet
    // das Video beim Start selbst im Vollbild. Nach dem Verlassen kommt playsinline zurueck.
    function nurIPhone(v) {
      return !!v.webkitEnterFullscreen && !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    }

    clips.forEach(function (v) {
      var fig = v.closest("figure");
      // Platz des Knopfs: rechts in der Zeile am Rahmen. Ohne diese Zeile (alte Bausteine) unten im Bild.
      var zeile = fig ? fig.querySelector(".abzug__kopf") : null;
      var ort = zeile || v.parentNode;
      var knopf = (fig || v.parentNode).querySelector("button.clip__knopf");
      if (!knopf) {
        knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "clip__knopf";
      }
      if (knopf.parentNode !== ort) { ort.appendChild(knopf); }
      v.removeAttribute("controls");
      v.muted = true;
      knopf.hidden = false;

      // Nummer aus der Bildunterschrift, damit jeder Knopf einen eigenen Namen hat ("Abspielen, Video 1.1").
      // Der Name beginnt mit dem sichtbaren Wort (WCAG 2.5.3, Sprachsteuerung).
      var marke = fig ? fig.querySelector("figcaption b") : null;
      var nummer = marke ? marke.textContent.replace(/^[^\d]+/, "").trim() : "";
      var zusatz = nummer ? ", Video " + nummer : ", Video";

      function beschriften() {
        knopf.textContent = v.paused ? "Abspielen" : "Anhalten";
        knopf.setAttribute("aria-label", knopf.textContent + zusatz);
        knopf.setAttribute("data-zustand", v.paused ? "steht" : "laeuft");
      }
      beschriften();
      v.addEventListener("play", beschriften);
      v.addEventListener("pause", beschriften);

      // Im Vollbild mit den Bedienelementen des Geraets (Anhalten, Schliessen), danach wieder ohne.
      // Nach dem Verlassen laeuft das Video weiter, der Knopf zeigt "Anhalten".
      function vollbildWechsel(drin) {
        if (drin === !!v.__drin) { return; }
        v.__drin = drin;
        window.clearTimeout(v.__vollbildUhr);
        if (drin) {
          v.__vollbild = true;
          v.controls = true;
        } else {
          v.controls = false;
          v.__vollbildUhr = window.setTimeout(function () { v.__vollbild = false; }, 1000);
          try {
            if (window.screen && screen.orientation && screen.orientation.unlock) { screen.orientation.unlock(); }
          } catch (e) { /* nichts zu loesen */ }
        }
        beschriften();
      }
      function aufVollbild() { vollbildWechsel(imVollbild() === v); }
      document.addEventListener("fullscreenchange", aufVollbild);
      document.addEventListener("webkitfullscreenchange", aufVollbild);
      v.addEventListener("webkitbeginfullscreen", function () { vollbildWechsel(true); });
      v.addEventListener("webkitendfullscreen", function () {
        v.setAttribute("playsinline", "");
        vollbildWechsel(false);
      });

      knopf.addEventListener("click", function () {
        if (v.__uhr) { window.clearTimeout(v.__uhr); v.__uhr = null; }
        if (v.paused) {
          v.dataset.angehalten = "nein";
          v.dataset.gewollt = "ja";
          // am Handy ins Vollbild, noch im selben Tippen (sonst lehnt der Browser ab)
          if (schmal.matches) {
            grosseDatei(v);
            if (nurIPhone(v)) { v.removeAttribute("playsinline"); }
            vollbild(v);
          }
          abspielen(v);
        } else {
          v.dataset.angehalten = "ja";
          v.pause();
        }
      });
      if (io) { io.observe(v); }
    });
  }

  /* ---------- 3 Stiftmarken ---------- */
  var RING = "M96 45 C 97 18, 70 4, 46 5 C 20 6, 3 24, 4 50 C 5 78, 28 95, 52 95 C 78 95, 99 78, 96 46 C 95 36, 90 26, 82 19";

  function neuesSvg(klasse) {
    var s = document.createElementNS(SVG, "svg");
    s.setAttribute("class", klasse);
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    return s;
  }
  function neuerPfad(d) {
    var p = document.createElementNS(SVG, "path");
    p.setAttribute("pathLength", "1");
    if (d) { p.setAttribute("d", d); }
    return p;
  }

  function pfeilZeichnen(marke) {
    var flaeche = marke.flaeche, pfeil = marke.pfeil;
    if (!marke.notiz || schmal.matches) { pfeil.style.display = "none"; return; }
    var f = flaeche.getBoundingClientRect();
    var k = marke.kreis.getBoundingClientRect();
    var n = marke.notiz.getBoundingClientRect();
    if (!k.width || !n.width) { pfeil.style.display = "none"; return; }
    pfeil.style.display = "";
    pfeil.setAttribute("viewBox", "0 0 " + f.width + " " + f.height);
    var cx = k.left + k.width / 2 - f.left, cy = k.top + k.height / 2 - f.top;
    var rx = k.width / 2, ry = k.height / 2;
    // Start: Punkt am Rand der Notiz, der dem Kreis am naechsten liegt
    var nl = n.left - f.left, nr = n.right - f.left, nt = n.top - f.top, nb = n.bottom - f.top;
    var ax, ay;
    if (nt >= cy + ry) {            // Notiz unter dem Kreis
      ax = Math.min(Math.max(cx, nl + 14), Math.min(nr - 14, nl + 120)); ay = nt - 4;
    } else if (nl >= cx + rx) {     // Notiz rechts
      ax = nl - 8; ay = Math.min(Math.max(cy, nt + 14), nb - 10);
    } else if (nr <= cx - rx) {     // Notiz links
      ax = nr + 8; ay = Math.min(Math.max(cy, nt + 14), nb - 10);
    } else {                        // Notiz ueber dem Kreis
      ax = Math.min(Math.max(cx, nl + 14), nr - 14); ay = nb + 4;
    }
    // Ziel: Rand der Ellipse in Richtung der Notiz, mit etwas Luft
    var dx = ax - cx, dy = ay - cy;
    var t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    var lang = Math.sqrt(dx * dx + dy * dy) || 1;
    var ex = cx + dx * t + (dx / lang) * 9, ey = cy + dy * t + (dy / lang) * 9;
    var sx = ex - ax, sy = ey - ay;
    var strecke = Math.sqrt(sx * sx + sy * sy);
    if (strecke < 26) { pfeil.style.display = "none"; return; }
    // leichter Bogen: Stuetzpunkt seitlich der Strecke
    var bogen = Math.min(46, strecke * 0.22) * (sx >= 0 ? 1 : -1);
    var mx = (ax + ex) / 2 + (-sy / strecke) * bogen, my = (ay + ey) / 2 + (sx / strecke) * bogen;
    marke.schaft.setAttribute("d", "M" + ax.toFixed(1) + " " + ay.toFixed(1) + " Q " + mx.toFixed(1) + " " + my.toFixed(1) + ", " + ex.toFixed(1) + " " + ey.toFixed(1));
    // Spitze entlang der Ankunftsrichtung
    var wx = ex - mx, wy = ey - my, wl = Math.sqrt(wx * wx + wy * wy) || 1;
    wx /= wl; wy /= wl;
    var L = 15, c = Math.cos(0.5), s = Math.sin(0.5);
    var p1x = ex - L * (wx * c - wy * s), p1y = ey - L * (wy * c + wx * s);
    var p2x = ex - L * (wx * c + wy * s), p2y = ey - L * (wy * c - wx * s);
    marke.spitze.setAttribute("d", "M" + p1x.toFixed(1) + " " + p1y.toFixed(1) + " L " + ex.toFixed(1) + " " + ey.toFixed(1) + " L " + p2x.toFixed(1) + " " + p2y.toFixed(1));
  }

  function stift() {
    var marken = [];
    alle("figure[data-kreis]").forEach(function (fig) {
      var w = (fig.getAttribute("data-kreis") || "").split(",").map(parseFloat);
      var bild = fig.querySelector(".abzug__bild, .clip");
      var flaeche = fig.querySelector(".abzug__flaeche");
      if (w.length < 4 || w.some(isNaN) || !bild || !flaeche) { return; }
      fig.style.setProperty("--kx", w[0]);
      fig.style.setProperty("--ky", w[1]);
      fig.style.setProperty("--kw", w[2]);
      fig.style.setProperty("--kh", w[3]);
      var kreis = neuesSvg("stift__kreis");
      kreis.setAttribute("viewBox", "0 0 100 100");
      kreis.setAttribute("preserveAspectRatio", "none");
      kreis.appendChild(neuerPfad(RING));
      bild.appendChild(kreis);
      var punkt = document.createElement("span");
      punkt.className = "stift__punkt";
      punkt.setAttribute("aria-hidden", "true");
      bild.appendChild(punkt);
      var pfeil = neuesSvg("stift__pfeil");
      var schaft = neuerPfad(""), spitze = neuerPfad("");
      pfeil.appendChild(schaft); pfeil.appendChild(spitze);
      flaeche.appendChild(pfeil);
      marken.push({ fig: fig, flaeche: flaeche, kreis: kreis, pfeil: pfeil, schaft: schaft, spitze: spitze, notiz: fig.querySelector(".abzug__notiz") });
    });
    if (!marken.length) { return; }

    function neuZeichnen() { marken.forEach(pfeilZeichnen); }
    neuZeichnen();
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function () { window.requestAnimationFrame(neuZeichnen); });
      marken.forEach(function (m) { ro.observe(m.flaeche); });
    } else {
      window.addEventListener("resize", neuZeichnen);
    }
    window.addEventListener("load", neuZeichnen);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(neuZeichnen); }

    if (ruhig.matches || !kannBeobachten) {
      marken.forEach(function (m) { m.fig.classList.add("ist-da"); });
      return;
    }
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("ist-da"); io.unobserve(e.target); }
      });
    }, { threshold: 0.3 });
    marken.forEach(function (m) { io.observe(m.fig); });
  }

  /* ---------- 4 Lupe ---------- */
  function lupe() {
    var links = alle("a[data-lupe]");
    if (!links.length || !("HTMLDialogElement" in window)) { return; }
    var dialog = document.createElement("dialog");
    dialog.className = "lupe";
    // Name und Beschreibung des Dialogs aus Titel und Bildunterschrift (Runde 5, B11): "Bild 4.1" und der Text darunter
    dialog.setAttribute("aria-labelledby", "lupe-titel");
    dialog.setAttribute("aria-describedby", "lupe-text");
    dialog.innerHTML =
      '<div class="lupe__leiste"><p class="lupe__titel" id="lupe-titel"><span class="unsichtbar">Bild </span><span class="lupe__nr"></span></p><p class="lupe__knoepfe">' +
      '<button type="button" class="lupe__zoom" aria-pressed="false">Größer</button>' +
      '<button type="button" class="lupe__zu">Schließen</button></p></div>' +
      '<div class="lupe__flaeche" tabindex="-1"><img alt=""></div>' +
      '<p class="lupe__text" id="lupe-text"></p>';
    document.body.appendChild(dialog);
    var bild = dialog.querySelector("img");
    var titel = dialog.querySelector(".lupe__nr");
    var vorsatz = dialog.querySelector(".lupe__titel .unsichtbar");
    var text = dialog.querySelector(".lupe__text");
    var zoom = dialog.querySelector(".lupe__zoom");
    var zu = dialog.querySelector(".lupe__zu");
    var flaeche = dialog.querySelector(".lupe__flaeche");
    var dateiBreite = 0;
    var handyArt = false;

    function gross(an) {
      dialog.classList.toggle("lupe--gross", an);
      // Handy-Aufnahme am Handy: in der kleinen Stufe so breit wie das Fenster (werkbuch.css, .lupe--handy)
      dialog.classList.toggle("lupe--handy", !an && handyArt && schmal.matches);
      // Am Handy ist die grosse Stufe 250 % der Bildschirmbreite (werkbuch.css), aber nie breiter als die Datei:
      // ein schmales Hochformat wird nicht hochgerechnet und bleibt scharf.
      bild.style.width = an && schmal.matches && dateiBreite ? Math.min(2.5 * window.innerWidth, dateiBreite) + "px" : "";
      zoom.setAttribute("aria-pressed", an ? "true" : "false");
      zoom.textContent = an ? "Kleiner" : "Größer";
    }
    function oeffnen(a) {
      var klein = a.querySelector("img");
      var fig = a.closest("figure");
      var unterschrift = fig ? fig.querySelector("figcaption") : null;
      var nummer = unterschrift ? unterschrift.querySelector("b") : null;
      bild.src = a.getAttribute("href");
      bild.alt = klein ? klein.alt : "";
      if (klein && klein.getAttribute("width")) {
        bild.width = klein.getAttribute("width"); bild.height = klein.getAttribute("height");
      }
      titel.textContent = nummer ? nummer.textContent : (a.getAttribute("data-lupe") || "Bild");
      // "Bild " nur fuer Screenreader und nur vor einer Nummer ("Bild 4.1"), sonst steht der Name schon da
      vorsatz.textContent = nummer ? "Bild " : "";
      text.textContent = unterschrift ? unterschrift.textContent.replace(nummer ? nummer.textContent : "", "").trim() : "";
      // Am Handy waere ein Querformat in der Bildschirmbreite kaum groesser als auf der Seite:
      // es oeffnet gleich in der grossen Stufe (250 % der Bildschirmbreite, siehe werkbuch.css).
      // Ein Hochformat ebenso, wenn die Datei mehr als doppelt so breit ist wie der Bildschirm (G12):
      // in die Hoehe eingepasst waere seine Schrift sonst kleiner als auf der Seite.
      // Handy-Aufnahmen (data-lupe-art="handy", Runde 5, B11) dagegen in Fensterbreite: so gross wie auf dem eigenen Handy.
      var b = klein ? parseFloat(klein.getAttribute("width")) : 0, h = klein ? parseFloat(klein.getAttribute("height")) : 0;
      dateiBreite = b || 0;
      handyArt = a.getAttribute("data-lupe-art") === "handy";
      gross(schmal.matches && !handyArt && (b > h || b > 2 * window.innerWidth));
      flaeche.scrollTop = 0; flaeche.scrollLeft = 0;
      dialog.showModal();
      zu.focus();
    }
    links.forEach(function (a) {
      a.setAttribute("role", "button");
      a.setAttribute("aria-haspopup", "dialog");
      if (!a.getAttribute("aria-label")) {
        var i = a.querySelector("img");
        a.setAttribute("aria-label", "Bild vergrößern: " + (i ? i.alt : ""));
      }
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) { return; }
        e.preventDefault();
        oeffnen(a);
      });
      a.addEventListener("keydown", function (e) {
        if (e.key === " ") { e.preventDefault(); oeffnen(a); }
      });
    });
    zu.addEventListener("click", function () { dialog.close(); });
    zoom.addEventListener("click", function () { gross(!dialog.classList.contains("lupe--gross")); });
    bild.addEventListener("click", function () { gross(!dialog.classList.contains("lupe--gross")); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) { dialog.close(); } });
    // Fokus bleibt im Dialog: Tab springt vom letzten Knopf zum ersten und umgekehrt
    dialog.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") { return; }
      if (e.shiftKey && document.activeElement === zoom) { e.preventDefault(); zu.focus(); }
      else if (!e.shiftKey && document.activeElement === zu) { e.preventDefault(); zoom.focus(); }
    });
    dialog.addEventListener("close", function () { bild.removeAttribute("src"); });
  }

  /* ---------- 5 Falten ---------- */
  function falten() {
    alle(".abzugreihe[data-falten]").forEach(function (reihe, n) {
      var bleibt = parseInt(reihe.getAttribute("data-falten"), 10) || 1;
      var rest = reihe.children.length - bleibt;
      if (rest < 1) { return; }
      if (!reihe.id) {
        var id = "bildreihe-" + (n + 1);
        while (document.getElementById(id)) { id += "-x"; }
        reihe.id = id;
      }
      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "knopf knopf--klein falte__knopf";
      knopf.setAttribute("aria-controls", reihe.id);
      var zu = rest === 1 ? "Ein weiteres Bild zeigen" : rest + " weitere Bilder zeigen";
      function setzen(offen) {
        reihe.classList.toggle("ist-gefaltet", !offen);
        knopf.setAttribute("aria-expanded", offen ? "true" : "false");
        knopf.textContent = offen ? "Bilder einklappen" : zu;
      }
      setzen(false);
      knopf.addEventListener("click", function () {
        var oeffnen = reihe.classList.contains("ist-gefaltet");
        setzen(oeffnen);
        // Aufgeklappt: das erste neue Bild rueckt unter die Leiste, sonst laege es ausserhalb des Bildschirms
        // Eingeklappt: der Knopf bleibt sichtbar, auch wenn die Bilder darueber wegfallen
        if (!schmal.matches || !knopf.scrollIntoView) { return; }
        var art = ruhig.matches ? "auto" : "smooth";
        if (oeffnen) { reihe.children[bleibt].scrollIntoView({ block: "start", behavior: art }); }
        else { knopf.scrollIntoView({ block: "nearest", behavior: art }); }
      });
      reihe.parentNode.insertBefore(knopf, reihe.nextSibling);
    });
  }

  /* ---------- 6 Kopieren ---------- */
  function kopieren() {
    if (!navigator.clipboard || !window.isSecureContext) { return; }
    alle("button[data-kopieren]").forEach(function (knopf) {
      // Jeder Knopf hat seine eigene Meldung. Fehlt sie im HTML (Schlussblock der Fallstudie), entsteht sie hier.
      var meldung = knopf.parentNode.querySelector(".kontakt__meldung");
      if (!meldung) {
        meldung = document.createElement("span");
        meldung.className = "kontakt__meldung";
        meldung.setAttribute("role", "status");
        knopf.parentNode.insertBefore(meldung, knopf.nextSibling);
      }
      var uhr = 0;
      knopf.hidden = false;
      knopf.addEventListener("click", function () {
        navigator.clipboard.writeText(knopf.getAttribute("data-kopieren")).then(function () {
          meldung.textContent = "Kopiert";
          clearTimeout(uhr);
          uhr = setTimeout(function () { meldung.textContent = ""; }, 2000);
        }, function () {});
      });
    });
  }

  /* ---------- 7 Weiches Scrollen ---------- */
  // Erst nach dem Laden und dem ersten Bild danach (Runde 5, B5): Der Sprung zum Ziel einer Adresse mit #
  // (Rueckweg index.html#<key>) geschieht beim Laden sofort. Danach gleiten Sprunglinks auf der Seite,
  // ausser bei "weniger Bewegung" (auch wenn sich die Einstellung spaeter aendert).
  function weich() {
    var html = document.documentElement;
    function setzen() { html.style.scrollBehavior = ruhig.matches ? "" : "smooth"; }
    function nachLaden() {
      window.requestAnimationFrame(function () { window.requestAnimationFrame(setzen); });
      if (ruhig.addEventListener) { ruhig.addEventListener("change", setzen); }
      else if (ruhig.addListener) { ruhig.addListener(setzen); }
    }
    if (document.readyState === "complete") { nachLaden(); }
    else { window.addEventListener("load", nachLaden, { once: true }); }
  }

  function los() { leiste(); videos(); stift(); lupe(); falten(); kopieren(); weich(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", los);
  } else {
    los();
  }
})();
