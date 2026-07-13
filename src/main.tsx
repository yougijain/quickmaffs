import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import Home from './screens/Home';
import Game from './screens/Game';
import Results from './screens/Results';
import Analytics from './screens/Analytics';
import Drills from './screens/Drills';
import Settings from './screens/Settings';
import { AuthProvider } from './auth/AuthProvider';
import { getSettings } from './data/repo';

// Seed the local settings row once, before any liveQuery observes it.
void getSettings();

// Hash router: safest for Capacitor's file:// origin (no server-side routing).
const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'drills', element: <Drills /> },
      { path: 'settings', element: <Settings /> },
      // Account content merged into Stats; keep the old path working for any
      // stale bookmarks / cached home-screen shortcuts.
      { path: 'account', element: <Navigate to="/analytics" replace /> },
    ],
  },
  // Game + Results render full-screen (no tab bar), outside the App shell.
  { path: '/game', element: <Game /> },
  { path: '/results', element: <Results /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
