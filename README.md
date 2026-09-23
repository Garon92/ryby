# 🎣 Ryby – rybářská hra s českými rybami

Dětská rybářská hra, ve které se chytá **59 druhů ryb žijících v Česku**. Nahodíš prut, počkáš na záběr,
zasekneš a zdoláš rybu – a každý nový druh se uloží do **alba**, které funguje jako malá encyklopedie
(fotka, české i latinské jméno, velikost, potrava, kde žije, zajímavosti pro děti, předčítání česky).

**Hraj:** https://garon92.github.io/ryby/ (instalovatelné jako aplikace, funguje i offline)

## Co ve hře je

- **Čtyři místa** s vlastní krajinou a rybami podle skutečného výskytu: 🪷 rybník, 🌉 řeka, 🌲 potok, ⛵ přehrada.
  Další místa se odemykají rybářskými úrovněmi (rodiče je mohou v nastavení odemknout hned).
- **Skutečné rybaření:** hod obloukem, splávek, okusování, záběr, zaseknutí, zdolávání s ukazatelem napětí
  vlasce (když je ručička v červeném, je třeba povolit), vylovení.
- **Denní doba:** ráno, den, večer a noc s měsícem, hvězdami, světluškami a lucernou. V noci berou sumci,
  úhoři, candáti a mníci. Občas **prší** – pak ryby berou lépe.
- **Trofeje** (20 úspěchů: sběratel, pán rybníka, obr přes metr, noční rybář…), **ryba dne** na úvodní
  obrazovce, hvězdy výpravy rozsvěcované už během hry.
- **Návnady:** žížala, kukuřice, třpytka, muška – každá láká jiné ryby (podle toho, co ryba opravdu jí).
- **Tři obtížnosti** jako v ostatních hrách: 🐢 Lehká (Mrňous – ryba se zasekne sama, vlasec nepraskne),
  🐇 Normální (Rybář), 🔥 Těžká (Mistr).
- **Režimy:** ⏱️ Výprava na 3 minuty (body, hvězdy, rekordy pro každé místo a obtížnost) a ♾️ Volné chytání.
- **Autopilot** pro nejmenší – rybář chytá sám, ryby se ukládají do alba (bez mincí a bodů).
- **Odměny:** mince za úlovky, mise (3 najednou, po splnění hned další), denní odměna se sérií 7 dní,
  zlaté bubliny, série úlovků, perfektní hod, duhové a trofejní ryby, úrovně.
- **Obchod:** pruty, splávky, návnady a klobouky pro rybáře.
- **Chráněné ryby** se vyfotí do alba a pustí zpět do vody (hra to dítěti vysvětlí).
- Ovládání **myší, dotykem i klávesnicí** (mezerník = nahodit / zaseknout / držet = navíjet, šipky = mířit,
  B = návnada, Esc/P = pauza, M = zvuk, F = celá obrazovka, ? = nápověda), auto-pauza při přepnutí záložky
  i při otevřeném dialogu, světlý i tmavý vzhled.
- **Předčítání** názvů ryb je rodinné nastavení kitu (⚙ → Předčítání; zvuk v liště řídí jen efekty a hudbu);
  tlačítko „Poslechnout“ mluví vždy.
- **„Menu“ v liště během výpravy** hru pozastaví a zeptá se „Odejít do menu?“ (výchozí je Zůstat).

## Vývoj

```bash
npm install
npm run dev        # http://localhost:5175/ryby/
npm test           # Vitest – logika hry (záběry, zdolávání, bodování, mise, ukládání…)
npm run typecheck
npm run build      # → dist/ (PWA)
npm run preview
```

Stack: Vite + TypeScript (strict) bez frameworku, Canvas 2D (ostré na retině), vite-plugin-pwa,
sdílený design systém **g92 kit** v `src/kit/` (needitovat – synchronizuje se z repa `menu`).

```
src/
  data/        species.ts (59 druhů, opravená data), locations.ts, shop.ts, fish-images.json
  game/        engine.ts (stavový automat rybaření), fish.ts, fisher.ts, scene/ (krajina, voda, dno),
               audio.ts (WebAudio), speech.ts (český hlas), logic/ (čistá testovaná logika), rewards.ts
  store/       save.ts (verzovaný postup + migrace starých klíčů), index.ts (kit store)
  ui/          start, hud, album, shop, catchCard, results, dialogs, settings
  kit/         g92 kit (vendored)
public/fish/   WebP obrázky ryb (plné + náhledy 256 px)
scripts/       build-images.mjs (sharp: PNG → WebP)
```

### Obrázky ryb

Původní PNG výřezy (10 MB) byly převedeny na WebP s průhledností (≈ 1,9 MB včetně náhledů) a z repa
odstraněny – zůstávají v historii gitu (commit `29d3b81`). Nové převedení:

```bash
git archive 29d3b81 ryby | tar -x -C /tmp/ryby-src
node scripts/build-images.mjs --src=/tmp/ryby-src/ryby
```

### Uložený postup

Vše je v `localStorage` pod klíčem `g92:ryby:save` (album, mince, úroveň, mise, vybavení, rekordy, nastavení).
Při prvním spuštění se automaticky převezmou data z původní verze hry (mince, rekord, koupené pruty,
denní odměna, předvolby) a staré klíče se smažou.

## Nasazení

GitHub Actions (`.github/workflows/deploy.yml`): typecheck → testy → build → GitHub Pages.

---

Obrázky ryb pocházejí z databáze českých ryb a jsou použity pouze pro vzdělávací a zábavní účely.
Údaje o rybách vycházejí z českých rybářských atlasů; zajímavosti jsou zjednodušené pro děti.
