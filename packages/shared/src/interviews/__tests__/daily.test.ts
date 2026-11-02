import { DailyInterviewProvider } from '../server/daily';

describe('Daily interview adapter', () => {
  it('creates a private room with expiry enforced by the provider and issues restricted non-owner tokens', async () => {
    const request = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({name:'interview-room',url:'https://example.daily.co/interview-room'})))
      .mockResolvedValueOnce(new Response(JSON.stringify({token:'scoped-token'})));
    const provider = new DailyInterviewProvider('server-secret', request);
    await provider.ensureRoom('interview-room', 1900000000, true);
    await provider.token('interview-room', 'student', 'Student', 1900000000, {canSend:true,canReceive:false});
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({privacy:'private',properties:{exp:1900000000,eject_at_room_exp:true,max_participants:2}});
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({properties:{room_name:'interview-room',user_id:'student',is_owner:false,eject_at_token_exp:true,exp:1900000000,permissions:{canSend:['audio','video'],canReceive:{base:false},canAdmin:false}}});
  });
});
