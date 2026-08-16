/**
 * Tests for text highlighting utilities
 */

import React from 'react';
import { render } from '@testing-library/react';
import { highlightText } from '../highlighting';

describe('highlightText', () => {
  it('should return original text when text is null', () => {
    const result = highlightText(null, 'query');
    expect(result).toBeNull();
  });

  it('should return original text when text is undefined', () => {
    const result = highlightText(undefined, 'query');
    expect(result).toBeUndefined();
  });

  it('should return original text when query is empty', () => {
    const result = highlightText('Test text', '');
    expect(result).toBe('Test text');
  });

  it('should return original text when query is whitespace only', () => {
    const result = highlightText('Test text', '   ');
    expect(result).toBe('Test text');
  });

  it('should highlight exact match', () => {
    const result = highlightText('Test query text', 'query');
    const { container } = render(React.createElement(React.Fragment, null, result));
    
    const highlighted = container.querySelector('.font-semibold.text-brand-lightBlue');
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toBe('query');
  });

  it('should highlight case-insensitive match', () => {
    const result = highlightText('Test Query Text', 'query');
    const { container } = render(React.createElement(React.Fragment, null, result));
    
    const highlighted = container.querySelector('.font-semibold.text-brand-lightBlue');
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toBe('Query');
  });

  it('should highlight multiple matches', () => {
    const result = highlightText('test test test', 'test');
    const { container } = render(React.createElement(React.Fragment, null, result));
    
    const highlighted = container.querySelectorAll('.font-semibold.text-brand-lightBlue');
    expect(highlighted).toHaveLength(3);
  });

  it('should preserve non-matching text', () => {
    const result = highlightText('Test query text', 'query');
    const { container } = render(React.createElement(React.Fragment, null, result));
    
    const textContent = container.textContent;
    expect(textContent).toBe('Test query text');
  });

  it('should highlight regex metacharacters as literal search text', () => {
    const result = highlightText('Session (trial)', '(');
    const { container } = render(React.createElement(React.Fragment, null, result));

    const highlighted = container.querySelector('.font-semibold.text-brand-lightBlue');
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toBe('(');
    expect(container.textContent).toBe('Session (trial)');
  });

  it('should handle query at start of text', () => {
    const result = highlightText('query text', 'query');
    const { container } = render(React.createElement(React.Fragment, null, result));
    
    const highlighted = container.querySelector('.font-semibold.text-brand-lightBlue');
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toBe('query');
  });

  it('should handle query at end of text', () => {
    const result = highlightText('text query', 'query');
    const { container } = render(React.createElement(React.Fragment, null, result));
    
    const highlighted = container.querySelector('.font-semibold.text-brand-lightBlue');
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toBe('query');
  });

  it('should handle partial word matches', () => {
    const result = highlightText('testing', 'test');
    const { container } = render(React.createElement(React.Fragment, null, result));
    
    const highlighted = container.querySelector('.font-semibold.text-brand-lightBlue');
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toBe('test');
  });
});
