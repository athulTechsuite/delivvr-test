import React from 'react';
import { ThemeProvider } from './contexts/ThemeProvider';
import { useTheme } from './hooks/useTheme';
import ThemeSettings from './components/ThemeSettings';
import './styles/themes.css';

// Main App Component
const App = () => {
  const { actualTheme, themeMode, isSystemMode } = useTheme();

  return (
    <div className="app">
      <header className="app-header">
        <h1>My App</h1>
        <div className="theme-indicator">
          Current theme: {actualTheme}
          {isSystemMode && ' (System)'}
        </div>
      </header>
      
      <main className="app-main">
        <div className="content">
          <h2>Welcome to the App</h2>
          <p>This app supports light, dark, and system default themes.</p>
          <p>The theme changes are applied immediately and persist across sessions.</p>
          
          <div className="card">
            <h3>Sample Card</h3>
            <p>This card demonstrates how components adapt to different themes.</p>
            <button className="primary-button">Primary Button</button>
            <button className="secondary-button">Secondary Button</button>
          </div>
        </div>
        
        <aside className="sidebar">
          <ThemeSettings />
        </aside>
      </main>
    </div>
  );
};

// App with Theme Provider Wrapper
const AppWithTheme = () => {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
};

export default AppWithTheme;