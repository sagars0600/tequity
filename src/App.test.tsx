// app.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import App from './App';
import FileUploader from './FileUploader';

expect.extend(toHaveNoViolations);


test('renders bulk document uploader title', () => {
  render(<App />);
  const titleElement = screen.getByText(/bulk document uploader/i);
  expect(titleElement).toBeInTheDocument();
});

