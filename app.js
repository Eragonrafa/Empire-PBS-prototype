// State holders
let pokemonList = [];
let movesMap = {};
let abilitiesMap = {};

// Type Chart Multipliers (Defensive matchups)
const TYPE_CHART = {
  NORMAL:   { ROCK: 0.5, GHOST: 0, STEEL: 0.5, FAIRY: 2 },
  FIRE:     { FIRE: 0.5, WATER: 0.5, GRASS: 2, ICE: 2, BUG: 2, ROCK: 0.5, DRAGON: 0.5, STEEL: 2 },
  WATER:    { FIRE: 2, WATER: 0.5, GRASS: 0.5, GROUND: 2, ROCK: 2, DRAGON: 0.5, ICE: 0.5 },
  ELECTRIC: { WATER: 2, ELECTRIC: 0.5, GRASS: 0.5, GROUND: 0, FLYING: 2, DRAGON: 0.5, STEEL: 2, PSYCHIC: 0.5 },
  GRASS:    { FIRE: 0.5, WATER: 2, GRASS: 0.5, POISON: 0.5, GROUND: 2, FLYING: 0.5, BUG: 0.5, ROCK: 2, DRAGON: 0.5, STEEL: 0.5 },
  ICE:      { FIRE: 0.5, WATER: 0.5, GRASS: 2, ICE: 0.5, GROUND: 2, FLYING: 2, DRAGON: 2, STEEL: 0.5 },
  FIGHTING: { NORMAL: 2, ICE: 2, POISON: 0.5, FLYING: 0.5, PSYCHIC: 0.5, BUG: 0.5, ROCK: 2, GHOST: 0, DARK: 2, STEEL: 2, FAIRY: 0.5 },
  POISON:   { GRASS: 2, POISON: 0.5, GROUND: 0.5, ROCK: 0.5, GHOST: 0.5, STEEL: 0, FAIRY: 2, WATER: 2 },
  GROUND:   { FIRE: 2, ELECTRIC: 2, GRASS: 0.5, POISON: 2, FLYING: 0, BUG: 0.5, ROCK: 2, STEEL: 2, WATER: 0.5 },
  FLYING:   { ELECTRIC: 0.5, GRASS: 2, FIGHTING: 2, BUG: 2, ROCK: 0.5, STEEL: 0.5 },
  PSYCHIC:  { FIGHTING: 2, PSYCHIC: 0.5, DARK: 0, STEEL: 0.5, ELECTRIC: 2, NORMAL: 2 },
  BUG:      { FIRE: 0.5, GRASS: 2, FIGHTING: 0.5, POISON: 0.5, FLYING: 0.5, PSYCHIC: 2, GHOST: 0.5, DARK: 2, STEEL: 0.5 },
  ROCK:     { FIRE: 2, ICE: 2, FIGHTING: 0.5, GROUND: 0.5, FLYING: 2, BUG: 2, STEEL: 0.5 },
  GHOST:    { NORMAL: 0, PSYCHIC: 2, GHOST: 2, DARK: 0.5, FAIRY: 0.5 },
  DRAGON:   { DRAGON: 2, STEEL: 0.5, FAIRY: 0 },
  DARK:     { FIGHTING: 0.5, PSYCHIC: 2, GHOST: 2, DARK: 0.5, FAIRY: 0.5, POISON: 2, BUG: 0.5 },
  STEEL:    { FIRE: 0.5, WATER: 0.5, ELECTRIC: 0.5, ICE: 2, ROCK: 2, STEEL: 0.5, FAIRY: 2 },
  FAIRY:    { Normal: 0.5, FIGHTING: 2, POISON: 0.5, DRAGON: 2, DARK: 2, STEEL: 0.5 }
};

const ALL_TYPES = [
  'NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE',
  'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG',
  'ROCK', 'GHOST', 'DRAGON', 'STEEL', 'DARK', 'FAIRY'
];

// Essentials v18 Move Flags Mapping Dictionary
const MOVE_FLAGS_DICT = {
  'a': 'Makes Contact',
  'b': 'Blocked by Protect',
  'c': 'Magic Coat reflects',
  'd': 'Snatch steals',
  'e': 'Mirror Move copies',
  'f': 'Can flinch',
  'g': 'Boosting move',
  'h': 'High Critical Hit Rate',
  'i': 'Biting Move',
  'j': 'Punching Move ',
  'k': 'Sound-Based Move',
  'l': 'Powder Move',
  'm': 'Pulse Move',
  'n': 'Bomb Move',
  'o': 'Wind Move',
  'p': 'spread move'
};

