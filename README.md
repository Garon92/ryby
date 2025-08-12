# 🎣 Rybářská hra - České ryby

Interaktivní rybářská hra s rybami z České republiky. Ovládejte rybáře myší, chytejte ryby a sbírejte body podle jejich vzácnosti!

## 🌟 Funkce

- **Pro děti**: velké hitboxy, auto-assist, piktogramy místo textu
- **Album, mise a denní odměny**: piktogramové UI, žádné čtení
- **Perfektní hod, combo a konfety**: vizuální odměny a zvuky
- **Skiny prutu a „⭐“ mince**: jednoduchý shop bez textu
- **Autopilot a Sandbox**: režimy pro nejmenší (viz níže)
- **Realistické chování ryb** – plynulé plavání, hloubka, siluety
- **Hlasové oznámení** – Web Speech přečte název ryby (čeština)
- **Responzivní design** – funguje na mobilech i desktopu

## 🎮 Jak hrát

1. **Pohyb rybáře**: pohybujte myší (nebo prstem na mobilu) po horní části vody
2. **Hod a chycení**: klikněte/ťukněte do vody; auto-assist pomůže přitáhnout rybu
3. **Body a ⭐**: body podle velikosti a vzácnosti; ⭐ získáváte za úlovky a mise
4. **Piktogramy**: ovládání je ikonami; žádný text není nutný číst

## 🚀 Spuštění hry

### Nejjednodušší (bez serveru)
- Otevřete `index.html` dvojklikem (funguje z `file://`). Data ryb jsou vložená v HTML.

### Alternativně (se serverem)
- `npm install && npm start` a pak `http://localhost:3000`

## 🐟 Ryby ve hře

Hra obsahuje desítky druhů českých ryb včetně:

- **Časté ryby** (nízká vzácnost): Plotice, Okoun, Kapr
- **Středně vzácné**: Štika, Candát, Sumec
- **Vzácné ryby** (vysoká vzácnost): Hlavatka, Jeseter, Losos

Každá ryba má:
- Unikátní vzhled podle skutečné fotografie
- Realistickou velikost (10-120 cm)
- Vzácnost od 1 do 10
- Odpovídající chování při plavání

## 🏆 Bodování

- **Základní body** = `ceil(velikost/10) + (vzácnost × 5)`
- **Perfect! hod**: +10 bodů
- **Combo**: rychlé úlovky po sobě přidávají +5/+10...
- **Sandbox mód**: body a ⭐ se nepřičítají (čistá hra pro děti)

## 🔧 Technické detaily

- **Frontend**: HTML5 Canvas, CSS3, JavaScript ES6+
- **Backend (volitelně)**: Node.js + Express (není nutné; data jsou v `index.html`)
- **Hlasový výstup**: Web Speech API
- **Audio**: Web Audio API (hudba, efekty, combo, perfect)
- **Grafika**: Canvas 2D API, animace a částice

## 📁 Struktura projektu

```
ryby/
├── index.html         # Hlavní HTML soubor (obsahuje vložená data ryb)
├── style.css          # CSS styly
├── game.js            # Herní logika
├── ryby/              # Obrázky ryb (PNG)
├── server.js          # Volitelný Node server (není potřeba)
├── package.json       # Volitelné skripty
└── README.md          # Tento soubor
```

## 🎯 Budoucí vylepšení

- [ ] Více levelů obtížnosti
- [ ] Achievementy a trofeje
- [ ] Uložení nejlepších skóre
- [ ] Multiplayer režim
- [ ] Více rybářských technik
- [ ] Sezónní změny v dostupnosti ryb

## 🐛 Řešení problémů

**Ryby se nezobrazují:**
- Otevřete `index.html` přímo (file://). Pokud jste přes server, ověřte cesty k `ryby/*.png`.
- Otevřete Developer Tools (F12) a zkontrolujte chyby v konzoli

**Hlas nefunguje:**
- Povolte přístup k audio v prohlížeči
- Zkontrolujte, že máte nainstalovaný český hlas v systému

**Hra se nespustí:**
- Použijte dvojklik na `index.html` (server není nutný)

## 📧 Kontakt

Vytvořeno s ❤️ pro milovníky rybaření a českých ryb!

---

*Poznámka: Všechny obrázky ryb pocházejí z databáze českých ryb a jsou použity pouze pro vzdělávací a zábavní účely.* 
---

## Nasazení (GitHub Pages)

- Deploy přes GitHub Actions.
- Očekávaná URL: https://garon92.github.io/ryby/
- Tip: používat relativní cesty k assetům (./img/..., ./css/..., ./js/...).
