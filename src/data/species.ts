/**
 * České ryby ve hře — kurátorovaná data.
 *
 * Zdroj: původní `ryby_original.json` (text z českého rybářského atlasu: latinské jméno, čeleď, potrava,
 * běžná a maximální velikost, ochrana), opravený a doplněný. Opravy oproti původním datům:
 *  - názvy s českými velkými písmeny („Kapr obecný“), „hlaváčka“ (ne „hlavačka“)
 *  - aktuální latinská jména (Squalius cephalus, Barbatula barbatula, Ballerus sapa, Blicca bjoerkna,
 *    Hypophthalmichthys nobilis, Carassius gibelio, Cobitis elongatoides, Leuciscus aspius, Proterorhinus semilunaris)
 *  - vranka max. ~18 cm (ne 150 cm), amur je býložravec, okounek pstruhový patří k okounkovitým
 *  - rarita 1–5 podle skutečné četnosti v českých vodách
 * Zajímavosti jsou vlastní krátké formulace obecně známých faktů, psané pro děti.
 */

export type LocationId = 'rybnik' | 'reka' | 'potok' | 'prehrada';
export type Diet = 'rostliny' | 'plankton' | 'drobotina' | 'vsezravec' | 'dravec' | 'rasy' | 'bahno';
export type Zone = 'hladina' | 'stred' | 'dno';
export type Rarity = 1 | 2 | 3 | 4 | 5;

export interface Species {
  /** stabilní id = název souboru obrázku */
  id: string;
  name: string;
  /** druhé české jméno / upřesnění (zobrazuje se malým písmem) */
  alias?: string;
  latin: string;
  family: string;
  diet: Diet;
  /** běžná velikost úlovku v cm */
  sizeMin: number;
  sizeMax: number;
  /** největší známé kusy (cm) */
  sizeRecord: number;
  rarity: Rarity;
  locations: LocationId[];
  zone: Zone;
  /** aktivnější v noci / za šera */
  night?: boolean;
  /** odkud byl nepůvodní druh k nám dovezen */
  origin?: string;
  /** v ČR chráněný druh → po vyfocení pouštíme zpět */
  protected?: boolean;
  /** síla v souboji (násobek; 1 = průměr) */
  fight?: number;
  facts: string[];
}

