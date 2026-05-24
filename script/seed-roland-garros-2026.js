// seed-roland-garros-2026.js
// Run with: node seed-roland-garros-2026.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ucemvnousyelnamiacfb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2tvx_jCWYjxrrjT1gIhSRg_EsRFtNED'; // use service role key for seeding
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── RAW DRAW DATA ────────────────────────────────────────────────────────────
// Format: [player1_name, player1_nationality, player1_seed, player2_name, player2_nationality, player2_seed]
// seed = null for unseeded players
// (Q) = Qualifier, (W) = Wildcard, (L) = Lucky Loser

const MENS_MATCHES = [
  ['J.Sinner',              'ITA', 1,  'C.Tabur',             'FRA', null],
  ['J.Fearnley',            'GBR', null, 'JM.Cerundolo',      'ARG', null],
  ['M.Landaluce',           'ESP', null, 'JC.Prado Angelo',   'BOL', null], // Q
  ['V.Kopriva',             'CZE', null, 'C.Moutet',          'FRA', 30],
  ['A.Rinderknech',         'FRA', 22,  'J.Rodionov',         'AUT', null], // Q
  ['M.Fucsovics',           'HUN', null, 'M.Berrettini',      'ITA', null],
  ['E.Quinn',               'USA', null, 'F.Comesana',        'ARG', null],
  ['S.Ofner',               'AUT', null, 'L.Darderi',         'ITA', 14],
  ['A.Bublik',              'KAZ', 9,   'JL.Struff',          'GER', null],
  ['J.Faria',               'POR', null, 'D.Shapovalov',      'CAN', null], // Q
  ['J.Munar',               'ESP', null, 'H.Hurkacz',         'POL', null],
  ['E.Spizzirri',           'USA', null, 'F.Tiafoe',          'USA', 19],
  ['T.Griekspoor',          'NED', 29,  'M.Arnaldi',          'ITA', null],
  ['A.Muller',              'FRA', null, 'S.Tsitsipas',       'GRE', null],
  ['R.Collignon',           'BEL', null, 'A.Vukic',           'AUS', null],
  ['D.Merida',              'ESP', null, 'B.Shelton',         'USA', 5],
  ['F.Auger-Aliassime',     'CAN', 4,   'D.Altmaier',         'GER', null],
  ['S.Baez',                'ARG', null, 'RA.Burruchaga',     'ARG', null],
  ['L.Van Assche',          'FRA', null, 'P.Kypson',          'USA', null],
  ['R.Bautista Agut',       'ESP', null, 'B.Nakashima',       'USA', 31],
  ['C.Norrie',              'GBR', 20,  'AD.Vallejo',         'PAR', null],
  ['M.Cilic',               'CRO', null, 'M.Kouame',          'FRA', null], // W
  ['A.Tabilo',              'CHI', null, 'K.Majchrzak',       'POL', null],
  ['T.Faurel',              'FRA', null, 'V.Vacherot',        'MON', 16], // Q
  ['F.Cobolli',             'ITA', 10,  'A.Pellegrino',       'ITA', null], // Q
  ['Y.Wu',                  'CHN', null, 'M.Giron',           'USA', null],
  ['F.Diaz Acosta',         'ARG', null, 'Z.Zhang',           'CHN', null], // Q
  ['C.Garin',               'CHI', null, 'L.Tien',            'USA', 18],
  ['F.Cerundolo',           'ARG', 25,  'B.Van De Zandschulp','NED', null],
  ['H.Gaston',              'FRA', null, 'G.Monfils',         'FRA', null], // W, W
  ['A.Popyrin',             'AUS', null, 'Z.Svajda',          'USA', null],
  ['A.Walton',              'AUS', null, 'D.Medvedev',        'RUS', 6], // W
  ['A.De Minaur',           'AUS', 8,   'T.Samuel',           'GBR', null], // Q
  ['A.Blockx',              'BEL', null, 'C.Wong',            'HKG', null], // L
  ['M.Navone',              'ARG', null, 'J.Brooksby',        'USA', null],
  ['T.Droguet',             'FRA', null, 'J.Mensik',          'CZE', 26], // W
  ['TM.Etcheverry',         'ARG', 23,  'N.Borges',           'POR', null],
  ['M.Kecmanovic',          'SRB', null, 'F.Marozsan',        'HUN', null],
  ['E.Nava',                'USA', null, 'C.Ugo Carabelli',   'ARG', null], // Q
  ['I.Buse',                'PER', null, 'A.Rublev',          'RUS', 11],
  ['C.Ruud',                'NOR', 15,  'R.Safiullin',        'RUS', null], // Q
  ['H.Medjedovic',          'SRB', null, 'Y.Hanfmann',        'GER', null],
  ['L.Sonego',              'ITA', null, 'PH.Herbert',        'FRA', null], // Q
  ['R.Hijikata',            'AUS', null, 'T.Paul',            'USA', 24],
  ['J.Fonseca',             'BRA', 28,  'L.Pavlovic',         'FRA', null], // Q
  ['M.Zheng',               'USA', null, 'D.Prizmic',         'CRO', null], // Q
  ['H.Dellien',             'BOL', null, 'V.Royer',           'FRA', null], // Q
  ['G.Mpetshi Perricard',   'FRA', null, 'N.Djokovic',        'SRB', 3],
  ['T.Fritz',               'USA', 7,   'N.Basavareddy',      'USA', null], // W
  ['A.Shevchenko',          'KAZ', null, 'A.Michelsen',       'USA', null],
  ['J.Duckworth',           'AUS', null, 'G.Diallo',          'CAN', null],
  ['A.Kovacevic',           'USA', null, 'R.Jodar',           'ESP', 27],
  ['A.Davidovich Fokina',   'ESP', 21,  'D.Dzumhur',          'BIH', null],
  ['P.Llamas Ruiz',         'ESP', null, 'TA.Tirante',        'ARG', null], // Q
  ['T.Kokkinakis',          'AUS', null, 'T.Atmane',          'FRA', null],
  ['P.Carreno Busta',       'ESP', null, 'J.Lehecka',         'CZE', 12],
  ['K.Khachanov',           'RUS', 13,  'A.Gea',              'FRA', null], // W
  ['K.Jacquet',             'FRA', null, 'M.Trungelliti',     'ARG', null], // Q
  ['F.Cina',                'ITA', null, 'R.Opelka',          'USA', null], // Q
  ['S.Wawrinka',            'SUI', null, 'J.De Jong',         'NED', null], // L
  ['U.Humbert',             'FRA', 32,  'A.Mannarino',        'FRA', null],
  ['Q.Halys',               'FRA', null, 'M.Bellucci',        'ITA', null],
  ['T.Machac',              'CZE', null, 'Z.Bergs',           'BEL', null],
  ['B.Bonzi',               'FRA', null, 'A.Zverev',          'GER', 2],
];

