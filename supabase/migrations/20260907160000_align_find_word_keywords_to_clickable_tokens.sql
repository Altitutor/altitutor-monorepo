-- Align Find the word keywords with clickable passage tokens.
-- Hyphenated and accented compounds were previously scored as substrings
-- (e.g. keyword 1969 inside mid-1969), so the only clickable word was marked wrong.

UPDATE public.ucat_skill_trainer_items AS item
SET
  content = jsonb_set(item.content, '{keywords}', patch.keywords),
  updated_at = NOW()
FROM (
  VALUES
    ('d1000001-0000-4000-8000-100100000007'::uuid, '[{"id":"kw1","text":"December"},{"id":"kw2","text":"Philosophiæ"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000040'::uuid, '[{"id":"kw1","text":"Chimantá"},{"id":"kw2","text":"ginesi"},{"id":"kw3","text":"Spanish"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000000a5'::uuid, '[{"id":"kw2","text":"Provincial"},{"id":"kw3","text":"Assembly"},{"id":"kw4","text":"Constituency"},{"id":"kw5","text":"آباد-6"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000000ac'::uuid, '[{"id":"kw1","text":"Common"},{"id":"kw2","text":"March"},{"id":"kw3","text":"Indonesia"},{"id":"kw4","text":"Era"},{"id":"kw5","text":"COVID-19"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000000b8'::uuid, '[{"id":"kw1","text":"5-Geranyloxy-7-methoxycoumarin"},{"id":"kw2","text":"16α-LE2"},{"id":"kw3","text":"Sobetirome"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000000d2'::uuid, '[{"id":"kw1","text":"District"},{"id":"kw2","text":"Parliament"},{"id":"kw3","text":"Sangsad"},{"id":"kw4","text":"Faridpur"},{"id":"kw5","text":"Faridpur-17"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000000da'::uuid, '[{"id":"kw1","text":"Jojić"},{"id":"kw2","text":"Ilijin"},{"id":"kw3","text":"Lolić"},{"id":"kw4","text":"1978"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000111'::uuid, '[{"id":"kw1","text":"Center"},{"id":"kw2","text":"85-by-194-foot"},{"id":"kw3","text":"Hall"},{"id":"kw4","text":"5,500"},{"id":"kw5","text":"South"}]'::jsonb),
    ('d1000001-0000-4000-8000-10010000013c'::uuid, '[{"id":"kw1","text":"County"},{"id":"kw2","text":"1660-1700"},{"id":"kw3","text":"Goleniowy"},{"id":"kw4","text":"Silesian"},{"id":"kw5","text":"Golenowy"}]'::jsonb),
    ('d1000001-0000-4000-8000-10010000013e'::uuid, '[{"id":"kw1","text":"Anadolubank"},{"id":"kw2","text":"Başkanlığı"},{"id":"kw3","text":"loans"},{"id":"kw4","text":"2025"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000001fc'::uuid, '[{"id":"kw1","text":"Kyoto"},{"id":"kw2","text":"Ikeda"},{"id":"kw3","text":"Iaidō-only"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000215'::uuid, '[{"id":"kw1","text":"National"},{"id":"kw2","text":"35-45"},{"id":"kw3","text":"States"},{"id":"kw4","text":"United"},{"id":"kw5","text":"Bee"}]'::jsonb),
    ('d1000001-0000-4000-8000-10010000021e'::uuid, '[{"id":"kw1","text":"mid-1969"},{"id":"kw2","text":"Illusion"},{"id":"kw3","text":"three"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000238'::uuid, '[{"id":"kw1","text":"Mauritius"},{"id":"kw2","text":"cases"},{"id":"kw3","text":"Contact"},{"id":"kw4","text":"COVID-19"},{"id":"kw5","text":"Agaléga"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000261'::uuid, '[{"id":"kw1","text":"States"},{"id":"kw2","text":"Global"},{"id":"kw3","text":"United"},{"id":"kw4","text":"USA-581"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000283'::uuid, '[{"id":"kw1","text":"Yehuda"},{"id":"kw2","text":"Comprat"},{"id":"kw3","text":"Farissol"},{"id":"kw4","text":"15th-century"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000002bf'::uuid, '[{"id":"kw1","text":"1966"},{"id":"kw2","text":"Burkinabé"},{"id":"kw3","text":"Issaka"},{"id":"kw4","text":"Isaka"},{"id":"kw5","text":"Sawadogo"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000002e7'::uuid, '[{"id":"kw1","text":"21"},{"id":"kw2","text":"Reds"},{"id":"kw3","text":"140-game"},{"id":"kw4","text":"Macon"},{"id":"kw5","text":"South"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000301'::uuid, '[{"id":"kw1","text":"Rhineland-Palatinate"},{"id":"kw2","text":"ID-2998"},{"id":"kw3","text":"Navy"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000322'::uuid, '[{"id":"kw1","text":"Skagafjörður"},{"id":"kw2","text":"Deild"},{"id":"kw4","text":"Grafarós"},{"id":"kw5","text":"Höfðaströnd"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000327'::uuid, '[{"id":"kw1","text":"Province"},{"id":"kw2","text":"flows"},{"id":"kw3","text":"Paraná"},{"id":"kw4","text":"Spanish"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000342'::uuid, '[{"id":"kw1","text":"1826-1869"},{"id":"kw2","text":"1"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000346'::uuid, '[{"id":"kw1","text":"League"},{"id":"kw2","text":"1"},{"id":"kw3","text":"season"},{"id":"kw4","text":"COVID-19"},{"id":"kw5","text":"Collegiate"}]'::jsonb),
    ('d1000001-0000-4000-8000-100100000385'::uuid, '[{"id":"kw1","text":"16"},{"id":"kw2","text":"32"},{"id":"kw3","text":"2023"},{"id":"kw4","text":"Alizé"},{"id":"kw5","text":"fruit"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000003b0'::uuid, '[{"id":"kw1","text":"Telč"},{"id":"kw2","text":"2001"},{"id":"kw3","text":"2007"},{"id":"kw4","text":"South"},{"id":"kw5","text":"Czech"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000003c0'::uuid, '[{"id":"kw1","text":"May 12, 1970"},{"id":"kw3","text":"Tournament"},{"id":"kw4","text":"2005"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000003d3'::uuid, '[{"id":"kw1","text":"British"},{"id":"kw2","text":"December 22, 1874"},{"id":"kw3","text":"Étienne"},{"id":"kw4","text":"French-Canadian"},{"id":"kw5","text":"Canadien"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000003dc'::uuid, '[{"id":"kw1","text":"3-hydroxybenzoic"},{"id":"kw2","text":"Benzoyl-CoA"},{"id":"kw3","text":"4-ethylphenol"},{"id":"kw4","text":"coenzyme"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000003dd'::uuid, '[{"id":"kw1","text":"Andy"},{"id":"kw2","text":"MAC-145"},{"id":"kw3","text":"Alto"}]'::jsonb),
    ('d1000001-0000-4000-8000-1001000003e8'::uuid, '[{"id":"kw1","text":"2"},{"id":"kw2","text":"carbon-14"},{"id":"kw3","text":"glycolysis"}]'::jsonb)
) AS patch(id, keywords)
WHERE item.id = patch.id
  AND item.deleted_at IS NULL;
