import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DialogScope } from '@altitutor/ui';
import { AutomationRecoveryDialog } from '../AutomationRecoveryDialog';

const preview = {
  messageId: 'de253000-0000-4000-8000-000000000050', body: 'Original immutable notice',
  originalDestination: '+61400999253', originalCreatedAt: '2026-10-28T12:33:04Z',
  senderId: 'sender', senderLabel: 'Altitutor', contactId: 'corrected-contact',
  destination: '+61400999255', recipientName: 'Alex Morgan', recoveryMessageId: null,
  recoveryStatus: null, canSend: true, reason: null, recipientPath: '/students/student',
};
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function setup(hiddenMainPane = false) {
  return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>
    <div style={{display:hiddenMainPane ? "none" : "block"}}><DialogScope><AutomationRecoveryDialog messageId={preview.messageId} onClose={jest.fn()} /></DialogScope></div>
  </QueryClientProvider>);
}
test('staff reviews original content and confirms only the corrected failed recipient', async () => {
  const bodies: unknown[] = [];
  global.fetch = jest.fn(async (_url, init) => {
    if (init?.method === 'POST') { bodies.push(JSON.parse(String(init.body))); return {ok:true,json:async()=>({messageId:'recovery'})} as Response; }
    return {ok:true,json:async()=>preview} as Response;
  });
  setup();
  expect(await screen.findByText('Original immutable notice')).toBeInTheDocument();
  expect(screen.getByText(/\+61400999255/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Send this failed message'}));
  await waitFor(()=>expect(bodies).toEqual([{messageId:preview.messageId,contactId:preview.contactId,destination:preview.destination,expectedRecoveryId:null}]));
});
test('unchanged rejected numbers stay disabled and explain how to correct them', async () => {
  global.fetch = jest.fn(async()=>({ok:true,json:async()=>({...preview,canSend:false,reason:'Correct the phone number in the person’s details before sending.'})} as Response));
  setup();
  expect(await screen.findByText(/Correct the phone number/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Send this failed message'})).toBeDisabled();
});

test('recovery remains visible when an accessory view hides the main dialog pane', async () => {
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>preview} as Response));
  setup(true);
  expect(await screen.findByText('Original immutable notice')).toBeVisible();
  expect(screen.getByRole('button',{name:'Send this failed message'})).toBeVisible();
});