export const SPECIES: Species[] = [
  {
    id: 'amur_bily', name: 'Amur bílý', latin: 'Ctenopharyngodon idella', family: 'kaprovití',
    diet: 'rostliny', sizeMin: 50, sizeMax: 80, sizeRecord: 150, rarity: 2,
    locations: ['rybnik', 'prehrada'], zone: 'stred', origin: 'z východní Asie', fight: 1.3,
    facts: [
      'Spásá vodní rostliny podobně jako kráva trávu na louce.',
      'Jméno dostal podle řeky Amur v Asii, odkud pochází.',
      'Na udici se pořádně pere – je to silná ryba.',
    ],
  },
  {
    id: 'bolen_dravy', name: 'Bolen dravý', latin: 'Leuciscus aspius', family: 'kaprovití',
    diet: 'dravec', sizeMin: 40, sizeMax: 70, sizeRecord: 100, rarity: 3,
    locations: ['reka', 'prehrada'], zone: 'hladina', fight: 1.25,
    facts: [
      'Je to jediná opravdu dravá kaprovitá ryba u nás.',
      'Loví u hladiny – honí malé rybky tak prudce, že voda šplíchá.',
    ],
  },
  {
    id: 'candat_obecny', name: 'Candát obecný', latin: 'Sander lucioperca', family: 'okounovití',
    diet: 'dravec', sizeMin: 40, sizeMax: 70, sizeRecord: 110, rarity: 3,
    locations: ['prehrada', 'reka', 'rybnik'], zone: 'dno', night: true, fight: 1.1,
    facts: [
      'Má velké oči, které dobře vidí v kalné vodě i za šera.',
      'V tlamě má ostré zuby, které vypadají jako malé tesáky.',
      'Loví hlavně večer a v noci.',
    ],
  },
  {
    id: 'candat_vychodni', name: 'Candát východní', latin: 'Sander volgensis', family: 'okounovití',
    diet: 'dravec', sizeMin: 20, sizeMax: 30, sizeRecord: 45, rarity: 4,
    locations: ['reka'], zone: 'dno', night: true,
    facts: [
      'Je to menší bratranec candáta obecného.',
      'Na rozdíl od něj nemá v tlamě velké tesáky.',
      'U nás žije vzácně, jen v řekách na jižní Moravě.',
    ],
  },
  {
    id: 'cejn_perletovy', name: 'Cejn perleťový', latin: 'Ballerus sapa', family: 'kaprovití',
    diet: 'drobotina', sizeMin: 15, sizeMax: 30, sizeRecord: 40, rarity: 5,
    locations: ['reka'], zone: 'dno', protected: true,
    facts: [
      'Má velké oči a stříbřité šupiny s perleťovým leskem.',
      'U nás žije jen vzácně v řekách na jižní Moravě.',
    ],
  },
  {
    id: 'cejn_siny', name: 'Cejn siný', latin: 'Ballerus ballerus', family: 'kaprovití',
    diet: 'plankton', sizeMin: 20, sizeMax: 35, sizeRecord: 45, rarity: 4,
    locations: ['reka', 'prehrada'], zone: 'stred',
    facts: [
      'Má modravě šedý hřbet – „siný“ znamená modravý.',
      'Živí se hlavně drobnými živočichy, kteří se vznášejí ve vodě.',
    ],
  },
  {
    id: 'cejn_velky', name: 'Cejn velký', latin: 'Abramis brama', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 30, sizeMax: 45, sizeRecord: 80, rarity: 1,
    locations: ['rybnik', 'reka', 'prehrada'], zone: 'dno', fight: 0.8,
    facts: [
      'Má vysoké a placaté tělo – z boku vypadá skoro jako talíř.',
      'Tlamu umí vysunout jako trubičku a ryje s ní v bahně.',
      'Žije ve velkých hejnech.',
    ],
  },
  {
    id: 'cejnek_maly', name: 'Cejnek malý', latin: 'Blicca bjoerkna', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 15, sizeMax: 25, sizeRecord: 35, rarity: 2,
    locations: ['rybnik', 'reka', 'prehrada'], zone: 'stred',
    facts: [
      'Vypadá jako malý cejn, ale u prsních ploutví je načervenalý.',
      'Žije v hejnech v pomalých řekách i rybnících.',
    ],
  },
  {
    id: 'drsek_mensi', name: 'Drsek menší', latin: 'Zingel streber', family: 'okounovití',
    diet: 'drobotina', sizeMin: 12, sizeMax: 16, sizeRecord: 20, rarity: 5,
    locations: ['reka'], zone: 'dno', night: true, protected: true,
    facts: [
      'Pohybuje se hlavně po dně mezi kameny v rychlé vodě.',
      'Aktivní je hlavně v noci.',
      'Patří k nejvzácnějším rybám u nás.',
    ],
  },
  {
    id: 'hlavacka_mramorovana', name: 'Hlaváčka mramorovaná', latin: 'Proterorhinus semilunaris', family: 'hlaváčovití',
    diet: 'drobotina', sizeMin: 5, sizeMax: 8, sizeRecord: 11, rarity: 3,
    locations: ['reka', 'prehrada'], zone: 'dno', origin: 'z oblasti Černého moře',
    facts: [
      'Břišní ploutve má srostlé v přísavku, kterou se drží kamenů.',
      'Na čumáčku má dvě malé trubičky – to jsou nozdry.',
      'Sameček hlídá jikry v úkrytu pod kamenem.',
    ],
  },
  {
    id: 'hlavatka_obecna_podunajska', name: 'Hlavatka obecná', alias: 'podunajská', latin: 'Hucho hucho', family: 'lososovití',
    diet: 'dravec', sizeMin: 60, sizeMax: 100, sizeRecord: 150, rarity: 5,
    locations: ['reka'], zone: 'stred', fight: 1.4,
    facts: [
      'Je to největší lososovitá ryba – může měřit přes metr a půl.',
      'Říká se jí také dunajský losos.',
      'Na rozdíl od lososa nikdy neplave do moře.',
    ],
  },
  {
    id: 'horavka_duhova', name: 'Hořavka duhová', latin: 'Rhodeus amarus', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 5, sizeMax: 8, sizeRecord: 10, rarity: 2,
    locations: ['rybnik', 'reka'], zone: 'stred',
    facts: [
      'Samička klade jikry do lastury živé škeble – tam jsou mláďata v bezpečí.',
      'Samečci se na jaře zbarví do duhových barev.',
      'Latinsky se jmenuje amarus, to znamená hořký.',
    ],
  },
  {
    id: 'hrouzek_kessleruv', name: 'Hrouzek Kesslerův', latin: 'Romanogobio kesslerii', family: 'kaprovití',
    diet: 'drobotina', sizeMin: 8, sizeMax: 11, sizeRecord: 13, rarity: 5,
    locations: ['reka'], zone: 'dno', protected: true,
    facts: [
      'U nás žije jen v několika moravských řekách.',
      'U tlamy má dva krátké vousky.',
      'Patří k nejvzácnějším rybám v Česku.',
    ],
  },
  {
    id: 'hrouzek_obecny', name: 'Hrouzek obecný', latin: 'Gobio gobio', family: 'kaprovití',
    diet: 'drobotina', sizeMin: 8, sizeMax: 14, sizeRecord: 20, rarity: 1,
    locations: ['potok', 'reka', 'rybnik'], zone: 'dno',
    facts: [
      'Dvěma vousky ohmatává dno a hledá potravu.',
      'Žije v hejnkách nad písčitým dnem.',
    ],
  },
  {
    id: 'jelec_jesen', name: 'Jelec jesen', latin: 'Leuciscus idus', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 25, sizeMax: 40, sizeRecord: 60, rarity: 3,
    locations: ['reka', 'prehrada'], zone: 'stred', protected: true, fight: 1.1,
    facts: [
      'Jeho zlatě zbarvenou formu – jesena zlatého – lidé chovají v zahradních jezírkách.',
      'Na jaře táhne proti proudu, aby se vytřel.',
    ],
  },
  {
    id: 'jelec_proudnik', name: 'Jelec proudník', latin: 'Leuciscus leuciscus', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 15, sizeMax: 25, sizeRecord: 30, rarity: 2,
    locations: ['potok', 'reka'], zone: 'hladina',
    facts: [
      'Má štíhlé tělo stavěné do rychlého proudu – odtud jeho jméno.',
      'Rád chytá hmyz, který spadne na hladinu.',
    ],
  },
  {
    id: 'jelec_tloust', name: 'Jelec tloušť', latin: 'Squalius cephalus', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 25, sizeMax: 45, sizeRecord: 70, rarity: 1,
    locations: ['reka', 'potok', 'prehrada'], zone: 'hladina', fight: 1.1,
    facts: [
      'Sní skoro cokoli – hmyz, třešně, a velký tloušť i malou rybku.',
      'Je velmi opatrný: když tě zahlédne na břehu, schová se.',
    ],
  },
  {
    id: 'jeseter_maly', name: 'Jeseter malý', latin: 'Acipenser ruthenus', family: 'jeseterovití',
    diet: 'drobotina', sizeMin: 40, sizeMax: 60, sizeRecord: 110, rarity: 5,
    locations: ['reka'], zone: 'dno', fight: 1.2,
    facts: [
      'Místo šupin má na těle řady kostěných štítků.',
      'Jeseteři žili na Zemi už v době dinosaurů.',
      'Pod dlouhým čenichem má vousky, kterými hledá potravu na dně.',
    ],
  },
  {
    id: 'jezdik_obecny', name: 'Ježdík obecný', latin: 'Gymnocephalus cernua', family: 'okounovití',
    diet: 'drobotina', sizeMin: 8, sizeMax: 15, sizeRecord: 25, rarity: 1,
    locations: ['reka', 'rybnik', 'prehrada'], zone: 'dno',
    facts: [
      'Hřbetní ploutev má pichlavou jako ježek.',
      'Je celý slizký, takže se špatně drží v ruce.',
    ],
  },
  {
    id: 'jezdik_zluty', name: 'Ježdík žlutý', latin: 'Gymnocephalus schraetser', family: 'okounovití',
    diet: 'drobotina', sizeMin: 15, sizeMax: 20, sizeRecord: 30, rarity: 4,
    locations: ['reka'], zone: 'dno', protected: true,
    facts: [
      'Je žlutý a po bocích má tmavé podélné proužky.',
      'U nás žije jen vzácně v řekách na jižní Moravě.',
    ],
  },
  {
    id: 'kapr_obecny', name: 'Kapr obecný', latin: 'Cyprinus carpio', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 40, sizeMax: 65, sizeRecord: 110, rarity: 1,
    locations: ['rybnik', 'prehrada', 'reka'], zone: 'dno', fight: 1.3,
    facts: [
      'České rybníky jsou kaprem proslavené po celém světě.',
      'U tlamy má čtyři vousky.',
      'Může se dožít i přes 40 let.',
    ],
  },
  {
    id: 'karas_obecny', name: 'Karas obecný', latin: 'Carassius carassius', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 15, sizeMax: 25, sizeRecord: 45, rarity: 3,
    locations: ['rybnik'], zone: 'dno',
    facts: [
      'Přežije i v tůni, kde je málo kyslíku – dokonce v zimě pod ledem.',
      'Dnes je u nás vzácnější, protože ho vytlačuje karas stříbřitý.',
    ],
  },
  {
    id: 'karas_stribrity', name: 'Karas stříbřitý', latin: 'Carassius gibelio', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 15, sizeMax: 30, sizeRecord: 45, rarity: 1,
    locations: ['rybnik', 'reka', 'prehrada'], zone: 'stred', origin: 'z Asie',
    facts: [
      'Jeho blízkou příbuznou je zlatá rybka z akvária.',
      'V jeho hejnech bývají často jen samičky.',
      'U nás je nepůvodní a velmi se rozšířil.',
    ],
  },
  {
    id: 'koljuska_triostna', name: 'Koljuška tříostná', latin: 'Gasterosteus aculeatus', family: 'koljuškovití',
    diet: 'drobotina', sizeMin: 4, sizeMax: 7, sizeRecord: 11, rarity: 2,
    locations: ['potok', 'rybnik'], zone: 'stred',
    facts: [
      'Na zádech má tři ostré ostny.',
      'Sameček staví z rostlinek hnízdo a hlídá v něm jikry i mláďata.',
      'Na jaře má sameček červené bříško.',
    ],
  },
  {
    id: 'lin_obecny', name: 'Lín obecný', latin: 'Tinca tinca', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 20, sizeMax: 35, sizeRecord: 60, rarity: 2,
    locations: ['rybnik'], zone: 'dno', night: true,
    facts: [
      'Je zlatozelený, slizký a má malinké šupiny.',
      'Má červenooranžové oči.',
      'Rád se zdržuje v bahně mezi vodními rostlinami.',
    ],
  },
  {
    id: 'lipan_podhorni', name: 'Lipan podhorní', latin: 'Thymallus thymallus', family: 'lososovití',
    diet: 'drobotina', sizeMin: 25, sizeMax: 40, sizeRecord: 55, rarity: 4,
    locations: ['potok', 'reka'], zone: 'stred', fight: 1.1,
    facts: [
      'Má obrovskou hřbetní ploutev, která vypadá jako vlajka.',
      'Čerstvě chycený prý voní po tymiánu – odtud latinské jméno Thymallus.',
      'Potřebuje čistou a studenou vodu s kamenitým dnem.',
    ],
  },
  {
    id: 'losos_obecny', name: 'Losos obecný', latin: 'Salmo salar', family: 'lososovití',
    diet: 'dravec', sizeMin: 60, sizeMax: 100, sizeRecord: 150, rarity: 5,
    locations: ['reka'], zone: 'stred', fight: 1.4,
    facts: [
      'Narodí se v řece, vyroste v moři a pak se vrací do řeky, kde se narodil.',
      'Umí vyskočit i přes malé vodopády.',
      'Do Česka se vrací díky lidem, kteří vypouštějí mladé lososy do řeky Kamenice.',
    ],
  },
  {
    id: 'mihule_potocni', name: 'Mihule potoční', latin: 'Lampetra planeri', family: 'mihulovití',
    diet: 'bahno', sizeMin: 10, sizeMax: 16, sizeRecord: 20, rarity: 4,
    locations: ['potok'], zone: 'dno', protected: true, fight: 0.7,
    facts: [
      'Mihule vlastně není ryba – nemá čelisti, jen kulatou přísavku.',
      'Její larvy žijí několik let zahrabané v písku a bahně.',
      'Dospělá mihule už nic nejí – jen se vytře.',
    ],
  },
  {
    id: 'mnik_jednovousy', name: 'Mník jednovousý', latin: 'Lota lota', family: 'mníkovití',
    diet: 'dravec', sizeMin: 30, sizeMax: 45, sizeRecord: 75, rarity: 4,
    locations: ['reka', 'potok', 'prehrada'], zone: 'dno', night: true, protected: true,
    facts: [
      'Je to jediná sladkovodní ryba z příbuzenstva tresek.',
      'Na bradě má jeden vous – proto jednovousý.',
      'Nejčilejší je v zimě a vytírá se často pod ledem.',
    ],
  },
  {
    id: 'mrenka_mramorovana', name: 'Mřenka mramorovaná', latin: 'Barbatula barbatula', family: 'mřenkovití',
    diet: 'drobotina', sizeMin: 8, sizeMax: 12, sizeRecord: 16, rarity: 2,
    locations: ['potok', 'reka'], zone: 'dno', night: true,
    facts: [
      'U tlamy má šest vousků.',
      'Přes den se schovává pod kameny a na lov vyráží v noci.',
      'Žije jen v čisté vodě – je znakem zdravého potoka.',
    ],
  },
  {
    id: 'okoun_ricni', name: 'Okoun říční', latin: 'Perca fluviatilis', family: 'okounovití',
    diet: 'dravec', sizeMin: 12, sizeMax: 25, sizeRecord: 50, rarity: 1,
    locations: ['rybnik', 'reka', 'prehrada'], zone: 'stred',
    facts: [
      'Má tmavé příčné pruhy a oranžově červené spodní ploutve.',
      'První hřbetní ploutev má ostré ostny – pozor při držení!',
      'Malí okouni loví v hejnech.',
    ],
  },
  {
    id: 'okounek_pstruhovy', name: 'Okounek pstruhový', latin: 'Micropterus salmoides', family: 'okounkovití',
    diet: 'dravec', sizeMin: 25, sizeMax: 40, sizeRecord: 60, rarity: 4,
    locations: ['rybnik', 'prehrada'], zone: 'stred', origin: 'ze Severní Ameriky', fight: 1.2,
    facts: [
      'Pochází ze Severní Ameriky, kde patří k nejoblíbenějším rybám rybářů.',
      'Má obrovskou tlamu – anglicky se mu říká „velkohubý okoun“.',
    ],
  },
  {
    id: 'ostroretka_stehovava', name: 'Ostroretka stěhovavá', latin: 'Chondrostoma nasus', family: 'kaprovití',
    diet: 'rasy', sizeMin: 25, sizeMax: 40, sizeRecord: 50, rarity: 3,
    locations: ['reka'], zone: 'dno',
    facts: [
      'Ostrým rohovitým pyskem seškrabuje řasy z kamenů.',
      'Na jaře se stěhuje proti proudu tam, kde se vytírá.',
    ],
  },
  {
    id: 'ostrucha_krivocara', name: 'Ostrucha křivočará', latin: 'Pelecus cultratus', family: 'kaprovití',
    diet: 'drobotina', sizeMin: 20, sizeMax: 40, sizeRecord: 60, rarity: 5,
    locations: ['reka', 'prehrada'], zone: 'hladina', protected: true,
    facts: [
      'Má rovný hřbet a vypouklé břicho, takže vypadá jako nůž.',
      'Postranní čára se jí vlní jako klikatá čára – proto křivočará.',
      'Plave těsně pod hladinou.',
    ],
  },
  {
    id: 'ouklej_obecna', name: 'Ouklej obecná', latin: 'Alburnus alburnus', family: 'kaprovití',
    diet: 'drobotina', sizeMin: 10, sizeMax: 15, sizeRecord: 25, rarity: 1,
    locations: ['rybnik', 'reka', 'prehrada'], zone: 'hladina', fight: 0.7,
    facts: [
      'Z jejích lesklých šupin se kdysi vyráběly umělé perly.',
      'Plave ve velkých hejnech těsně pod hladinou.',
    ],
  },
  {
    id: 'ouklejka_pruhovana', name: 'Ouklejka pruhovaná', latin: 'Alburnoides bipunctatus', family: 'kaprovití',
    diet: 'drobotina', sizeMin: 8, sizeMax: 12, sizeRecord: 15, rarity: 3,
    locations: ['potok', 'reka'], zone: 'stred', protected: true,
    facts: [
      'Podél boku má dvojitou řadu teček, která vypadá jako proužek.',
      'Má ráda čistou a rychle tekoucí vodu.',
    ],
  },
  {
    id: 'parma_obecna_ricni', name: 'Parma obecná', alias: 'říční', latin: 'Barbus barbus', family: 'kaprovití',
    diet: 'drobotina', sizeMin: 40, sizeMax: 60, sizeRecord: 90, rarity: 3,
    locations: ['reka'], zone: 'dno', night: true, fight: 1.35,
    facts: [
      'Čtyřmi vousky hledá potravu mezi kameny na dně.',
      'V proudu je to velmi silná ryba.',
      'Pozor: jikry parmy jsou jedovaté a nejí se.',
    ],
  },
  {
    id: 'perlin_ostrobrichy', name: 'Perlín ostrobřichý', latin: 'Scardinius erythrophthalmus', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 15, sizeMax: 25, sizeRecord: 40, rarity: 1,
    locations: ['rybnik', 'reka'], zone: 'hladina',
    facts: [
      'Má jasně červené ploutve.',
      'Podobá se plotici, ale tlamičku má natočenou šikmo nahoru.',
      'Na břiše má ostrou hranu – proto ostrobřichý.',
    ],
  },
  {
    id: 'piskor_pruhovany', name: 'Piskoř pruhovaný', latin: 'Misgurnus fossilis', family: 'sekavcovití',
    diet: 'drobotina', sizeMin: 15, sizeMax: 25, sizeRecord: 30, rarity: 4,
    locations: ['rybnik'], zone: 'dno', night: true, protected: true,
    facts: [
      'Když je ve vodě málo kyslíku, polyká u hladiny vzduch a dýchá střevem.',
      'Když ho vytáhneš z vody, tence piští – odtud jeho jméno.',
      'Před bouřkou bývá neklidný, proto se mu říkalo živý barometr.',
    ],
  },
  {
    id: 'plotice_obecna', name: 'Plotice obecná', latin: 'Rutilus rutilus', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 15, sizeMax: 25, sizeRecord: 45, rarity: 1,
    locations: ['rybnik', 'reka', 'prehrada'], zone: 'stred',
    facts: [
      'Má červené oči.',
      'Patří k nejběžnějším rybám u nás – žije skoro v každé vodě.',
      'Žije v hejnech.',
    ],
  },
  {
    id: 'podoustev_ricni', name: 'Podoustev říční', latin: 'Vimba vimba', family: 'kaprovití',
    diet: 'drobotina', sizeMin: 20, sizeMax: 30, sizeRecord: 50, rarity: 3,
    locations: ['reka'], zone: 'dno',
    facts: [
      'Tlamu má na spodní straně hlavy, aby mohla sbírat potravu ze dna.',
      'Na jaře jsou samečci tmaví a mají oranžové břicho.',
    ],
  },
  {
    id: 'pstruh_duhovy_americky', name: 'Pstruh duhový', alias: 'americký', latin: 'Oncorhynchus mykiss', family: 'lososovití',
    diet: 'dravec', sizeMin: 25, sizeMax: 40, sizeRecord: 80, rarity: 2,
    locations: ['potok', 'prehrada', 'rybnik'], zone: 'stred', origin: 'ze Severní Ameriky', fight: 1.2,
    facts: [
      'Po boku má růžově fialový pruh jako duhu.',
      'U nás se chová na pstruhových farmách a vysazuje se do vody.',
    ],
  },
  {
    id: 'pstruh_obecny_potocni', name: 'Pstruh obecný', alias: 'potoční', latin: 'Salmo trutta', family: 'lososovití',
    diet: 'dravec', sizeMin: 20, sizeMax: 35, sizeRecord: 70, rarity: 2,
    locations: ['potok'], zone: 'stred', fight: 1.2,
    facts: [
      'Na boku má červené tečky se světlým lemem.',
      'Žije ve studených a čistých potocích s kamenitým dnem.',
      'Loví hmyz, který spadne na hladinu, i malé rybky.',
    ],
  },
  {
    id: 'sekavcik_horsky', name: 'Sekavčík horský', latin: 'Sabanejewia balcanica', family: 'sekavcovití',
    diet: 'drobotina', sizeMin: 7, sizeMax: 10, sizeRecord: 12, rarity: 5,
    locations: ['reka', 'potok'], zone: 'dno', protected: true,
    facts: [
      'Pod okem má malý trn, kterým se umí bránit.',
      'Rád se zahrabává do písku a štěrku.',
      'U nás je velmi vzácný.',
    ],
  },
  {
    id: 'sekavec_podunajsky', name: 'Sekavec podunajský', latin: 'Cobitis elongatoides', family: 'sekavcovití',
    diet: 'drobotina', sizeMin: 8, sizeMax: 11, sizeRecord: 13, rarity: 4,
    locations: ['reka', 'rybnik'], zone: 'dno', night: true, protected: true,
    facts: [
      'Přes den se zahrabe do písku, že mu kouká jen hlava.',
      'Pod okem má ukrytý ostrý trn.',
    ],
  },
  {
    id: 'sih_marena_severni', name: 'Síh maréna', alias: 'severní', latin: 'Coregonus maraena', family: 'lososovití',
    diet: 'plankton', sizeMin: 30, sizeMax: 45, sizeRecord: 60, rarity: 4,
    locations: ['prehrada'], zone: 'stred', origin: 'ze severní Evropy',
    facts: [
      'Potřebuje studenou vodu s dostatkem kyslíku, proto žije v hlubokých nádržích.',
      'Má malou hlavu a stříbrné šupiny.',
    ],
  },
  {
    id: 'sih_peled', name: 'Síh peleď', latin: 'Coregonus peled', family: 'lososovití',
    diet: 'plankton', sizeMin: 30, sizeMax: 40, sizeRecord: 55, rarity: 4,
    locations: ['rybnik', 'prehrada'], zone: 'stred', origin: 'ze Sibiře',
    facts: [
      'Pochází z chladných řek a jezer na Sibiři.',
      'Živí se drobným planktonem, který cedí z vody.',
    ],
  },
  {
    id: 'siven_americky', name: 'Siven americký', latin: 'Salvelinus fontinalis', family: 'lososovití',
    diet: 'dravec', sizeMin: 20, sizeMax: 35, sizeRecord: 50, rarity: 3,
    locations: ['potok'], zone: 'stred', origin: 'ze Severní Ameriky', fight: 1.1,
    facts: [
      'Přední okraje spodních ploutví má bílé.',
      'Snese i chladnou horskou vodu, kde se jiným rybám nedaří.',
    ],
  },
  {
    id: 'slunecnice_pestra', name: 'Slunečnice pestrá', latin: 'Lepomis gibbosus', family: 'okounkovití',
    diet: 'drobotina', sizeMin: 10, sizeMax: 15, sizeRecord: 22, rarity: 2,
    locations: ['rybnik'], zone: 'stred', origin: 'ze Severní Ameriky',
    facts: [
      'Je pestrá jako papoušek – modrá, zelená i oranžová.',
      'Na skřelích má černou skvrnu s červeným okrajem.',
      'Sameček vyhrabe na dně důlek a hlídá v něm jikry.',
    ],
  },
  {
    id: 'slunka_obecna_stribrita', name: 'Slunka obecná', alias: 'stříbřitá', latin: 'Leucaspius delineatus', family: 'kaprovití',
    diet: 'plankton', sizeMin: 4, sizeMax: 7, sizeRecord: 10, rarity: 1,
    locations: ['rybnik'], zone: 'hladina', fight: 0.6,
    facts: [
      'Je to jedna z nejmenších ryb u nás.',
      'Plave ve velkých třpytivých hejnech u hladiny.',
      'Samička lepí jikry na stonky rostlin do spirály a sameček je hlídá.',
    ],
  },
  {
    id: 'stika_obecna', name: 'Štika obecná', latin: 'Esox lucius', family: 'štikovití',
    diet: 'dravec', sizeMin: 40, sizeMax: 80, sizeRecord: 130, rarity: 2,
    locations: ['rybnik', 'reka', 'prehrada'], zone: 'stred', fight: 1.3,
    facts: [
      'Číhá nehybně mezi rostlinami a pak bleskově vyrazí.',
      'V tlamě má stovky ostrých zoubků.',
      'Umí spolknout i dost velkou rybu.',
    ],
  },
  {
    id: 'strevle_potocni', name: 'Střevle potoční', latin: 'Phoxinus phoxinus', family: 'kaprovití',
    diet: 'drobotina', sizeMin: 5, sizeMax: 9, sizeRecord: 13, rarity: 3,
    locations: ['potok'], zone: 'stred', protected: true, fight: 0.6,
    facts: [
      'Na jaře má sameček rudé bříško a zelenavý hřbet.',
      'Žije v hejnech v čistých a studených potocích.',
    ],
  },
  {
    id: 'strevlicka_vychodni', name: 'Střevlička východní', latin: 'Pseudorasbora parva', family: 'kaprovití',
    diet: 'vsezravec', sizeMin: 4, sizeMax: 8, sizeRecord: 11, rarity: 1,
    locations: ['rybnik', 'reka'], zone: 'stred', origin: 'z východní Asie', fight: 0.6,
    facts: [
      'Do Evropy se dostala omylem – připlula s dovezenými rybami z Asie.',
      'Je malá, ale velmi rychle se množí.',
    ],
  },
  {
    id: 'sumec_velky', name: 'Sumec velký', latin: 'Silurus glanis', family: 'sumcovití',
    diet: 'dravec', sizeMin: 80, sizeMax: 160, sizeRecord: 250, rarity: 4,
    locations: ['reka', 'prehrada', 'rybnik'], zone: 'dno', night: true, fight: 1.5,
    facts: [
      'Je to největší sladkovodní ryba u nás – může měřit přes dva a půl metru.',
      'Nemá šupiny a kolem tlamy má dlouhé vousy.',
      'Loví hlavně v noci.',
    ],
  },
  {
    id: 'sumecek_americky', name: 'Sumeček americký', latin: 'Ameiurus nebulosus', family: 'sumečkovití',
    diet: 'vsezravec', sizeMin: 15, sizeMax: 30, sizeRecord: 45, rarity: 2,
    locations: ['rybnik'], zone: 'dno', night: true, origin: 'ze Severní Ameriky',
    facts: [
      'Kolem tlamy má osm vousků.',
      'V ploutvích má ostré trny – s ním opatrně!',
    ],
  },
  {
    id: 'tolstolobec_pestry', name: 'Tolstolobec pestrý', latin: 'Hypophthalmichthys nobilis', family: 'kaprovití',
    diet: 'plankton', sizeMin: 60, sizeMax: 90, sizeRecord: 130, rarity: 3,
    locations: ['rybnik', 'prehrada'], zone: 'hladina', origin: 'z Číny', fight: 1.2,
    facts: [
      'Má obrovskou hlavu.',
      'Cedí z vody drobný plankton jako cedníkem.',
    ],
  },
  {
    id: 'tolstolobik_bily', name: 'Tolstolobik bílý', latin: 'Hypophthalmichthys molitrix', family: 'kaprovití',
    diet: 'plankton', sizeMin: 60, sizeMax: 90, sizeRecord: 110, rarity: 3,
    locations: ['rybnik', 'prehrada'], zone: 'hladina', origin: 'z Číny', fight: 1.2,
    facts: [
      'Živí se drobnými řasami, které cedí z vody.',
      'Když se lekne, umí vyskočit vysoko nad hladinu.',
      'Oči má posazené hodně nízko na hlavě.',
    ],
  },
  {
    id: 'uhor_ricni', name: 'Úhoř říční', latin: 'Anguilla anguilla', family: 'úhořovití',
    diet: 'dravec', sizeMin: 50, sizeMax: 80, sizeRecord: 150, rarity: 4,
    locations: ['reka', 'rybnik', 'prehrada'], zone: 'dno', night: true, fight: 1.2,
    facts: [
      'Narodí se daleko v Sargasovém moři a do našich řek připluje jako průsvitný úhoříček.',
      'V mokré trávě se umí plazit i po souši z jedné vody do druhé.',
      'Aktivní je hlavně v noci.',
    ],
  },
  {
    id: 'vranka_obecna', name: 'Vranka obecná', latin: 'Cottus gobio', family: 'vrankovití',
    diet: 'drobotina', sizeMin: 8, sizeMax: 12, sizeRecord: 18, rarity: 3,
    locations: ['potok'], zone: 'dno', night: true, protected: true,
    facts: [
      'Má širokou hlavu a velké prsní ploutve jako vějíře.',
      'Nemá plynový měchýř, a tak se nevznáší, ale poskakuje po dně.',
      'Sameček hlídá jikry pod kamenem.',
    ],
  },
];

