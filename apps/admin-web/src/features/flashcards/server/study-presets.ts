import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/shared/lib/supabase/server-ssr';
import {supabaseAdmin} from '@/shared/lib/supabase/server/admin';

async function authorized(){const client=createClient();const {data}=await client.rpc('is_adminstaff_active');return Boolean(data);}
export async function GET(){if(!await authorized())return NextResponse.json({error:'Forbidden'},{status:403});if(!supabaseAdmin)return NextResponse.json({error:'Server not configured'},{status:500});
  const [presets,versions,assignments,subjects]=await Promise.all([
    supabaseAdmin.from('flashcard_study_presets').select('*').order('name'),
    supabaseAdmin.from('flashcard_study_preset_versions').select('*').order('version',{ascending:false}),
    supabaseAdmin.from('subject_flashcard_study_presets').select('*'),supabaseAdmin.from('subjects').select('id,name,short_name').is('deleted_at',null).order('name'),
  ]);const error=presets.error??versions.error??assignments.error??subjects.error;if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({data:{presets:presets.data,versions:versions.data,assignments:assignments.data,subjects:subjects.data}});
}
export async function POST(request:NextRequest){if(!await authorized())return NextResponse.json({error:'Forbidden'},{status:403});if(!supabaseAdmin)return NextResponse.json({error:'Server not configured'},{status:500});const body=await request.json() as Record<string,unknown>;
  if(body.action==='assign'&&typeof body.subjectId==='string'&&typeof body.presetId==='string'){const {error}=await supabaseAdmin.from('subject_flashcard_study_presets').upsert({subject_id:body.subjectId,preset_id:body.presetId});return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({data:true});}
  if(body.action==='archive'&&typeof body.presetId==='string'){const {error}=await supabaseAdmin.from('flashcard_study_presets').update({archived_at:new Date().toISOString()}).eq('id',body.presetId).eq('is_default',false);return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({data:true});}
  const config=body.config as {desiredRetention?:number;learningStepsMinutes?:number[];relearningStepsMinutes?:number[];minimumLapseIntervalDays?:number;learnAheadMinutes?:number;leechThreshold?:number;leechReminderInterval?:number;fsrsParameters?:number[]}|undefined;
  const validSteps=(steps:unknown)=>Array.isArray(steps)&&steps.every(step=>Number.isInteger(step)&&step>0);
  if(!config||typeof config.desiredRetention!=='number'||config.desiredRetention<.8||config.desiredRetention>.95||!validSteps(config.learningStepsMinutes??[])||!validSteps(config.relearningStepsMinutes??[])||!Array.isArray(config.fsrsParameters)||config.fsrsParameters.length!==21||!config.fsrsParameters.every(Number.isFinite))return NextResponse.json({error:'Invalid preset configuration'},{status:400});
  let presetId=typeof body.presetId==='string'?body.presetId:null;let version=1;
  if(body.action==='create'&&typeof body.name==='string'){const created=await supabaseAdmin.from('flashcard_study_presets').insert({name:body.name}).select('id').single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});presetId=created.data.id;}
  else if(body.action==='revise'&&presetId){const latest=await supabaseAdmin.from('flashcard_study_preset_versions').select('version').eq('preset_id',presetId).order('version',{ascending:false}).limit(1).single();if(latest.error)return NextResponse.json({error:latest.error.message},{status:500});version=latest.data.version+1;}else return NextResponse.json({error:'Invalid action'},{status:400});
  const {error}=await supabaseAdmin.from('flashcard_study_preset_versions').insert({preset_id:presetId!,version,desired_retention:config.desiredRetention,learning_steps_minutes:config.learningStepsMinutes??[1,10],relearning_steps_minutes:config.relearningStepsMinutes??[10],minimum_lapse_interval_days:config.minimumLapseIntervalDays??1,learn_ahead_minutes:config.learnAheadMinutes??20,leech_threshold:config.leechThreshold??8,leech_reminder_interval:config.leechReminderInterval??4,fsrs_parameters:config.fsrsParameters??[]});
  return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({data:{presetId,version}});
}
