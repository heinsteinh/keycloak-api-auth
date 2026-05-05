import { useContext, useState } from 'react';
import { AuthContext } from './auth/AuthProvider';
import { Weather } from './components/Weather';
import { Profile } from './components/Profile';

type Tab = 'weather' | 'profile';

function App() {
  const { keycloak, authenticated } = useContext(AuthContext);
  const [tab, setTab] = useState<Tab>('weather');

  if (!authenticated) {
    return <div>Authenticating...</div>;
  }

  const username = (keycloak?.tokenParsed as { preferred_username?: string } | undefined)
    ?.preferred_username;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pt-24 px-4">
      <header className="fixed top-0 inset-x-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg font-bold">Weather Dashboard</h1>

        <nav className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <TabButton active={tab === 'weather'} onClick={() => setTab('weather')}>
            Weather
          </TabButton>
          <TabButton active={tab === 'profile'} onClick={() => setTab('profile')}>
            Profile
          </TabButton>
        </nav>

        <div className="flex items-center gap-3">
          {username && (
            <span className="text-sm text-gray-600 hidden sm:inline">
              Signed in as <span className="font-medium">{username}</span>
            </span>
          )}
          <button
            onClick={() => keycloak?.logout()}
            className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="w-full flex justify-center pb-12">
        {tab === 'weather' ? <Weather /> : <Profile />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

export default App;
