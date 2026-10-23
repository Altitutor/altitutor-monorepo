import type { InterviewRound, InterviewRecording } from '../index';
import { interviewMediaPolicy, type InterviewMediaPolicy, type InterviewMediaTicket } from '../media';
import { DailyInterviewProvider } from './daily';

export interface InterviewMediaSession {
  id:string; roundId:string; attemptId:string; key:string; roomName:string; url:string|null;
  expiresAt:string; closedAt:string|null; recordingEnabled:boolean; recordingRequestedAt:string|null; recordingError:string|null;
  kind:'audio'|'video'; recordingActive:boolean;
}
export interface InterviewMediaStore {
  round(id:string):Promise<InterviewRound>;
  sessions(roundId:string):Promise<InterviewMediaSession[]>;
  ensureSession(session:InterviewMediaSession):Promise<InterviewMediaSession>;
  updateSession(id:string,patch:Partial<Pick<InterviewMediaSession,'url'|'closedAt'|'recordingRequestedAt'|'recordingError'|'recordingActive'>>):Promise<void>;
  claimRecordingRefresh(id:string):Promise<boolean>;
  ensureRecording(session:InterviewMediaSession):Promise<void>;
  failPendingRecording(id:string):Promise<void>;
  syncRecording(session:InterviewMediaSession,recording:{id:string;state:'recording'|'ready'|'failed';createdAt:string},first:boolean):Promise<void>;
}

export class InterviewMediaService {
  constructor(private readonly store:InterviewMediaStore,private readonly provider:DailyInterviewProvider,private readonly now:()=>number=Date.now) {}

  async reconcile(roundId:string,refreshRecordings=true):Promise<void> {
    const round=await this.store.round(roundId);
    const keys=new Set(round.progress.map((station)=>interviewMediaPolicy(round,station.tutorId,'tutor')?.key).filter(Boolean));
    const sessions=await this.store.sessions(roundId);
    await Promise.all(sessions.map(async(session)=>{
      if(session.kind==='audio') return;
      if (!session.closedAt && (!keys.has(session.key) || Date.parse(session.expiresAt)<=this.now())) {
        await this.provider.closeRoom(session.roomName);
        await this.store.updateSession(session.id,{closedAt:new Date(this.now()).toISOString()});
      }
      const settled=session.closedAt && round.recordings.some((recording)=>recording.id===session.id && ['ready','failed','expired'].includes(recording.state));
      if (refreshRecordings && session.recordingEnabled && !settled) await this.refreshRecordings(session);
    }));
  }

  private async refreshRecordings(session:InterviewMediaSession):Promise<boolean> {
    if(!await this.store.claimRecordingRefresh(session.id)) return session.recordingActive;
    try {
      const recordings=(await this.provider.recordings(session.roomName)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
      for (const [index,recording] of recordings.entries()) await this.store.syncRecording(session,recording,index===0);
      if(!recordings.length && session.closedAt && this.now()-Date.parse(session.closedAt)>5*60_000) await this.store.failPendingRecording(session.id);
      const recordingActive=recordings.some((recording)=>recording.state==='recording');
      await this.store.updateSession(session.id,{recordingError:null,recordingActive});
      return recordingActive;
    } catch {
      await this.store.updateSession(session.id,{recordingActive:false,recordingError:'Recording status is unavailable. The interview can continue.'});
      return false;
    }
  }

  async ticket(roundId:string,actor:{id:string;name:string;role:'tutor'|'student'},knownSessionId?:string):Promise<InterviewMediaTicket> {
    await this.reconcile(roundId,false);
    const round=await this.store.round(roundId);
    const policy=interviewMediaPolicy(round,actor.id,actor.role);
    const empty:InterviewMediaTicket={sessionId:null,canSend:false,canReceive:false,recordingEnabled:false,serverNow:round.serverNow};
    if (!policy) return empty;
    if (round.delivery==='in_person') return {...empty,attemptId:policy.attemptId,recordingEnabled:actor.role==='tutor' && policy.recordingEnabled};
    const expiresAt=policy.expiresAt ?? new Date(Date.parse(round.phaseStartedAt)+4*60*60*1000).toISOString();
    if (Date.parse(expiresAt)<=this.now()) return empty;
    let session=await this.ensureSession(roundId,policy,expiresAt);
    if (session.closedAt) return {...empty,warning:'This video connection has ended. Refresh the interview state.'};
    if (!session.url) {
      const url=await this.provider.ensureRoom(session.roomName,Math.floor(Date.parse(expiresAt)/1000),policy.recordingEnabled);
      await this.store.updateSession(session.id,{url});
      session={...session,url};
    }
    let recordingActive=false;
    if (policy.recordingEnabled) {
      await this.store.ensureRecording(session);
      recordingActive=await this.refreshRecordings(session);
      // REST acceptance is only a request. Actual status comes from provider
      // recordings; failures remain visible and retries reuse the instance ID.
      if (!session.recordingRequestedAt) {
        // The scoped token starts recording on join. Avoid six pre-join REST
        // starts: Daily permits four recording-start requests per five seconds.
        await this.store.updateSession(session.id,{recordingRequestedAt:new Date(this.now()).toISOString()});
      } else if (!recordingActive && knownSessionId===session.id && this.now()-Date.parse(session.recordingRequestedAt)>15_000) {
        try {
          await this.provider.startRecording(session.roomName,session.id,(Date.parse(expiresAt)-this.now())/1000);
          await this.store.updateSession(session.id,{recordingRequestedAt:new Date(this.now()).toISOString()});
        } catch {
          await this.store.updateSession(session.id,{recordingRequestedAt:new Date(this.now()).toISOString(),recordingError:'Recording has not started. The interview can continue; recording will retry.'});
        }
      }
    }
    // Re-read before issuing a capability: a pause/end/rotation during provider
    // provisioning must not grant access to the stale phase.
    const current=await this.store.round(roundId);
    if (interviewMediaPolicy(current,actor.id,actor.role)?.key!==policy.key) {
      await this.reconcile(roundId);
      return {...empty,serverNow:current.serverNow};
    }
    const token=knownSessionId===session.id ? undefined : await this.provider.token(session.roomName,actor.id,actor.name,Math.floor(Date.parse(expiresAt)/1000),policy,policy.recordingEnabled ? session.id : undefined);
    return {sessionId:session.id,url:session.url??undefined,token,expiresAt,canSend:policy.canSend,canReceive:policy.canReceive,
      recordingEnabled:policy.recordingEnabled,recordingActive,attemptId:policy.attemptId,serverNow:current.serverNow,
      warning:policy.recordingEnabled && !recordingActive ? 'Recording is starting or unavailable. You can continue the interview.' : undefined};
  }

  private async ensureSession(roundId:string,policy:InterviewMediaPolicy,expiresAt:string):Promise<InterviewMediaSession> {
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${roundId}:${policy.key}`)))).map((byte)=>byte.toString(16).padStart(2,'0')).join('');
    return this.store.ensureSession({id:crypto.randomUUID(),roundId,attemptId:policy.attemptId,key:policy.key,
      roomName:`mmi-${hash.slice(0,48)}`,url:null,expiresAt,closedAt:null,recordingEnabled:policy.recordingEnabled,recordingRequestedAt:null,recordingError:null,kind:'video',recordingActive:false});
  }
}

export function canPlayInterviewRecording(recording:InterviewRecording,now=Date.now()):boolean {
  return recording.state==='ready' && Date.parse(recording.expiresAt)>now;
}