export const SPECIES_BY_ID: ReadonlyMap<string, Species> = new Map(SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): Species {
  const s = SPECIES_BY_ID.get(id);
  if (!s) throw new Error(`Unknown species ${id}`);
  return s;
}

export const RARITY_LABEL: Record<Rarity, string> = {
  1: 'Běžná',
  2: 'Hojná',
  3: 'Vzácnější',
  4: 'Vzácná',
  5: 'Legendární',
};

export const DIET_LABEL: Record<Diet, { icon: string; text: string }> = {
  rostliny: { icon: '🌿', text: 'vodní rostliny' },
  plankton: { icon: '💧', text: 'plankton (drobounké řasy a živočichové)' },
  drobotina: { icon: '🐛', text: 'hmyz, larvy, červi a korýši' },
  vsezravec: { icon: '🍽️', text: 'skoro všechno – rostliny i drobné živočichy' },
  dravec: { icon: '🐟', text: 'jiné ryby (je to dravec)' },
  rasy: { icon: '🪨', text: 'řasy seškrabané z kamenů' },
  bahno: { icon: '🟤', text: 'drobnosti z bahna a písku' },
};

export const ZONE_LABEL: Record<Zone, { icon: string; text: string }> = {
  hladina: { icon: '〰️', text: 'u hladiny' },
  stred: { icon: '↔️', text: 've volné vodě' },
  dno: { icon: '⬇️', text: 'u dna' },
};
