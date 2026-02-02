import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Auth from './Auth';

describe('Auth Component', () => {
  test('renders SendaFit title', () => {
    const { getByText } = render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );
    expect(getByText(/SendaFit/i)).toBeInTheDocument();
  });

  test('renders sign in and sign up tabs', () => {
    const { getByRole } = render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );
    expect(getByRole('tab', { name: /Iniciar Sesión/i })).toBeInTheDocument();
    expect(getByRole('tab', { name: /Registrarse/i })).toBeInTheDocument();
  });
});
