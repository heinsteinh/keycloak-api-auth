import { useContext } from 'react';
import { AuthContext } from './auth/AuthProvider';
import { Weather } from './components/Weather';

function App() {
  const { keycloak, authenticated } = useContext(AuthContext);

  if (!authenticated) {
    return <div>Authenticating...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <div className="absolute top-4 right-4">
        <button
          onClick={() => keycloak?.logout()}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-6">Weather Dashboard</h1>

      <Weather />
    </div>
  );
}

export default App;
