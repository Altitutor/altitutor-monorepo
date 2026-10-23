/** Server-only Daily adapter. Keep API credentials out of public environment variables. */
export class DailyProviderError extends Error {
  constructor(readonly status: number) { super(`Interview media provider request failed (${status}).`); }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid interview media provider response.');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Invalid interview media provider response.');
  return value;
}

export class DailyInterviewProvider {
  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {
    if (!apiKey) throw new Error('Online interviews are not configured.');
  }
  private async request(path: string, method = 'GET', body?: unknown): Promise<Record<string, unknown>> {
    const response = await this.fetcher(`https://api.daily.co/v1${path}`, {
      method, headers: {Authorization:`Bearer ${this.apiKey}`, 'Content-Type':'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body), cache:'no-store', signal:AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new DailyProviderError(response.status);
    if (response.status === 204) return {};
    return object(await response.json());
  }
  async ensureRoom(name: string, expires: number, recording: boolean): Promise<string> {
    let room: Record<string, unknown>;
    try {
      room = await this.request('/rooms', 'POST', {name,privacy:'private',properties:{
        exp:expires,eject_at_room_exp:true,max_participants:2,enforce_unique_user_ids:true,
        enable_chat:false,enable_screenshare:false,enable_knocking:false,
        ...(recording ? {enable_recording:'cloud'} : {}),
        permissions:{canSend:false,canReceive:{base:false},canAdmin:false},
      }});
    } catch (error) {
      // Deterministic names make an interrupted create retry safe. Fetch only
      // after conflict-like responses; never disguise a provider outage.
      if (!(error instanceof DailyProviderError) || ![400,409].includes(error.status)) throw error;
      room = await this.request(`/rooms/${encodeURIComponent(name)}`);
    }
    const url = string(room.url);
    if (new URL(url).protocol !== 'https:' || !new URL(url).hostname.endsWith('.daily.co')) throw new Error('Invalid Daily room URL.');
    return url;
  }
  async token(room: string, actorId: string, name: string, expires: number, permissions: {canSend:boolean;canReceive:boolean}, recordingInstanceId?:string): Promise<string> {
    const result = await this.request('/meeting-tokens','POST',{properties:{
      room_name:room,user_id:actorId,user_name:name,is_owner:false,exp:expires,eject_at_token_exp:true,
      enable_screenshare:false,enable_recording_ui:false,
      ...(recordingInstanceId ? {start_cloud_recording:true,start_cloud_recording_opts:{type:'cloud',instanceId:recordingInstanceId,width:854,height:480,fps:15,videoBitrate:800,audioBitrate:64,maxDuration:Math.max(1,expires-Math.floor(Date.now()/1000))}} : {}),
      permissions:{canSend:permissions.canSend ? ['audio','video'] : false,canReceive:{base:permissions.canReceive},canAdmin:false},
    }});
    return string(result.token);
  }
  async closeRoom(room: string): Promise<void> {
    // Deletion both denies future joins and ejects connected participants.
    try { await this.request(`/rooms/${encodeURIComponent(room)}`,'DELETE'); }
    catch (error) { if (!(error instanceof DailyProviderError) || error.status !== 404) throw error; }
  }
  async startRecording(room: string, instanceId: string, secondsRemaining: number): Promise<void> {
    await this.request(`/rooms/${encodeURIComponent(room)}/recordings/start`,'POST',{
      type:'cloud',instanceId,width:854,height:480,fps:15,videoBitrate:800,audioBitrate:64,
      maxDuration:Math.max(1,Math.floor(secondsRemaining)),layout:{preset:'default'},
    });
  }
  async recordings(room: string): Promise<Array<{id:string;state:'recording'|'ready'|'failed';createdAt:string}>> {
    const result = await this.request(`/recordings?room_name=${encodeURIComponent(room)}&limit=100`);
    if (!Array.isArray(result.data)) throw new Error('Invalid Daily recordings response.');
    return result.data.map((value: unknown) => {
      const recording = object(value);
      if (typeof recording.start_ts !== 'number') throw new Error('Invalid Daily recording timestamp.');
      return {id:string(recording.id),state:recording.status==='finished' ? 'ready' : recording.status==='in-progress' ? 'recording' : 'failed',createdAt:new Date(recording.start_ts*1000).toISOString()};
    });
  }
  async recordingLink(id: string): Promise<string> {
    const result = await this.request(`/recordings/${encodeURIComponent(id)}/access-link?valid_for_secs=900`);
    const url = string(result.download_link);
    if (new URL(url).protocol !== 'https:') throw new Error('Invalid Daily recording URL.');
    return url;
  }
  async deleteRecording(id: string): Promise<void> {
    try { await this.request(`/recordings/${encodeURIComponent(id)}`,'DELETE'); }
    catch (error) { if (!(error instanceof DailyProviderError) || error.status!==404) throw error; }
  }
}
