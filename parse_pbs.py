import json
import os
import re

def read_file_safely(filepath):
    """Reads files encoded in UTF-16, UTF-8, or legacy Windows encodings."""
    if not os.path.exists(filepath):
        return []
    encodings = ['utf-16', 'utf-16-le', 'utf-8-sig', 'utf-8', 'windows-1252', 'latin-1']
    for enc in encodings:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                lines = f.readlines()
                if any('[' in line or '=' in line or ',' in line for line in lines[:50]):
                    return lines
        except (UnicodeDecodeError, UnicodeError):
            continue
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        return f.readlines()

def parse_pokemon_file(filepath):
    data = {}
    current_pkmn = None

    lines = read_file_safely(filepath)
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        header_match = re.match(r'^\[\s*(.+?)\s*\]$', line)
        if header_match:
            current_id = header_match.group(1).strip()
            current_pkmn = {
                'id': current_id,
                'InternalName': current_id,
                'TMMoves': [],
                'TutorMoves': []
            }
            data[current_id] = current_pkmn
            continue

        if '=' in line and current_pkmn is not None:
            key, val = line.split('=', 1)
            current_pkmn[key.strip()] = val.strip()

    return data

def parse_tm_file(filepath):
    tm_map = {}
    current_move = None

    lines = read_file_safely(filepath)
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        header_match = re.match(r'^\[\s*(.+?)\s*\]$', line)
        if header_match:
            current_move = header_match.group(1).strip()
            if current_move not in tm_map:
                tm_map[current_move] = []
            continue

        if current_move:
            pkmn_names = [p.strip().upper() for p in line.split(',') if p.strip()]
            tm_map[current_move].extend(pkmn_names)

    return tm_map

def apply_tms_and_tutors(pokemon_dict):
    """Applies TMs and Tutor moves to all matching base Pokémon and forms."""
    name_lookup = {}
    for key, pkmn in pokemon_dict.items():
        identifiers = [
            pkmn.get('InternalName', '').strip().upper(),
            pkmn.get('Name', '').split(' (')[0].strip().upper(),
            str(pkmn.get('id', '')).strip().upper()
        ]
        for ident in identifiers:
            if ident:
                if ident not in name_lookup:
                    name_lookup[ident] = []
                if key not in name_lookup[ident]:
                    name_lookup[ident].append(key)

    for filepath, field_name in [('PBS/tm.txt', 'TMMoves'), ('PBS/tutors.txt', 'TutorMoves')]:
        if os.path.exists(filepath):
            moves_map = parse_tm_file(filepath)
            print(f"Loaded {len(moves_map)} moves from {filepath}")
            for move_name, compatible_pkmn in moves_map.items():
                for p_name in compatible_pkmn:
                    if p_name in name_lookup:
                        for pkmn_key in name_lookup[p_name]:
                            if move_name not in pokemon_dict[pkmn_key][field_name]:
                                pokemon_dict[pkmn_key][field_name].append(move_name)

