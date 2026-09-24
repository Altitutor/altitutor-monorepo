import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { NoteFormData } from '../../types';
import { NotePropertiesPanel } from '../NotePropertiesPanel';

jest.mock('@/features/projects/api/queries', () => ({
  useProjects: () => ({ data: [] }),
}));

function Harness() {
  const form = useForm<NoteFormData>({
    defaultValues: {
      title: 'Doc',
      content: '',
      folder_id: null,
      project_id: null,
      is_tutor_documentation: false,
    },
  });

  return <NotePropertiesPanel form={form} folders={[]} embedded />;
}

describe('NotePropertiesPanel', () => {
  it('renders property fields without an outer Form provider', () => {
    render(<Harness />);

    expect(screen.getByText('Folder')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Tutor visibility')).toBeInTheDocument();
  });
});
