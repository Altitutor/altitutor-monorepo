import '@testing-library/jest-dom';
import React from 'react';

// Sonner's Toaster (via ToastProvider) reads matchMedia; jsdom does not implement it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Make React available globally for JSX transformation in tests
(global as unknown as { React: typeof React }).React = React;

// Suppress console warnings for expected test scenarios
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress react-phone-number-input E.164 format warnings in tests
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Expected the initial `value` to be a E.164 phone number')
    ) {
      return;
    }
    // Suppress React act() warnings - these are handled by React Testing Library
    if (
      typeof args[0] === 'string' &&
      args[0].includes('An update to') &&
      args[0].includes('inside a test was not wrapped in act')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
