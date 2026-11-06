import { fireEvent, render, screen } from '@testing-library/react';
import { ResourceAccessDenied } from '../resource-access-denied';

it('shows the pending and failed access checks before a confirmed denial', () => {
  const refetch = jest.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <ResourceAccessDenied verification={{ isPending: true, isError: false, isFetching: true, refetch }} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Checking resource access');
  expect(screen.queryByRole('heading', { name: 'Access Required' })).not.toBeInTheDocument();

  rerender(<ResourceAccessDenied verification={{ isPending: false, isError: true, isFetching: false, refetch }} />);
  expect(screen.getByRole('heading', { name: 'Couldn’t verify resource access' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);

  rerender(<ResourceAccessDenied verification={{ isPending: false, isError: false, isFetching: false, refetch }} />);
  expect(screen.getByRole('heading', { name: 'Access Required' })).toBeInTheDocument();
});
