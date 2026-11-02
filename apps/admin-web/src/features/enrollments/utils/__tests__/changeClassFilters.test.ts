import { filterClassesForChange } from '../changeClassFilters';
import { classFixture } from './classSelectionFixtures';

it('offers only active same-subject alternatives when changing class', () => {
  const oldClass = classFixture({ id: 'current-class' });
  const classes = [
    oldClass,
    classFixture(),
    classFixture({ id: 'inactive-class', status: 'INACTIVE' }),
    classFixture({ id: 'other-subject', subject_id: 'english' }),
  ];

  expect(filterClassesForChange(classes, oldClass, '').map(c => c.id)).toEqual(['active-class']);
});

it('keeps day and search filters working without making matching inactive classes selectable', () => {
  const oldClass = classFixture({ id: 'current-class' });
  const classes = [
    classFixture(),
    classFixture({ id: 'inactive-class', status: 'INACTIVE' }),
    classFixture({ id: 'tuesday-class', day_of_week: 2 }),
    classFixture({ id: 'later-class', start_time: '18:00:00' }),
  ];

  expect(filterClassesForChange(classes, oldClass, '16:00', [1]).map(c => c.id)).toEqual(['active-class']);
  expect(filterClassesForChange(classes, oldClass, 'Tuesday').map(c => c.id)).toEqual(['tuesday-class']);
  expect(filterClassesForChange([classes[1]], oldClass, '16:00', [1])).toEqual([]);
});
