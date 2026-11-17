/** @jest-environment jsdom */
import {render,screen} from '@testing-library/react';
import {KeyboardShortcut} from '../keyboard-shortcut';
it('keeps visible shortcut hints out of the action accessible name',()=>{
  render(<button aria-keyshortcuts="1">Trial<KeyboardShortcut keys={['1']}/></button>);
  expect(screen.getByRole('button',{name:'Trial'})).toBeTruthy();
});
it('can expose a binding when the keycap is the content of shortcut help',()=>{
  render(<KeyboardShortcut keys={['G','S']} aria-hidden={false}/>);
  expect(screen.getByLabelText('G+S').getAttribute('aria-hidden')).toBe('false');
});