// Application Initialization
async function init() {
  try {
    const [pokeRes, movesRes, abilRes] = await Promise.all([
      fetch('./pokemon.json'),
      fetch('./moves.json'),
      fetch('./abilities.json')
    ]);

    const pokeData = await pokeRes.json();
    movesMap = await movesRes.json();
    abilitiesMap = await abilRes.json();

    pokemonList = Object.values(pokeData);

    setupFilterListeners();
    applyFiltersAndSort();
  } catch (err) {
    console.error("Failed to load compendium data:", err);
    document.getElementById('results-count').innerText = "Error loading data. Check console for details.";
  }
}

// Format 3+ digit padded number (1 -> 001, 25 -> 025, 1093 -> 1093)
function formatSpriteId(idNum) {
  const parsed = parseInt(idNum, 10);
  if (isNaN(parsed)) return idNum;
  return parsed < 1000 ? String(parsed).padStart(3, '0') : String(parsed);
}

// Build exact front sprite filename
function getSpriteUrl(pkmn) {
  const rawId = pkmn.BaseDexNumber || String(pkmn.id || '').split('.')[0];
  const paddedId = formatSpriteId(rawId);
  const formNum = pkmn.FormNumber || (String(pkmn.id || '').includes('.') ? String(pkmn.id).split('.')[1] : '');
  const formSuffix = formNum ? `_${formNum}` : '';

  return `./spritefo/${paddedId}${formSuffix}.png`;
}

// Centralized location finder (checks both window helper and direct object)
function getPokemonLocationData(pkmn) {
  if (typeof getExtraData === 'function') {
    const res = getExtraData(pkmn);
    if (res) return res;
  }
  if (typeof pokemonExtraData !== 'undefined') {
    const internalKey = (pkmn.InternalName || '').toUpperCase();
    if (pokemonExtraData[internalKey]) return pokemonExtraData[internalKey];

    const formNum = pkmn.FormNumber ? `_${pkmn.FormNumber}` : '';
    if (formNum && pokemonExtraData[`${internalKey}${formNum}`]) {
      return pokemonExtraData[`${internalKey}${formNum}`];
    }

    const nameKey = (pkmn.Name || '').toUpperCase();
    if (pokemonExtraData[nameKey]) return pokemonExtraData[nameKey];

    const idKey = String(pkmn.id || '');
    if (pokemonExtraData[idKey]) return pokemonExtraData[idKey];
  }
  return null;
}

function getStatArray(baseStatsStr) {
  if (!baseStatsStr) return [0, 0, 0, 0, 0, 0];
  return baseStatsStr.split(',').map(s => parseInt(s.trim(), 10) || 0);
}

function calculateBST(baseStatsStr) {
  return getStatArray(baseStatsStr).reduce((a, b) => a + b, 0);
}

function parseMoveFlags(flagsStr) {
  if (!flagsStr) return [];
  return flagsStr.split('').map(f => MOVE_FLAGS_DICT[f.toLowerCase()]).filter(Boolean);
}

function calculateDefensiveMatchups(t1, t2) {
  const matchups = {};
  ALL_TYPES.forEach(attackingType => {
    let multiplier = 1;
    if (t1 && TYPE_CHART[attackingType] && TYPE_CHART[attackingType][t1] !== undefined) {
      multiplier *= TYPE_CHART[attackingType][t1];
    }
    if (t2 && TYPE_CHART[attackingType] && TYPE_CHART[attackingType][t2] !== undefined) {
      multiplier *= TYPE_CHART[attackingType][t2];
    }
    matchups[attackingType] = multiplier;
  });
  return matchups;
}

function formatMoveTag(moveId, extraLabel = '') {
  const move = movesMap[moveId];
  const moveType = move && move.Type ? move.Type.toUpperCase() : '';
  const isColorEnabled = document.getElementById('color-moves-toggle')?.checked;
  
  const typeClass = (isColorEnabled && moveType) ? `move-color-${moveType}` : '';
  const label = extraLabel ? `${moveId} (${extraLabel})` : moveId;

  return `<span class="interactive-tag ${typeClass}" onclick="openMoveModal('${moveId}')">${label}</span>`;
}

