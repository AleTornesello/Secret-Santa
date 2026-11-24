import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('App', () => {
  it('starts on the home page', () => {
    window.location.hash = '';
    render(<App locale="it" />);
    expect(screen.getByRole('heading', { name: 'Secret Santa' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Crea un gruppo' })).toBeDefined();
  });
});
