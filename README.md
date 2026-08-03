# Der Himmel über uns 🌙

Ein kleiner, magischer Nachthimmel als Web-App – gebaut mit reinem HTML, CSS und
Vanilla-JavaScript. Kein Framework, kein Build-System. Einfach hochladen und fertig.

---

## 📁 Struktur

```
/
├── index.html          ← Grundgerüst
├── style.css           ← komplettes Design + Animationen
├── script.js           ← die gesamte Logik (oben steht die CONFIG!)
├── manifest.json       ← PWA (Homescreen-Installation)
├── sw.js               ← Service Worker (offline-fähig)
└── assets/
    ├── images/         ← deine Fotos
    ├── videos/         ← deine Videos
    ├── audio/          ← deine Sprachnachrichten
    └── icons/icon.svg  ← App-Icon
```

---

## ✏️ Was du anpassen musst

Alles Wichtige steht **ganz oben in `script.js`** im `CONFIG`-Block:

### 1. Zeitraum
```js
START_DATE: '2026-08-01',   // ab hier wird täglich ein Stern freigeschaltet
END_DATE:   '2026-08-31',   // Rückkehrtag -> Finale-Animation
```
- Ab `START_DATE` wird **jeden Tag ein weiterer Stern sichtbar** (Tag 1 = 1 Stern).
- Am `END_DATE` startet automatisch die **Herz-Finale-Animation**.

### 2. Erinnerungen (die Sterne)
```js
memories: [
  {
    title: 'Tag 1',
    text:  'Mehrzeiliger Text geht mit \n oder Backticks.',
    image: 'assets/images/foto.jpg',   // optional – sonst ''
    video: 'assets/videos/clip.mp4',   // optional – sonst ''
    audio: 'assets/audio/nachricht.m4a'// optional – sonst ''
  },
  // beliebig viele weitere ...
]
```
Reihenfolge im Array = Reihenfolge der Freischaltung. Neue Erinnerung hinzufügen =
einfach ein neues Objekt anhängen.

### 3. Sternschnuppen-Nachrichten
Die Liste `shootingMessages` enthält die Texte, die bei einer angetippten
Sternschnuppe erscheinen.

---

## 🖼️ Medien hinzufügen

Lege deine Dateien in die passenden Ordner unter `assets/` und trage den Pfad
im jeweiligen Erinnerungs-Objekt ein. Bilder/Videos werden **lazy** geladen.

Empfohlen fürs Handy: Fotos als `.jpg` (max. ~1600px breit), Videos als `.mp4`
(H.264), Audio als `.m4a` oder `.mp3`.

---

## 🔊 Ton

Der Ton (leiser Wind + Chime beim Öffnen) wird **komplett im Browser erzeugt**
(Web Audio API) – du brauchst keine Audiodateien. Standardmäßig aus; über den
Noten-Button unten rechts einschaltbar (`soundDefaultOn` in der CONFIG ändert das).

---

## 🚀 Auf GitHub Pages veröffentlichen

1. Neues GitHub-Repository anlegen (z. B. `unser-himmel`).
2. Den kompletten Ordnerinhalt hochladen (per Git oder Drag & Drop im Browser).
3. Repository → **Settings → Pages** → Source: `Deploy from a branch` → Branch
   `main` / Ordner `/ (root)` → **Save**.
4. Nach ein paar Minuten ist die Seite unter
   `https://DEIN-NAME.github.io/unser-himmel/` erreichbar.
5. Link auf dem iPhone öffnen → Teilen → **„Zum Home-Bildschirm“** → fühlt sich
   wie eine echte App an (Vollbild, Icon, offline).

> Wichtig: Der Service Worker funktioniert nur über `https` (also auf GitHub
> Pages), nicht beim Öffnen der Datei per Doppelklick (`file://`).

---

## 🧪 Lokal testen

Öffne ein Terminal in diesem Ordner und starte einen kleinen Webserver:

```bash
# mit Python 3
python -m http.server 8000
```
Dann im Browser `http://localhost:8000` öffnen.

### Test-Abkürzungen per URL
| URL-Zusatz        | Wirkung                                             |
|-------------------|-----------------------------------------------------|
| `?preview=all`    | zeigt sofort **alle** Sterne                        |
| `?day=5`          | tut so, als wären seit dem Start 5 Tage vergangen   |
| `?finale=1`       | spielt sofort die **Herz-Finale-Animation** ab      |

Beispiel: `http://localhost:8000/?finale=1`

---

## ⚙️ Technisches (für später)

- **Performance:** alles läuft über `requestAnimationFrame`; die Animation
  pausiert automatisch, wenn der Tab im Hintergrund ist. Sternanzahl passt sich
  an die Bildschirmgröße an, `devicePixelRatio` ist auf 2 gedeckelt.
- **Parallax:** nutzt das Gyroskop (auf iOS nach einmaligem Tippen wegen der
  Berechtigung); ohne Sensor gibt es einen sanften Touch-Fallback.
- **Barrierefreiheit:** respektiert `prefers-reduced-motion`, gute Kontraste,
  große Touch-Flächen, Tastatur-Fokus.
- **Cache aktualisieren:** wenn du Dateien änderst, in `sw.js` die Zeile
  `const CACHE = 'himmel-v1';` hochzählen (`v2`, `v3`, …), damit alte Versionen
  ersetzt werden.

---

Gebaut mit Ruhe und Sorgfalt. Viel Freude damit. ✨
