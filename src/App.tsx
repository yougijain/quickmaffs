import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Home', end: true, icon: HomeIcon },
  { to: '/drills', label: 'Drills', end: false, icon: TargetIcon },
  { to: '/analytics', label: 'Stats', end: false, icon: ChartIcon },
  { to: '/settings', label: 'Settings', end: false, icon: GearIcon },
];

export default function App() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col">
      <main className="flex-1 px-5 pt-safe pb-32">
        <div className="pt-5">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink-950/80 pb-safe backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-1.5">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `group flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-brand' : 'text-faint hover:text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <t.icon active={isActive} />
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

type IconProps = { active?: boolean };
const base = 'h-[22px] w-[22px] transition-transform';

function HomeIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${active ? '-translate-y-0.5' : ''}`}>
      <path
        d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function TargetIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${active ? '-translate-y-0.5' : ''}`}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}
function ChartIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${active ? '-translate-y-0.5' : ''}`}>
      <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function GearIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${active ? '-translate-y-0.5' : ''}`}>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