const WOMENS_MATCHES = [
  ['A.Sabalenka',           'BLR', 1,   'J.Bouzas Maneiro',  'ESP', null],
  ['L.Fruhvirtova',         'CZE', null, 'E.Jacquemot',       'FRA', null], // Q
  ['D.Kasatkina',           'AUS', null, 'Z.Sonmez',          'TUR', null],
  ['S.Bandecchi',           'SUI', null, 'C.Bucsa',           'ESP', 31], // Q
  ['I.Jovic',               'USA', 17,  'A.Eala',             'PHI', null],
  ['E.Navarro',             'USA', null, 'J.Tjen',            'INA', null],
  ['D.Vekic',               'CRO', null, 'A.Tubello',         'FRA', null], // W
  ['L.Siegemund',           'GER', null, 'N.Osaka',           'JPN', 16],
  ['V.Mboko',               'CAN', 9,   'N.Bartunkova',       'CZE', null],
  ['S.Waltert',             'SUI', null, 'K.Siniakova',       'CZE', null],
  ['A.Ruzic',               'CRO', null, 'A.Krueger',         'USA', null], // Q
  ['H.Vandewinkel',         'BEL', null, 'M.Keys',            'USA', 19],
  ['D.Shnaider',            'RUS', 25,  'R.Zarazua',          'MEX', null],
  ['H.Guo',                 'CHN', null, 'M.Kessler',         'USA', null], // Q
  ['E.Pridankina',          'RUS', null, 'O.Oliynykova',      'UKR', null], // Q
  ['K.Birrell',             'AUS', null, 'J.Pegula',          'USA', 5],
  ['C.Gauff',               'USA', 4,   'T.Townsend',         'USA', null],
  ['D.Galfi',               'HUN', null, 'M.Sherif',          'EGY', null], // Q
  ['A.Urhobo',              'USA', null, 'K.Boulter',         'GBR', null], // W
  ['M.Joint',               'AUS', null, 'A.Potapova',        'RUS', 28],
  ['A.Kalinskaya',          'RUS', 22,  'L.Boisson',          'FRA', null],
  ['A.Korneeva',            'RUS', null, 'E.Cocciaretto',     'ITA', null], // Q
  ['T.Gibson',              'AUS', null, 'Y.Putintseva',      'KAZ', null],
  ['C.Osorio',              'COL', null, 'E.Alexandrova',     'RUS', 14],
  ['L.Noskova',             'CZE', 12,  'M.Sakkari',          'GRE', null],
  ['C.Liu',                 'USA', null, 'M.Uchijima',        'JPN', null], // Q
  ['M.Chwalinska',          'POL', null, 'Q.Zheng',           'CHN', null], // Q
  ['T.Maria',               'GER', null, 'E.Mertens',         'BEL', 23],
  ['A.Li',                  'USA', 30,  'S.Zhang',            'CHN', null],
  ['A.Kalinina',            'UKR', null, 'D.Parry',           'FRA', null],
  ['J.Grabher',             'AUT', null, 'R.Sramkova',        'SVK', null], // Q
  ['T.Rakotomanga Rajaonah','FRA', null, 'A.Anisimova',       'USA', 6], // W
  ['E.Svitolina',           'UKR', 7,   'A.Bondar',           'HUN', null],
  ['K.Quevedo',             'ESP', null, 'L.Jeanjean',        'FRA', null], // Q, W
  ['S.Sorribes Tormo',      'ESP', null, 'T.Korpatsch',       'GER', null],
  ['L.Tagger',              'AUT', null, 'X.Wang',            'CHN', 32],
  ['C.Tauson',              'DEN', 21,  'D.Snigur',           'UKR', null],
  ['S.Kenin',               'USA', null, 'P.Stearns',         'USA', null],
  ['A.Tomljanovic',         'AUS', null, 'C.Mcnally',         'USA', null],
  ['S.Kraus',               'AUT', null, 'B.Bencic',          'SUI', 11], // Q
  ['M.Kostyuk',             'UKR', 15,  'O.Selekhmeteva',     'RUS', null],
  ['K.Volynets',            'USA', null, 'C.Burel',           'FRA', null], // W
  ['P.Udvardy',             'HUN', null, 'V.Golubic',         'SUI', null],
  ['A.Parks',               'USA', null, 'L.Fernandez',       'CAN', 24],
  ['J.Ostapenko',           'LAT', 29,  'E.Seidel',           'GER', null],
  ['T.Valentova',           'CZE', null, 'M.Linette',         'POL', null],
  ['S.Bejlek',              'CZE', null, 'S.Stephens',        'USA', null], // Q
  ['E.Jones',               'AUS', null, 'I.Swiatek',         'POL', 3], // W
  ['M.Andreeva',            'RUS', 8,   'F.Ferro',            'FRA', null], // W
  ['M.Bassols Ribera',      'ESP', null, 'E.Arango',          'COL', null], // Q
  ['F.Jones',               'GBR', null, 'B.Haddad Maia',     'BRA', null],
  ['L.Bronzetti',           'ITA', null, 'M.Bouzkova',        'CZE', 27], // Q
  ['L.Samsonova',           'RUS', 20,  'J.Teichmann',        'SUI', null],
  ['M.Frech',               'POL', null, 'EG.Ruse',           'ROU', null],
  ['K.Rakhimova',           'UZB', null, 'J.Cristian',        'ROU', null],
  ['A.Zakharova',           'RUS', null, 'K.Muchova',         'CZE', 10],
  ['J.Paolini',             'ITA', 13,  'D.Yastremska',       'UKR', null],
  ['E.Raducanu',            'GBR', null, 'S.Sierra',          'ARG', null],
  ['P.Marcinko',            'CRO', null, 'E.Lys',             'GER', null],
  ['K.Efremova',            'FRA', null, 'S.Cirstea',         'ROU', 18], // W
  ['H.Baptiste',            'USA', 26,  'B.Krejcikova',       'CZE', null],
  ['D.Kovinic',             'MNE', null, 'X.Wang',            'CHN', null], // Q
  ['A.Blinkova',            'RUS', null, 'Y.Starodubtseva',   'UKR', null],
  ['V.Erjavec',             'SLO', null, 'E.Rybakina',        'KAZ', 2],
];