// Table Rendering
function renderTable(list) {
  const tbody = document.getElementById('pokemon-rows');
  tbody.innerHTML = '';
  document.getElementById('results-count').innerText = `Showing ${list.length} Pokémon`;

  list.forEach(pkmn => {
    const stats = getStatArray(pkmn.BaseStats);
    const bst = calculateBST(pkmn.BaseStats);

    const typesFormatted = [pkmn.Type1, pkmn.Type2]
      .filter(Boolean)
      .map(t => `<span class="badge type-${t.toUpperCase()}">${t}</span>`)
      .join(' ');

    const statsFormatted = `
      <div class="stat-grid">
        <div class="stat-cell"><span class="stat-lbl">HP</span> <span class="stat-val">${stats[0]}</span></div>
        <div class="stat-cell"><span class="stat-lbl">ATK</span> <span class="stat-val">${stats[1]}</span></div>
        <div class="stat-cell"><span class="stat-lbl">DEF</span> <span class="stat-val">${stats[2]}</span></div>
        <div class="stat-cell"><span class="stat-lbl">SPA</span> <span class="stat-val">${stats[4]}</span></div>
        <div class="stat-cell"><span class="stat-lbl">SPD</span> <span class="stat-val">${stats[5]}</span></div>
        <div class="stat-cell"><span class="stat-lbl">SPE</span> <span class="stat-val">${stats[3]}</span></div>
      </div>
    `;

    // Abilities
    let abilitiesFormatted = '';
    if (pkmn.Abilities) {
      const abs = pkmn.Abilities.split(',').map(a => a.trim()).filter(Boolean);
      abilitiesFormatted = abs.map(a => `<span class="interactive-tag" onclick="openAbilityModal('${a}')">${a}</span>`).join(', ');
    }
    if (pkmn.HiddenAbility) {
      const ha = pkmn.HiddenAbility.trim();
      const haSpan = `<span class="interactive-tag ha-tag" onclick="openAbilityModal('${ha}')">${ha} (HA)</span>`;
      abilitiesFormatted = abilitiesFormatted ? `${abilitiesFormatted} | ${haSpan}` : haSpan;
    }

    // Evolutions
    let evolutionsFormatted = '';
    if (pkmn.Evolutions) {
      const evoParts = pkmn.Evolutions.split(',').map(e => e.trim()).filter(Boolean);
      let evoList = [];
      for (let i = 0; i < evoParts.length; i += 3) {
        const target = evoParts[i];
        const method = evoParts[i + 1] || '';
        const param = evoParts[i + 2] || '';
        if (target) {
          evoList.push(`${target} (${method}${param ? ': ' + param : ''})`);
        }
      }
      if (evoList.length > 0) {
        evolutionsFormatted = `<div class="detail-line"><strong>Evolutions:</strong> ${evoList.join(', ')}</div>`;
      }
    }

    // Level-up Moves
    const moveTokens = (pkmn.Moves || "").split(',').map(m => m.trim()).filter(Boolean);
    let movesFormatted = [];
    for (let i = 0; i < moveTokens.length; i += 2) {
      const lvl = moveTokens[i];
      const moveName = moveTokens[i + 1];
      if (moveName) {
        movesFormatted.push(formatMoveTag(moveName, lvl));
      }
    }

    // Egg Moves
    const eggMovesTokens = (pkmn.EggMoves || "").split(',').map(m => m.trim()).filter(Boolean);
    let eggMovesFormatted = eggMovesTokens.map(m => formatMoveTag(m));

    // TM Moves
    const tmMoves = pkmn.TMMoves || [];
    let tmMovesFormatted = tmMoves.map(m => formatMoveTag(m));

    // Tutor Moves
    const tutorMoves = pkmn.TutorMoves || [];
    let tutorMovesFormatted = tutorMoves.map(m => formatMoveTag(m));

    // Extra Data (Encounters / Location)
    let extraFormatted = '';
    const extra = getPokemonLocationData(pkmn);
    if (extra && (extra.location || extra.available)) {
      extraFormatted = `
        <div class="detail-line highlight-line">
          ${extra.location ? `<strong>Location:</strong> ${extra.location}` : ''}
          ${extra.available ? `<span style="margin-left: 12px;"><strong>Available from:</strong> <span class="badge" style="background:#4b5563;">${extra.available}</span></span>` : ''}
        </div>
      `;
    }

    const displayId = pkmn.BaseDexNumber ? `${pkmn.BaseDexNumber}` : `${pkmn.id}`;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="col-id">${displayId}</td>
      <td class="col-sprite">
        <img 
          class="pokemon-sprite" 
          src="${getSpriteUrl(pkmn)}" 
          alt="${pkmn.Name || pkmn.InternalName}" 
          loading="lazy"
          onerror="this.style.display='none';"
        />
      </td>
      <td class="col-name">
        <span class="interactive-tag name-tag" onclick="openMatchupModal('${pkmn.id}')">${pkmn.Name || pkmn.InternalName}</span>
      </td>
      <td class="col-type">${typesFormatted}</td>
      <td class="col-bst"><strong>${bst}</strong></td>
      <td class="col-stats">${statsFormatted}</td>
      <td class="col-details">
        <div class="detail-line">
          <strong>Abilities:</strong> ${abilitiesFormatted || 'None'}
          <span class="detail-sep">•</span>
          <strong>Egg Group:</strong> ${pkmn.Compatibility || 'Undiscovered'}
          ${pkmn.Height ? `<span class="detail-sep">•</span><strong>Height:</strong> ${pkmn.Height} m` : ''}
          ${pkmn.Weight ? `<span class="detail-sep">•</span><strong>Weight:</strong> ${pkmn.Weight} kg` : ''}
        </div>
        ${extraFormatted}
        ${evolutionsFormatted}
        ${movesFormatted.length > 0 ? `<div class="detail-line"><strong>Moves:</strong> ${movesFormatted.join(', ')}</div>` : ''}
        ${eggMovesFormatted.length > 0 ? `<div class="detail-line"><strong>Egg Moves:</strong> ${eggMovesFormatted.join(', ')}</div>` : ''}
        ${tmMovesFormatted.length > 0 ? `<div class="detail-line"><strong>TM Moves:</strong> ${tmMovesFormatted.join(', ')}</div>` : ''}
        ${tutorMovesFormatted.length > 0 ? `<div class="detail-line"><strong>Tutor Moves:</strong> ${tutorMovesFormatted.join(', ')}</div>` : ''}
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Filter and Sort Controller
function applyFiltersAndSort() {
  const nameQuery = document.getElementById('filter-name').value.toLowerCase().trim();
  const type1Query = document.getElementById('filter-type1').value.toUpperCase();
  const type2Query = document.getElementById('filter-type2').value.toUpperCase();
  const locQuery = document.getElementById('filter-location').value.toLowerCase().trim();
  const eggQuery = document.getElementById('filter-egg').value.toLowerCase().trim();
  
  const lvlEggMoveQuery = document.getElementById('filter-lvl-egg-move').value.toLowerCase().trim();
  const tmTutorMoveQuery = document.getElementById('filter-tm-tutor-move').value.toLowerCase().trim();
  
  const abilityQuery = document.getElementById('filter-ability').value.toLowerCase().trim();
  const sortBy = document.getElementById('sort-by').value;

  let filtered = pokemonList.filter(pkmn => {
    const nameMatch = !nameQuery || 
      (pkmn.Name && pkmn.Name.toLowerCase().includes(nameQuery)) ||
      (pkmn.InternalName && pkmn.InternalName.toLowerCase().includes(nameQuery));
    
    let typeMatch = true;
    const pTypes = [pkmn.Type1, pkmn.Type2].filter(Boolean);
    if (type1Query && type2Query) {
      typeMatch = pTypes.includes(type1Query) && pTypes.includes(type2Query);
    } else if (type1Query) {
      typeMatch = pTypes.includes(type1Query);
    } else if (type2Query) {
      typeMatch = pTypes.includes(type2Query);
    }

    const eggMatch = !eggQuery || (pkmn.Compatibility && pkmn.Compatibility.toLowerCase().includes(eggQuery));

    // Location / Episode filter check
    let locMatch = true;
    if (locQuery) {
      const extra = getPokemonLocationData(pkmn);
      if (extra) {
        const loc = (extra.location || '').toLowerCase();
        const ep = (extra.available || '').toLowerCase();
        locMatch = loc.includes(locQuery) || ep.includes(locQuery);
      } else {
        locMatch = false;
      }
    }
    
    // Level / Egg move filter
    const lvlEggMatch = !lvlEggMoveQuery || 
      (pkmn.Moves && pkmn.Moves.toLowerCase().includes(lvlEggMoveQuery)) ||
      (pkmn.EggMoves && pkmn.EggMoves.toLowerCase().includes(lvlEggMoveQuery));

    // TM / Tutor move filter
    const tmTutorMatch = !tmTutorMoveQuery || 
      (pkmn.TMMoves && pkmn.TMMoves.some(m => m.toLowerCase().includes(tmTutorMoveQuery))) ||
      (pkmn.TutorMoves && pkmn.TutorMoves.some(m => m.toLowerCase().includes(tmTutorMoveQuery)));

    const abilityMatch = !abilityQuery || 
      (pkmn.Abilities && pkmn.Abilities.toLowerCase().includes(abilityQuery)) || 
      (pkmn.HiddenAbility && pkmn.HiddenAbility.toLowerCase().includes(abilityQuery));

    return nameMatch && typeMatch && eggMatch && locMatch && lvlEggMatch && tmTutorMatch && abilityMatch;
  });

  // Sorting
  filtered.sort((a, b) => {
    const statsA = getStatArray(a.BaseStats);
    const statsB = getStatArray(b.BaseStats);
    const bstA = calculateBST(a.BaseStats);
    const bstB = calculateBST(b.BaseStats);

    switch (sortBy) {
      case 'id_asc': {
        const idA = parseFloat(a.id) || (parseInt(a.BaseDexNumber, 10) || 9999);
        const idB = parseFloat(b.id) || (parseInt(b.BaseDexNumber, 10) || 9999);
        return idA - idB;
      }
      case 'name_asc':
        return (a.Name || '').localeCompare(b.Name || '');
      case 'bst_desc':
        return bstB - bstA;
      case 'bst_asc':
        return bstA - bstB;
      case 'hp_desc':
        return statsB[0] - statsA[0];
      case 'atk_desc':
        return statsB[1] - statsA[1];
      case 'def_desc':
        return statsB[2] - statsA[2];
      case 'spa_desc':
        return statsB[4] - statsA[4];
      case 'spd_desc':
        return statsB[5] - statsA[5];
      case 'spe_desc':
        return statsB[3] - statsA[3];
      case 'spe_asc':
        return statsA[3] - statsB[3];
      default:
        return 0;
    }
  });

  renderTable(filtered);
}

// Event Listeners
function setupFilterListeners() {
  const searchBtn = document.getElementById('search-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (searchBtn) {
    searchBtn.addEventListener('click', applyFiltersAndSort);
  }

  // Trigger search on Enter inside text inputs
  const textInputs = document.querySelectorAll('.filter-container input[type="text"]');
  textInputs.forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyFiltersAndSort();
      }
    });
  });

  // Re-sort / Re-color instantly on change
  document.getElementById('sort-by').addEventListener('change', applyFiltersAndSort);
  document.getElementById('color-moves-toggle').addEventListener('change', applyFiltersAndSort);

  // Black Theme Handler
  const darkToggle = document.getElementById('dark-mode-toggle');
  if (darkToggle) {
    if (localStorage.getItem('theme_black') === 'true') {
      darkToggle.checked = true;
      document.body.classList.add('pure-black');
    }

    darkToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.body.classList.add('pure-black');
        localStorage.setItem('theme_black', 'true');
      } else {
        document.body.classList.remove('pure-black');
        localStorage.setItem('theme_black', 'false');
      }
    });
  }

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.getElementById('filter-name').value = '';
      document.getElementById('filter-type1').value = '';
      document.getElementById('filter-type2').value = '';
      document.getElementById('filter-location').value = '';
      document.getElementById('filter-egg').value = '';
      document.getElementById('filter-lvl-egg-move').value = '';
      document.getElementById('filter-tm-tutor-move').value = '';
      document.getElementById('filter-ability').value = '';
      document.getElementById('sort-by').value = 'id_asc';
      applyFiltersAndSort();
    });
  }
}

