import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/generated';
import type { InterviewRound, StudentInterviewRound } from '../index';
import { interviewMediaPolicy } from '../media';
import { DailyInterviewProvider } from './daily';
import { createInterviewMediaStore } from './media-store';
import { InterviewMediaService, canPlayInterviewRecording } from './media-service';

interface Actor {userId:string;userClient:SupabaseClient<Database>}
interface Dependencies {
  role:'tutor'|'student';
  resolveActor(request:Request):Promise<Actor|{response:Response}>;
  serviceClient():SupabaseClient<Database>;
  apiKey():string|undefined;
  errorResponse(error:unknown):Response;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body:unknown,status=200):Response {
  return Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0'}});
}

export function createInterviewMediaHandlers(deps:Dependencies) {
  async function authorised(request:Request,roundId:string) {
    if (!uuid.test(roundId)) return {response:json({error:'Invalid interview.'},400)};
    const actor=await deps.resolveActor(request);
    if ('response' in actor) return actor;
    const view=deps.role==='tutor' ? 'vtutor_interview_rounds' : 'vstudent_interview_rounds';
    const {data,error}=await actor.userClient.from(view).select('data').eq('id',roundId).maybeSingle();
    if (error) throw error;
    if (!data) return {response:json({error:'Interview is unavailable or your access has ended.'},404)};
    const round=data.data as unknown as InterviewRound|StudentInterviewRound;
    let actorId:string;
    if (deps.role==='tutor') {
      const {data:id,error:idError}=await actor.userClient.rpc('current_tutor_id');
      if (idError) throw idError;
      if (!id) return {response:json({error:'Tutor access required.'},403)};
      actorId=id;
    } else actorId=(round as StudentInterviewRound).studentId;
    return {actor,actorId,round};
  }

  return {
    async ticket(request:Request,roundId:string):Promise<Response> {
      try {
        const access=await authorised(request,roundId);
        if ('response' in access) return access.response;
        const client=deps.serviceClient();
        const store=createInterviewMediaStore(client);
        if (access.round.delivery==='in_person') {
          const round=await store.round(roundId);
          const policy=interviewMediaPolicy(round,access.actorId,deps.role);
          let captureId:string|undefined;
          if(deps.role==='tutor' && policy?.recordingEnabled && new URL(request.url).searchParams.get('capture')==='1') {
            const {data:capture,error:captureError}=await client.rpc('interview_audio_capture',{p_round_id:roundId,p_tutor_id:access.actorId});
            if(captureError) throw captureError;
            if(capture && typeof capture==='object' && !Array.isArray(capture) && typeof capture.id==='string') captureId=capture.id;
          }
          return json({actorId:access.actor.userId,sessionId:null,canSend:false,canReceive:false,attemptId:policy?.attemptId,
            captureId,expiresAt:policy?.expiresAt??undefined,
            recordingEnabled:deps.role==='tutor' && Boolean(policy?.recordingEnabled),serverNow:round.serverNow});
        }
        const key=deps.apiKey();
        if (!key) return json({sessionId:null,canSend:false,canReceive:false,recordingEnabled:false,warning:'Online interviews are not configured. Contact your administrator.',serverNow:access.round.serverNow});
        const service=new InterviewMediaService(store,new DailyInterviewProvider(key));
        const ticket=await service.ticket(roundId,{id:access.actorId,name:deps.role==='tutor' ? 'Tutor' : 'Student',role:deps.role},new URL(request.url).searchParams.get('sessionId')??undefined);
        return json(ticket);
      } catch(error) {return deps.errorResponse(error);}
    },
    async recording(request:Request,roundId:string,recordingId:string):Promise<Response> {
      try {
        if (!uuid.test(recordingId)) return json({error:'Invalid recording.'},400);
        const access=await authorised(request,roundId);
        if ('response' in access) return access.response;
        const visible=deps.role==='student' ? (access.round as StudentInterviewRound).result?.recordings : (access.round as InterviewRound).recordings;
        const allowed=visible?.find((recording)=>recording.id===recordingId);
        if (!allowed || !canPlayInterviewRecording(allowed)) return json({error:'Recording is not released, is still processing, or has expired.'},404);
        const client=deps.serviceClient();
        const {data,error}=await client.from('interview_recordings').select('*').eq('id',recordingId).eq('round_id',roundId).single();
        if (error) throw error;
        if (data.state!=='ready' || Date.parse(data.expires_at)<=Date.now()) return json({error:'Recording is unavailable.'},404);
        let url:string;
        if (data.storage_path) {
          const {data:link,error:linkError}=await client.storage.from('interview-recordings').createSignedUrl(data.storage_path,60);
          if (linkError) throw linkError;
          url=link.signedUrl;
        } else {
          const key=deps.apiKey();
          if (!key || !data.provider_id || data.provider_id.startsWith('pending:')) return json({error:'Recording is unavailable.'},503);
          url=await new DailyInterviewProvider(key).recordingLink(data.provider_id);
        }
        return json({url});
      } catch(error) {return deps.errorResponse(error);}
    },
    async uploadAudio(request:Request,roundId:string):Promise<Response> {
      try {
        if (deps.role!=='tutor') return json({error:'Tutor access required.'},403);
        const origin=request.headers.get('origin');
        if (origin && origin!==new URL(request.url).origin) return json({error:'Cross-origin upload rejected.'},403);
        const access=await authorised(request,roundId);
        if ('response' in access) return access.response;
        const round=access.round as InterviewRound;
        const params=new URL(request.url).searchParams;
        const captureId=params.get('captureId')??'';
        const segmentId=params.get('segmentId')??'';
        if (!uuid.test(captureId) || !uuid.test(segmentId)) return json({error:'Invalid recording segment.'},400);
        const client=deps.serviceClient();
        const {data:capture,error:captureError}=await client.from('interview_media_sessions').select('*').eq('id',captureId).eq('round_id',roundId).eq('tutor_id',access.actorId).eq('kind','audio').maybeSingle();
        if(captureError) throw captureError;
        const attempt=round.attempts.find((entry)=>entry.id===capture?.attempt_id);
        if (!round.recordingEnabled || round.delivery!=='in_person' || !attempt || !round.assignments.some((entry)=>entry.stationId===attempt.stationId && entry.tutorId===access.actorId)) return json({error:'Recording is not allowed for this attempt.'},403);
        const mime=(request.headers.get('content-type')??'').split(';')[0];
        const extension=({'audio/webm':'webm','audio/mp4':'mp4','audio/ogg':'ogg'} as Record<string,string>)[mime];
        if (!extension) return json({error:'Unsupported audio format.'},415);
        const maximum=5*1024*1024;
        if (Number(request.headers.get('content-length'))>maximum) return json({error:'Recording segment is too large.'},413);
        const reader=request.body?.getReader();
        if (!reader) return json({error:'Missing audio.'},400);
        const chunks:Uint8Array[]=[]; let length=0;
        try {
          while(true) {
            const part=await reader.read(); if(part.done) break;
            length+=part.value.byteLength;
            if(length>maximum) {await reader.cancel();return json({error:'Recording segment is too large.'},413);}
            chunks.push(part.value);
          }
        } finally {reader.releaseLock();}
        if (!length) return json({error:'Empty audio.'},400);
        const bytes=new Uint8Array(length); let offset=0;
        for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
        const path=`${roundId}/${captureId}/${segmentId}.${extension}`;
        const {error:uploadError}=await client.storage.from('interview-recordings').upload(path,bytes,{contentType:mime,upsert:false});
        if (uploadError && !('statusCode' in uploadError && String(uploadError.statusCode)==='409')) throw uploadError;
        const {error}=await client.rpc('interview_audio_segment',{p_round_id:roundId,p_tutor_id:access.actorId,p_capture_id:captureId,p_segment_id:segmentId,p_storage_path:path});
        if(error) throw error;
        return json({id:segmentId});
      } catch(error) {return deps.errorResponse(error);}
    },
  };
}
