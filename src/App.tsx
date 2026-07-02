import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/drills', label: 'Drills', icon: '🎯', end: false },
  { to: '/analytics', label: 'Stats', icon: '📊', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙︎', end: false },
];

export default function App() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col">
      <main className="flex-1 px-4 pt-safe pb-28">
        <div className="pt-4">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-ink-800 bg-ink-950/90 pb-safe backdrop-blur">
        <div className="grid grid-cols-4">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? 'text-emerald-400' : 'text-slate-500'
                }`
              }
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
