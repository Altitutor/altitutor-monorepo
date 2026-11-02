import { filterClasses } from '../enrollmentFilters';
import { classFixture } from './classSelectionFixtures';

it('offers only active classes that the student is not already enrolled in', () => {
  const classes = [
    classFixture(),
    classFixture({ id: 'inactive-class', status: 'INACTIVE' }),
    classFixture({ id: 'enrolled-class' }),
  ];

  expect(filterClasses(classes, {
    searchQuery: '', dayFilters: [], yearLevelFilters: [], subjectFilters: [],
  }, ['enrolled-class']).map(c => c.id)).toEqual(['active-class']);
});

it('keeps day and search filters working without making matching inactive classes selectable', () => {
  const classes = [
    classFixture(),
    classFixture({ id: 'inactive-class', status: 'INACTIVE' }),
    classFixture({ id: 'tuesday-class', day_of_week: 2 }),
    classFixture({ id: 'later-class', start_time: '18:00:00' }),
  ];
  const filters = { searchQuery: '16:00', dayFilters: [1], yearLevelFilters: [], subjectFilters: [] };

  expect(filterClasses(classes, filters, []).map(c => c.id)).toEqual(['active-class']);
  expect(filterClasses(classes, { ...filters, searchQuery: 'Tuesday', dayFilters: [] }, []).map(c => c.id)).toEqual(['tuesday-class']);
  expect(filterClasses([classes[1]], filters, [])).toEqual([]);
});
