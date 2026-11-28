-- Existing and older-client authored records stay publishable. New catalogue
-- editors submit draft explicitly and publish only when content is ready.
ALTER TABLE public.interview_stations
  ADD COLUMN publication_status text NOT NULL DEFAULT 'published'
  CHECK (publication_status IN ('draft', 'published'));

ALTER TABLE public.interviews
  ADD CONSTRAINT interview_publication_status_valid
  CHECK (NOT (data ? 'publicationStatus') OR
    coalesce(data->>'publicationStatus' IN ('draft', 'published'), false));

DO $migration$
DECLARE definition text; previous text;
BEGIN
  SELECT pg_get_functiondef('public.interview_station_json(public.interview_stations)'::regprocedure) INTO definition;
  previous := $old$'maximumPoints',s.maximum_points,'archived',s.archived$old$;
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized station projection'; END IF;
  EXECUTE replace(definition,previous,$new$'maximumPoints',s.maximum_points,'publicationStatus',s.publication_status,'archived',s.archived$new$);

  SELECT pg_get_functiondef('public.interview_command(uuid,jsonb)'::regprocedure) INTO definition;
  previous := $old$INSERT INTO public.interview_stations(id,version,name,category_id,prompt,maximum_points,archived)
    VALUES(entity_id,ver,item->>'name',(item->>'categoryId')::uuid,item->'prompt',(item->>'maximumPoints')::numeric,coalesce((item->>'archived')::boolean,false))$old$;
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized station write'; END IF;
  definition:=replace(definition,previous,$new$INSERT INTO public.interview_stations(id,version,name,category_id,prompt,maximum_points,archived,publication_status)
    VALUES(entity_id,ver,item->>'name',(item->>'categoryId')::uuid,item->'prompt',(item->>'maximumPoints')::numeric,
      coalesce((item->>'archived')::boolean,false),coalesce(item->>'publicationStatus',bank.publication_status,'published'))$new$);
  previous := $old$maximum_points=excluded.maximum_points,archived=excluded.archived,updated_at=now();$old$;
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized station update'; END IF;
  definition:=replace(definition,previous,$new$maximum_points=excluded.maximum_points,archived=excluded.archived,
     publication_status=excluded.publication_status,updated_at=now();$new$);
  previous := $old$PERFORM public.interview_validate_template(item); ver:=coalesce(t.version,0)+1;$old$;
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized template write'; END IF;
  definition:=replace(definition,previous,$new$PERFORM public.interview_validate_template(item);
  item:=item || jsonb_build_object('publicationStatus',coalesce(item->>'publicationStatus',t.data->>'publicationStatus','published'));
  IF item->>'publicationStatus'='published'
     AND (t.id IS NULL OR coalesce(t.data->>'publicationStatus','published')='draft'
       OR item->'stations' IS DISTINCT FROM t.data->'stations') AND (
    jsonb_array_length(item->'stations')=0 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(item->'stations') placement
      JOIN public.interview_stations station ON station.id=(placement->>'stationId')::uuid
      WHERE station.publication_status<>'published' OR (station.archived AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(t.data->'stations','[]')) existing
        WHERE existing->>'stationId'=station.id::text
      ))
    )
  ) THEN RAISE EXCEPTION 'Publish every station before publishing the interview' USING ERRCODE='22023'; END IF;
  ver:=coalesce(t.version,0)+1;$new$);
  EXECUTE definition;

  SELECT pg_get_functiondef('public.interview_setup_data(jsonb,uuid,timestamptz)'::regprocedure) INTO definition;
  previous := $old$PERFORM public.interview_validate_template(template);$old$;
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized round setup'; END IF;
  EXECUTE replace(definition,previous,$new$PERFORM public.interview_validate_template(template);
 IF coalesce(template->>'publicationStatus','published')<>'published' OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(template->'stations') placement
   JOIN public.interview_stations station ON station.id=(placement->>'stationId')::uuid
   WHERE station.publication_status<>'published'
 ) THEN RAISE EXCEPTION 'Publish the interview and its stations before using it in a round' USING ERRCODE='22023'; END IF;$new$);
END;
$migration$;
