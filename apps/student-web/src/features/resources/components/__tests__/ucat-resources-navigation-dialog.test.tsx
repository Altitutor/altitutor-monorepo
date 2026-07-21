import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UcatResourcesNavigationDialog } from '../ucat-resources-navigation-dialog';

describe('UcatResourcesNavigationDialog', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('waits for confirmation before opening UCAT', () => {
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

    render(
      <UcatResourcesNavigationDialog>
        <span>MEDICINEUCAT</span>
      </UcatResourcesNavigationDialog>
    );

    fireEvent.click(screen.getByRole('button', { name: 'MEDICINEUCAT' }));

    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open UCAT' }));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('/login?redirect=%2Fsessions'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('does not open UCAT when cancelled', () => {
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

    render(
      <UcatResourcesNavigationDialog>
        <span>MEDICINEUCAT</span>
      </UcatResourcesNavigationDialog>
    );

    fireEvent.click(screen.getByRole('button', { name: 'MEDICINEUCAT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));

    expect(openSpy).not.toHaveBeenCalled();
  });
});
