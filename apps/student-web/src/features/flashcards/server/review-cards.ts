import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { buildRatingPreviews, getRetrievability, type FlashcardStudyPresetConfig, type ReviewStateRow } from '@/features/flashcards/server/fsrs';
import { DEFAULT_FLASHCARD_STUDY_PRESET_ID, type FlashcardReviewCard } from '@altitutor/shared';
import { buildStudySnapshot, summarizeFlashcardSubjects } from '@/features/flashcards/server/study-snapshot';
import { createHash } from 'node:crypto';

type TopicMetadata = {
  id: string;
  subject_id: string | null;
  code: string | null;
  name: string | null;
};

type NoteFileRow = {
  id: string | null;
  topic_id: string | null;
  code: string | null;
  filename: string | null;
  index: number | null;
  is_solutions: boolean | null;
};

function stripLastExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  const topicIds = request.nextUrl.searchParams
    .get('topicIds')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const mode = request.nextUrl.searchParams.get('mode') === 'all' ? 'all' : 'due';

  const userClient = createClient();
  const { data: authData, error: authError } = await userClient.auth.getClaims();
  if (authError || !authData?.claims?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: studentId, error: studentError } = await userClient.rpc('current_student_id');
  if (studentError || !studentId) return NextResponse.json({ error: 'student_not_found' }, { status: 403 });

  let query = userClient
    .from('vstudent_flashcard_review_cards')
    .select('*')
    .order('flashcard_index', { ascending: true })
    .order('cloze_index', { ascending: true });

  if (topicId) {
    query = query.eq('topic_id', topicId);
  } else if (topicIds?.length) {
    query = query.in('topic_id', topicIds);
  }

  const { data, error } = await query;
  if (error) return captureApiErrorResponse(error, "/api/flashcards/review-cards", NextResponse.json({ error: error.message }, { status: 500 }));
  const now = new Date();
  const rawRows = (data ?? []) as unknown as FlashcardReviewCard[];
  const adminClient = getServerSupabaseAdmin();
  const { data: preferences, error: preferencesError } = await adminClient.from('student_flashcard_preferences')
    .select('new_cards_per_study_day, review_cards_per_study_day, timezone, timezone_confirmed_at, pending_timezone, pending_timezone_effective_at').eq('student_id', studentId).maybeSingle();
  if (preferencesError) return captureApiErrorResponse(preferencesError, '/api/flashcards/review-cards', NextResponse.json({ error: preferencesError.message }, { status: 500 }));
  const pendingEffective = preferences?.pending_timezone && preferences.pending_timezone_effective_at && new Date(preferences.pending_timezone_effective_at) <= now;
  const timezone = pendingEffective ? preferences.pending_timezone! : preferences?.timezone ?? 'Australia/Adelaide';
  if (pendingEffective) {
    const { error: updateError } = await adminClient.from('student_flashcard_preferences').update({ timezone, pending_timezone: null, pending_timezone_effective_at: null, timezone_confirmed_at: now.toISOString() }).eq('student_id',studentId);
    if (updateError) return captureApiErrorResponse(updateError, '/api/flashcards/review-cards', NextResponse.json({ error: updateError.message }, { status: 500 }));
  }
  const { data: bounds, error: boundsError } = await adminClient.rpc('flashcard_study_day_bounds', { p_now: now.toISOString(), p_timezone: timezone });
  if (boundsError || !bounds?.[0]) return captureApiErrorResponse(boundsError ?? new Error('study_day_bounds_missing'), '/api/flashcards/review-cards', NextResponse.json({ error: 'Unable to resolve study day' }, { status: 500 }));

  const topicIdsForPresets=[...new Set(rawRows.map(row=>row.topic_id))];
  const topicResult=topicIdsForPresets.length?await adminClient.from('topics').select('id,subject_id,code,name').in('id',topicIdsForPresets):{data:[],error:null};
  if(topicResult.error)return captureApiErrorResponse(topicResult.error,'/api/flashcards/review-cards',NextResponse.json({error:topicResult.error.message},{status:500}));
  const topicRows=(topicResult.data??[]) as TopicMetadata[];
  const subjectIds=[...new Set((topicRows??[]).map(topic=>topic.subject_id).filter((id):id is string=>Boolean(id)))];
  const [assignmentResult, subjectResult, noteFilesResult] = await Promise.all([
    subjectIds.length?adminClient.from('subject_flashcard_study_presets').select('subject_id,preset_id').in('subject_id',subjectIds):Promise.resolve({data:[],error:null}),
    subjectIds.length?adminClient.from('subjects').select('id,short_name,name,long_name').in('id',subjectIds):Promise.resolve({data:[],error:null}),
    topicIdsForPresets.length?userClient.from('vstudent_topics_files').select('id,topic_id,code,filename,index,is_solutions').in('topic_id',topicIdsForPresets).eq('type','NOTES').order('index',{ascending:true}):Promise.resolve({data:[],error:null}),
  ]);
  const metadataError=assignmentResult.error??subjectResult.error??noteFilesResult.error;
  if(metadataError)return captureApiErrorResponse(metadataError,'/api/flashcards/review-cards',NextResponse.json({error:metadataError.message},{status:500}));
  const assignments=assignmentResult.data??[];
  const subjectRows=subjectResult.data??[];
  const noteFileRows=(noteFilesResult.data??[]) as NoteFileRow[];
  const presetIds=[...new Set([DEFAULT_FLASHCARD_STUDY_PRESET_ID,...(assignments??[]).map(item=>item.preset_id)])];
  const [presetVersionResult,personalPresetResult]=await Promise.all([
    adminClient.from('flashcard_study_preset_versions').select('preset_id,version,desired_retention,learning_steps_minutes,relearning_steps_minutes,minimum_lapse_interval_days,learn_ahead_minutes,fsrs_parameters').in('preset_id',presetIds).order('version',{ascending:false}),
    adminClient.from('student_flashcard_preset_preferences').select('preset_id,desired_retention,optimized_fsrs_parameters').eq('student_id',studentId).in('preset_id',presetIds),
  ]);
  const presetResolutionError=presetVersionResult.error??personalPresetResult.error;
  if(presetResolutionError)return captureApiErrorResponse(presetResolutionError,'/api/flashcards/review-cards',NextResponse.json({error:presetResolutionError.message},{status:500}));
  const presetVersions=presetVersionResult.data??[];
  const personalPresets=personalPresetResult.data??[];
  const latestVersions=new Map<string,NonNullable<typeof presetVersions>[number]>();for(const version of presetVersions??[]){if(!latestVersions.has(version.preset_id))latestVersions.set(version.preset_id,version);}
  const missingPresetId=presetIds.find(presetId=>!latestVersions.has(presetId));
  if(missingPresetId)return captureApiErrorResponse(new Error(`flashcard_preset_version_missing:${missingPresetId}`),'/api/flashcards/review-cards',NextResponse.json({error:'Unable to resolve flashcard preset'},{status:500}));
  const subjectPreset=new Map((assignments??[]).map(item=>[item.subject_id,item.preset_id]));
  const topicPreset=new Map((topicRows??[]).map(topic=>[topic.id,subjectPreset.get(topic.subject_id??'')??DEFAULT_FLASHCARD_STUDY_PRESET_ID]));
  const topicById=new Map(topicRows.map(topic=>[topic.id,topic]));
  const subjectById=new Map(subjectRows.map(subject=>[subject.id,subject]));
  const noteFilesByTopic=new Map<string,NoteFileRow[]>();
  for(const noteFile of noteFileRows){
    if(!noteFile.topic_id)continue;
    const current=noteFilesByTopic.get(noteFile.topic_id)??[];
    current.push(noteFile);
    noteFilesByTopic.set(noteFile.topic_id,current);
  }
  const personalPreset=new Map((personalPresets??[]).map(item=>[item.preset_id,item]));
  const imageUrls = new Map<string, string>();
  await Promise.all([...new Set(rawRows.map((row) => row.image_storage_path).filter((path): path is string => Boolean(path)))].map(async (path) => {
    const { data: signed } = await adminClient.storage.from('flashcard-images').createSignedUrl(path, 3600);
    if (signed?.signedUrl) imageUrls.set(path, signed.signedUrl);
  }));
  const rows = rawRows.map((row) => {
    const presetId=topicPreset.get(row.topic_id)??DEFAULT_FLASHCARD_STUDY_PRESET_ID;const version=latestVersions.get(presetId)!;const personal=personalPreset.get(presetId);
    const topic=topicById.get(row.topic_id);const subject=topic?.subject_id?subjectById.get(topic.subject_id):null;
    const subjectSlug=subject?.short_name??subject?.name??null;
    const noteLinks=subjectSlug&&topic?.code?(noteFilesByTopic.get(row.topic_id)??[]).toSorted((a,b)=>Number(a.is_solutions)-Number(b.is_solutions)||(a.index??0)-(b.index??0)).flatMap(noteFile=>{
      if(!noteFile.id||!noteFile.code||!noteFile.filename)return [];
      return [{
        id:noteFile.id,
        label:`${noteFile.code} · ${stripLastExtension(noteFile.filename)}`,
        href:`/resources/${encodeURIComponent(subjectSlug)}/${encodeURIComponent(topic.code!)}/${encodeURIComponent(noteFile.code.toLowerCase())}`,
        is_solution:Boolean(noteFile.is_solutions),
      }];
    }):[];
    const preset:FlashcardStudyPresetConfig={desiredRetention:Number(personal?.desired_retention??version.desired_retention),learningStepsMinutes:version.learning_steps_minutes,relearningStepsMinutes:version.relearning_steps_minutes,minimumLapseIntervalDays:version.minimum_lapse_interval_days,fsrsParameters:(personal?.optimized_fsrs_parameters as number[]|null)??(version.fsrs_parameters as number[])};
    const previewSeed = createHash('sha256').update(`${row.id}:${row.revision}:${row.due_at}`).digest('hex');
    return ({
    ...row,
    image_url: row.image_storage_path ? imageUrls.get(row.image_storage_path) ?? null : null,
    rating_preview_seed: previewSeed,
    topic_code: topic?.code ?? null,
    topic_name: topic?.name ?? null,
    subject_short_name: subjectSlug,
    note_links: noteLinks,
    learn_ahead_minutes: version?.learn_ahead_minutes ?? 20,
    retrievability: row.state === 'Review'
      ? getRetrievability(row as ReviewStateRow, now, preset)
      : undefined,
    rating_previews: buildRatingPreviews(
      row as ReviewStateRow,
      now,
      preset,
      previewSeed,
      new Date(bounds[0].ends_at),
    ),
  }); });
  if (mode === 'all') return NextResponse.json({ data: rows }, { headers: { 'Cache-Control': 'private, no-store' } });

  const { data: logs, error: logsError } = await adminClient.from('student_flashcard_review_logs').select('pre_state')
    .eq('student_id', studentId).eq('action', 'answer').is('undone_at', null)
    .gte('answered_at', bounds[0].starts_at).lt('answered_at', bounds[0].ends_at);
  if (logsError) return captureApiErrorResponse(logsError, '/api/flashcards/review-cards', NextResponse.json({ error: logsError.message }, { status: 500 }));
  const usage = (logs ?? []).reduce((result, log) => {
    const state = (log.pre_state as { state?: string }).state;
    if (state === 'New') result.newStudied += 1;
    if (state === 'Review') result.reviewsStudied += 1;
    return result;
  }, { newStudied: 0, reviewsStudied: 0 });
  const studyPolicy = {
    newLimit: preferences?.new_cards_per_study_day ?? 20,
    reviewLimit: preferences?.review_cards_per_study_day ?? 200,
    learnAheadMinutes: 20,
    studyDaySeed: bounds[0].study_day ?? undefined,
  };
  const snapshot = buildStudySnapshot(rows, usage, studyPolicy, now);
  const subjectGroups = new Map<string, { id: string; name: string; shortName: string | null; topicIds: Set<string>; cards: typeof rows }>();
  for (const row of rows) {
    const topic = topicById.get(row.topic_id);
    const subjectId = topic?.subject_id;
    if (!subjectId) continue;
    const subject = subjectById.get(subjectId);
    const group = subjectGroups.get(subjectId) ?? {
      id: subjectId,
      name: subject?.long_name || subject?.name || subject?.short_name || 'Subject',
      shortName: subject?.short_name ?? null,
      topicIds: new Set<string>(),
      cards: [],
    };
    group.topicIds.add(row.topic_id);
    group.cards.push(row);
    subjectGroups.set(subjectId, group);
  }
  const subjects = summarizeFlashcardSubjects(
    [...subjectGroups.values()].map((group) => ({ ...group, topicIds: [...group.topicIds] })),
    usage,
    studyPolicy,
    now,
  );
  return NextResponse.json(
    { data: { ...snapshot, timezone, timezoneConfirmationRequired: !preferences?.timezone_confirmed_at, catalogTotal: rows.length, subjects } },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
