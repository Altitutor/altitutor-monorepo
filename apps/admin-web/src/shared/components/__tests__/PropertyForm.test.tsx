import { propertyFormSelectStretchClassName, PropertyForm, PropertyFormRow } from '../PropertyForm';
import { render } from '@testing-library/react';

describe('PropertyForm', () => {
  it('stretches searchable select triggers in the value column', () => {
    const { container } = render(
      <PropertyForm>
        <PropertyFormRow label="Type">
          <span data-searchable-select-trigger="">Select</span>
        </PropertyFormRow>
      </PropertyForm>
    );

    expect(container.firstElementChild?.className).toContain(propertyFormSelectStretchClassName);
  });
});