// Modal Handlers
function openMoveModal(moveId) {
  const move = movesMap[moveId] || { Name: moveId, Description: "No description found in moves.txt." };
  const flagTags = parseMoveFlags(move.Flags || '');

  let priorityVal = parseInt(move.Priority, 10);
  let priorityDisplay = '0';
  if (!isNaN(priorityVal)) {
    priorityDisplay = priorityVal > 0 ? `+${priorityVal}` : `${priorityVal}`;
  } else if (move.Priority) {
    priorityDisplay = move.Priority;
  }

  let flagBadgesHTML = '';
  if (flagTags.length > 0) {
    flagBadgesHTML = flagTags.map(tag => `<div class="flag-badge">• ${tag}</div>`).join('');
  } else {
    flagBadgesHTML = '<div style="color: #6b7280; font-size: 12px;">Standard Move (No special properties)</div>';
  }

  document.getElementById('modal-title').innerText = move.Name || moveId;
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-row"><strong>Type:</strong> <span class="badge type-${move.Type}">${move.Type || 'Unknown'}</span></div>
    <div class="modal-row"><strong>Category:</strong> ${move.Category || 'Unknown'}</div>
    <div class="modal-row"><strong>Base Power:</strong> ${move.BaseDamage || '-'}</div>
    <div class="modal-row"><strong>Accuracy:</strong> ${move.Accuracy ? move.Accuracy + '%' : '-'}</div>
    <div class="modal-row"><strong>PP:</strong> ${move.TotalPP || '-'}</div>
    <div class="modal-row"><strong>Priority:</strong> <span class="priority-tag">${priorityDisplay}</span></div>
    <div class="modal-row" style="margin-top: 10px;">
      <strong>Characteristics:</strong>
      <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
        ${flagBadgesHTML}
      </div>
    </div>
    <div class="modal-row" style="margin-top: 12px; color: #d1d5db; line-height: 1.5; border-top: 1px solid #333; padding-top: 10px;">
      ${move.Description || 'No description available.'}
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openAbilityModal(abilityId) {
  const ability = abilitiesMap[abilityId] || { Name: abilityId, Description: "No description found in abilities.txt." };
  document.getElementById('modal-title').innerText = ability.Name || abilityId;
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-row" style="color: #d1d5db; line-height: 1.5;">
      ${ability.Description || 'No description available.'}
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openMatchupModal(pkmnId) {
  const pkmn = pokemonList.find(p => String(p.id) === String(pkmnId));
  if (!pkmn) return;

  const matchups = calculateDefensiveMatchups(pkmn.Type1, pkmn.Type2);
  const categories = { '4x': [], '2x': [], '1x': [], '0.5x': [], '0.25x': [], '0x': [] };

  Object.entries(matchups).forEach(([type, mult]) => {
    if (mult === 4) categories['4x'].push(type);
    else if (mult === 2) categories['2x'].push(type);
    else if (mult === 1) categories['1x'].push(type);
    else if (mult === 0.5) categories['0.5x'].push(type);
    else if (mult === 0.25) categories['0.25x'].push(type);
    else if (mult === 0) categories['0x'].push(type);
  });

  const renderGroup = (label, types) => {
    if (!types || types.length === 0) return '';
    const badges = types.map(t => `<span class="badge type-${t}">${t}</span>`).join(' ');
    return `<div class="modal-row"><strong>${label}:</strong><div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:4px;">${badges}</div></div>`;
  };

  document.getElementById('modal-title').innerText = `${pkmn.Name || pkmn.InternalName} — Defensive Matchups`;
  document.getElementById('modal-content').innerHTML = `
    <div style="margin-bottom: 12px; color: #9ca3af; font-size: 13px;">
      Damage taken from attacking moves by type:
    </div>
    ${renderGroup('Takes 4x Damage', categories['4x'])}
    ${renderGroup('Takes 2x Damage', categories['2x'])}
    ${renderGroup('Takes 1x Damage', categories['1x'])}
    ${renderGroup('Takes 0.5x Damage', categories['0.5x'])}
    ${renderGroup('Takes 0.25x Damage', categories['0.25x'])}
    ${renderGroup('Immune (0x)', categories['0x'])}
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal(event) {
  if (!event || event.target.id === 'modal-overlay' || event.target.classList.contains('modal-close')) {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', init);