def parse_pokemon_forms(forms_filepath, base_pokemon_data):
    if not os.path.exists(forms_filepath):
        print(f"Notice: {forms_filepath} not found, skipping forms.")
        return base_pokemon_data

    lines = read_file_safely(forms_filepath)
    current_form = None
    forms_count = 0

    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        # Matches [CASTFORM-5], [AGGRON-1], [DEOXYS-1], [VULPIX,1], etc.
        header_match = re.match(r'^\[\s*([a-zA-Z0-9_]+)\s*[\-,]\s*(\d+)\s*\]$', line)
        if header_match:
            species_key = header_match.group(1).strip().upper()
            form_num = header_match.group(2).strip()

            base_pkmn = None
            for p in base_pokemon_data.values():
                if p.get('InternalName', '').strip().upper() == species_key or str(p.get('id', '')).strip().upper() == species_key:
                    base_pkmn = p
                    break

            form_id = f"{species_key}_{form_num}"
            if base_pkmn:
                current_form = dict(base_pkmn)
                current_form['id'] = f"{base_pkmn.get('id', species_key)}.{form_num}"
                current_form['BaseDexNumber'] = base_pkmn.get('id', '0')
                current_form['BaseSpecies'] = species_key
                current_form['FormNumber'] = form_num
                current_form['TMMoves'] = list(base_pkmn.get('TMMoves', []))
                current_form['TutorMoves'] = list(base_pkmn.get('TutorMoves', []))
            else:
                current_form = {
                    'id': form_id,
                    'BaseDexNumber': '9999',
                    'InternalName': species_key, 
                    'FormNumber': form_num,
                    'TMMoves': [],
                    'TutorMoves': []
                }

            base_pokemon_data[form_id] = current_form
            forms_count += 1
            continue

        if '=' in line and current_form is not None:
            key, val = line.split('=', 1)
            key = key.strip()
            val = val.strip()

            if key == 'FormName':
                base_name = current_form.get('Name', current_form.get('InternalName', ''))
                base_clean = base_name.split(' (')[0].strip()
                if val.lower().startswith("mega ") or base_clean.lower() in val.lower():
                    current_form['Name'] = val
                else:
                    current_form['Name'] = f"{base_clean} ({val})"

            elif key == 'Type1':
                current_form['Type1'] = val

            elif key == 'Type2':
                if val:
                    current_form['Type2'] = val
                else:
                    # Explicitly remove Type2 if left blank in pokemonforms.txt (e.g. pure steel Mega Aggron)
                    current_form.pop('Type2', None)

            elif key == 'Abilities':
                current_form['Abilities'] = val
                current_form.pop('HiddenAbility', None)

            elif key == 'HiddenAbility':
                current_form['HiddenAbility'] = val

            else:
                current_form[key] = val

    print(f"Loaded {forms_count} alternate forms from {forms_filepath}")
    return base_pokemon_data

def parse_csv_file(filepath, schema_fields):
    data = {}
    if not os.path.exists(filepath):
        return data

    num_fields = len(schema_fields)
    lines = read_file_safely(filepath)

    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        parts = [p.strip() for p in line.split(',', num_fields - 1)]
        if len(parts) < 2:
            continue

        internal_id = parts[1]
        entry = {}
        for index, field_name in enumerate(schema_fields):
            entry[field_name] = parts[index] if index < len(parts) else ""

        if 'Description' in entry:
            entry['Description'] = entry['Description'].strip('"\'')

        data[internal_id] = entry

    return data

def run():
    print("--- Running PBS Parser ---")
    
    # 1. Base Pokemon
    pokemon = parse_pokemon_file('PBS/pokemon.txt')

    # 2. Attach TMs & Tutors to base Pokemon first
    apply_tms_and_tutors(pokemon)

    # 3. Alternate forms inherit all data (including TMs)
    pokemon = parse_pokemon_forms('PBS/pokemonforms.txt', pokemon)

    print(f"Total Pokemon entries: {len(pokemon)}")

    # 4. Moves & Abilities
    move_schema = [
        'ID', 'InternalName', 'Name', 'FunctionCode', 'BaseDamage', 
        'Type', 'Category', 'Accuracy', 'TotalPP', 'EffectChance', 
        'Target', 'Priority', 'Flags', 'Description'
    ]
    moves = parse_csv_file('PBS/moves.txt', move_schema)
    print(f"Parsed Moves count: {len(moves)}")

    ability_schema = ['ID', 'InternalName', 'Name', 'Description']
    abilities = parse_csv_file('PBS/abilities.txt', ability_schema)
    print(f"Parsed Abilities count: {len(abilities)}")

    # 5. Export JSON
    with open('pokemon.json', 'w', encoding='utf-8') as f:
        json.dump(pokemon, f, indent=2, ensure_ascii=False)

    with open('moves.json', 'w', encoding='utf-8') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    with open('abilities.json', 'w', encoding='utf-8') as f:
        json.dump(abilities, f, indent=2, ensure_ascii=False)

    print("--- JSON files updated successfully! ---")

if __name__ == '__main__':
    run()