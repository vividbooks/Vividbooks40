-- Vložit všechny chybějící předměty do curriculum_subjects
-- Bezpečné: ON CONFLICT DO NOTHING — nevadí opakované spuštění

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES
  ('cestina',         'Český jazyk',            'Český jazyk a literatura pro 2. stupeň ZŠ', 'book-open', '#3B82F6', 4, '{6,7,8,9}'),
  ('anglictina',      'Anglický jazyk',          'Anglický jazyk pro 2. stupeň ZŠ',           'languages', '#10B981', 3, '{6,7,8,9}'),
  ('nemcina',         'Německý jazyk',           'Německý jazyk pro 2. stupeň ZŠ',            'languages', '#F59E0B', 3, '{6,7,8,9}'),
  ('francouzstina',   'Francouzský jazyk',       'Francouzský jazyk pro 2. stupeň ZŠ',        'languages', '#EF4444', 3, '{6,7,8,9}'),
  ('matematika',      'Matematika',              'Matematika pro 2. stupeň ZŠ',               'calculator','#8B5CF6', 4, '{6,7,8,9}'),
  ('fyzika',          'Fyzika',                  'Fyzika pro 2. stupeň ZŠ',                   'atom',      '#06B6D4', 2, '{6,7,8,9}'),
  ('chemie',          'Chemie',                  'Chemie pro 2. stupeň ZŠ',                   'flask',     '#84CC16', 2, '{8,9}'),
  ('prirodopis',      'Přírodopis',              'Přírodopis pro 2. stupeň ZŠ',               'leaf',      '#22C55E', 2, '{6,7,8,9}'),
  ('zemepis',         'Zeměpis',                 'Zeměpis pro 2. stupeň ZŠ',                  'globe',     '#14B8A6', 2, '{6,7,8,9}'),
  ('cestina_1st',     'Český jazyk (1. st.)',    'Český jazyk pro 1. stupeň ZŠ',              'book-open', '#60A5FA', 5, '{1,2,3,4,5}'),
  ('matematika_1st',  'Matematika (1. st.)',     'Matematika pro 1. stupeň ZŠ',               'calculator','#A78BFA', 5, '{1,2,3,4,5}'),
  ('anglictina_1st',  'Anglický jazyk (1. st.)', 'Anglický jazyk pro 1. stupeň ZŠ',           'languages', '#34D399', 3, '{3,4,5}'),
  ('prvouka',         'Prvouka',                 'Prvouka pro 1. stupeň ZŠ',                  'sun',       '#FBBF24', 2, '{1,2,3}'),
  ('prirodoveda',     'Přírodověda',             'Přírodověda pro 1. stupeň ZŠ',              'leaf',      '#4ADE80', 2, '{4,5}'),
  ('vlastiveda',      'Vlastivěda',              'Vlastivěda pro 1. stupeň ZŠ',               'map',       '#FB923C', 2, '{4,5}'),
  ('hudebni_vychova', 'Hudební výchova',         'Hudební výchova pro ZŠ',                    'music',     '#F472B6', 1, '{1,2,3,4,5,6,7,8,9}'),
  ('vytvarna_vychova','Výtvarná výchova',        'Výtvarná výchova pro ZŠ',                   'palette',   '#FB7185', 2, '{1,2,3,4,5,6,7,8,9}'),
  ('telesna_vychova', 'Tělesná výchova',         'Tělesná výchova pro ZŠ',                    'dumbbell',  '#38BDF8', 2, '{1,2,3,4,5,6,7,8,9}'),
  ('pracovni_cinnosti','Pracovní činnosti',      'Pracovní činnosti pro ZŠ',                  'hammer',    '#A3A3A3', 1, '{1,2,3,4,5,6,7,8,9}')
ON CONFLICT (code) DO NOTHING;
