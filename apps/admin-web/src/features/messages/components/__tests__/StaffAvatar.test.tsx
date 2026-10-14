import { render, screen } from '@testing-library/react';

import { SystemAvatar } from '../StaffAvatar';

describe('SystemAvatar', () => {
  it('identifies an automated message with a staff-style avatar', () => {
    render(<SystemAvatar />);

    expect(screen.getByLabelText('System')).toHaveTextContent('S');
  });
});