// ─── SEED FUNCTION ────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Starting Roland Garros 2026 seed...\n');

  // 1. Insert tournament
  console.log('📅 Inserting tournament...');
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .insert({
      name: 'Roland Garros 2026',
      slug: 'roland-garros-2026',
      year: 2026,
      start_date: '2026-05-25',
      end_date: '2026-06-08',
      status: 'upcoming',
    })
    .select()
    .single();
  if (tErr) throw new Error(`Tournament insert failed: ${tErr.message}`);
  console.log(`✅ Tournament created: ${tournament.id}\n`);

  // 2. Insert draws
  console.log('🎾 Inserting draws...');
  const { data: draws, error: dErr } = await supabase
    .from('draws')
    .insert([
      { tournament_id: tournament.id, gender: 'mens' },
      { tournament_id: tournament.id, gender: 'womens' },
    ])
    .select();
  if (dErr) throw new Error(`Draws insert failed: ${dErr.message}`);
  const mensDraw = draws.find(d => d.gender === 'mens');
  const womensDraw = draws.find(d => d.gender === 'womens');
  console.log(`✅ Men's draw: ${mensDraw.id}`);
  console.log(`✅ Women's draw: ${womensDraw.id}\n`);

  // 3. Collect all unique players and insert them
  console.log('👤 Inserting players...');
  const allPlayers = new Map(); // name -> { name, nationality, seed }

  const collectPlayers = (matches) => {
    for (const [p1name, p1nat, p1seed, p2name, p2nat, p2seed] of matches) {
      if (!allPlayers.has(p1name)) allPlayers.set(p1name, { name: p1name, nationality: p1nat, seed: p1seed });
      if (!allPlayers.has(p2name)) allPlayers.set(p2name, { name: p2name, nationality: p2nat, seed: p2seed });
    }
  };
  collectPlayers(MENS_MATCHES);
  collectPlayers(WOMENS_MATCHES);

  const playerRows = Array.from(allPlayers.values());
  const { data: insertedPlayers, error: pErr } = await supabase
    .from('players')
    .insert(playerRows)
    .select();
  if (pErr) throw new Error(`Players insert failed: ${pErr.message}`);

  // Build a lookup map: name -> id
  const playerIdMap = new Map(insertedPlayers.map(p => [p.name, p.id]));
  console.log(`✅ ${insertedPlayers.length} players inserted\n`);

  // 4. Insert Round 1 matches
  const insertMatches = async (matches, drawId, gender) => {
    console.log(`🎯 Inserting ${gender} Round 1 matches...`);
    const matchRows = matches.map(([p1name, , , p2name], index) => ({
      draw_id: drawId,
      round: 1,
      match_number: index + 1,
      player1_id: playerIdMap.get(p1name),
      player2_id: playerIdMap.get(p2name),
      winner_id: null,
    }));

    const { error: mErr } = await supabase.from('matches').insert(matchRows);
    if (mErr) throw new Error(`${gender} matches insert failed: ${mErr.message}`);
    console.log(`✅ ${matchRows.length} ${gender} matches inserted`);
  };

  await insertMatches(MENS_MATCHES, mensDraw.id, "Men's");
  await insertMatches(WOMENS_MATCHES, womensDraw.id, "Women's");

  // 5. Insert placeholder matches for rounds 2-7 (no players yet)
  const insertFutureRounds = async (drawId, gender) => {
    console.log(`\n📋 Inserting placeholder rounds 2-7 for ${gender}...`);
    const rounds = [
      { round: 2, count: 32 },
      { round: 3, count: 16 },
      { round: 4, count: 8 },
      { round: 5, count: 4 },  // QF
      { round: 6, count: 2 },  // SF
      { round: 7, count: 1 },  // Final
    ];

    for (const { round, count } of rounds) {
      const rows = Array.from({ length: count }, (_, i) => ({
        draw_id: drawId,
        round,
        match_number: i + 1,
        player1_id: null,
        player2_id: null,
        winner_id: null,
      }));
      const { error } = await supabase.from('matches').insert(rows);
      if (error) throw new Error(`Round ${round} ${gender} insert failed: ${error.message}`);
      console.log(`  ✅ Round ${round}: ${count} matches`);
    }
  };

  await insertFutureRounds(mensDraw.id, "Men's");
  await insertFutureRounds(womensDraw.id, "Women's");

  console.log('\n🎉 Seed complete! Roland Garros 2026 is ready.');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});