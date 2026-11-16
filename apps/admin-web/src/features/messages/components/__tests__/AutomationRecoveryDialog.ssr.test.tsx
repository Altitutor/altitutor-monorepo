/** @jest-environment node */
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AutomationRecoveryDialog } from '../AutomationRecoveryDialog';

test('recovery confirmation can render on the server without a document', () => {
  expect(typeof document).toBe('undefined');
  expect(() => renderToString(<QueryClientProvider client={new QueryClient()}>
    <AutomationRecoveryDialog messageId="de253000-0000-4000-8000-000000000050" onClose={() => {}} />
  </QueryClientProvider>)).not.toThrow();
});
