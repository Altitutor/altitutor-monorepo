import { screen } from '@testing-library/react';
import { FounderOffers } from '../FounderOffers';
import { listFounderOffers, type FounderOffer } from '../../api/founder-offers';
import { renderWithProviders } from '@/shared/test-utils';

jest.mock('../../api/founder-offers', () => ({
  listFounderOffers: jest.fn(),
  createFounderOffer: jest.fn(),
  setFounderOfferActive: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/settings/ucat-billing',
  useSearchParams: () => new URLSearchParams('tab=offers'),
}));

const mockedListFounderOffers = jest.mocked(listFounderOffers);

const offer: FounderOffer = {
  id: 'offer-1',
  name: 'Founding students',
  code: 'F-FOUNDERS',
  campaign: 'founders-2026',
  kind: 'access_pass',
  duration_count: 2,
  duration_unit: 'week',
  percent_off: null,
  max_redemptions: 1,
  expires_at: null,
  active: true,
  created_at: '2026-09-01T00:00:00Z',
  created_by: null,
  ucat_founder_redemptions: [],
};

describe('FounderOffers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedListFounderOffers.mockResolvedValue([offer]);
  });

  it('shows founder offers in the settings table', async () => {
    renderWithProviders(<FounderOffers />);

    expect(await screen.findByText('Founding students')).toBeInTheDocument();
    expect(screen.getByText('F-FOUNDERS')).toBeInTheDocument();
    expect(screen.getByText('founders-2026')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search founder offers...')).toBeInTheDocument();
  });

  it('opens the create dialog from the new-offer trigger', async () => {
    const { rerender } = renderWithProviders(<FounderOffers onCreateTrigger={0} />);
    await screen.findByText('Founding students');

    rerender(<FounderOffers onCreateTrigger={1} />);

    expect(await screen.findByText('New founder offer')).toBeInTheDocument();
    expect(screen.getByLabelText('Offer name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create offer' })).toBeInTheDocument();
  });
});
