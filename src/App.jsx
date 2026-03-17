import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import AppRoutes from './components/AppRoutes';
import './styles/themes.css';
import './styles/global.css';

function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <div className="app">
          <AppRoutes />
        </div>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;