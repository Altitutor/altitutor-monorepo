import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../../supabase/generated';
import type { InterviewRound } from '../index';
import type { InterviewMediaSession, InterviewMediaStore } from './media-service';

function session(row:Tables<'interview_media_sessions'>):InterviewMediaSession {
  return {id:row.id,roundId:row.round_id,attemptId:row.attempt_id,key:row.phase_key,roomName:row.room_name,url:row.room_url,
    expiresAt:row.expires_at,closedAt:row.closed_at,recordingEnabled:row.recording_enabled,recordingRequestedAt:row.recording_requested_at,recordingError:row.recording_error,kind:row.kind==='audio'?'audio':'video',recordingActive:row.recording_active};
}

/** Only instantiate after authorising an actor through a scoped portal view. */
export function createInterviewMediaStore(client:SupabaseClient<Database>):InterviewMediaStore {
  return {
    async round(id) {
      const {data,error}=await client.rpc('interview_media_state',{p_round_id:id});
      if (error) throw error;
      if (!data || typeof data!=='object' || Array.isArray(data) || !('id' in data) || data.id!==id) throw new Error('Interview no longer exists.');
      return data as unknown as InterviewRound;
    },
    async sessions(roundId) {
      const {data,error}=await client.from('interview_media_sessions').select('*').eq('round_id',roundId);
      if (error) throw error;
      return (data??[]).map(session);
    },
    async ensureSession(value) {
      const {error}=await client.from('interview_media_sessions').upsert({id:value.id,round_id:value.roundId,attempt_id:value.attemptId,
        phase_key:value.key,room_name:value.roomName,expires_at:value.expiresAt,recording_enabled:value.recordingEnabled},
        {onConflict:'phase_key',ignoreDuplicates:true});
      if (error) throw error;
      const {data,error:readError}=await client.from('interview_media_sessions').select('*').eq('phase_key',value.key).single();
      if (readError) throw readError;
      return session(data);
    },
    async updateSession(id,patch) {
      const values:Database['public']['Tables']['interview_media_sessions']['Update']={};
      if ('url' in patch) values.room_url=patch.url;
      if ('closedAt' in patch) values.closed_at=patch.closedAt;
      if ('recordingRequestedAt' in patch) values.recording_requested_at=patch.recordingRequestedAt;
      if ('recordingError' in patch) values.recording_error=patch.recordingError;
      if ('recordingActive' in patch) values.recording_active=patch.recordingActive;
      const {error}=await client.from('interview_media_sessions').update(values).eq('id',id);
      if (error) throw error;
    },
    async claimRecordingRefresh(id) {
      const cutoff=new Date(Date.now()-10_000).toISOString();
      const {data,error}=await client.from('interview_media_sessions').update({recording_checked_at:new Date().toISOString()})
        .eq('id',id).or(`recording_checked_at.is.null,recording_checked_at.lt.${cutoff}`).select('id');
      if(error) throw error;
      return Boolean(data?.length);
    },
    async ensureRecording(value) {
      const {error}=await client.from('interview_recordings').upsert({id:value.id,round_id:value.roundId,attempt_id:value.attemptId,
        provider_id:`pending:${value.id}`,state:'pending',kind:'video'}, {onConflict:'id',ignoreDuplicates:true});
      if (error) throw error;
    },
    async failPendingRecording(id) {
      const {error}=await client.from('interview_recordings').update({state:'failed'}).eq('id',id).eq('state','pending');
      if(error) throw error;
    },
    async syncRecording(value,recording,first) {
      const {error}=await client.from('interview_recordings').upsert({id:first ? value.id : recording.id,round_id:value.roundId,attempt_id:value.attemptId,
        provider_id:recording.id,state:recording.state,kind:'video',created_at:recording.createdAt,
        expires_at:new Date(Date.parse(recording.createdAt)+90*86400_000).toISOString()}, {onConflict:'id'});
      if (error) throw error;
    },
  };
}
