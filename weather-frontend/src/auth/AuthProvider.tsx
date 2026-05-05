import { useEffect, useRef, useState } from 'react';
import keycloak from './keycloak';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    keycloak
      .init({
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      .then((auth) => {
        setAuthenticated(auth);
        setToken(keycloak.token ?? null);

        setInterval(() => {
          keycloak.updateToken(30).then((refreshed) => {
            if (refreshed) {
              setToken(keycloak.token ?? null);
            }
          });
        }, 10000);
      });
  }, []);

  return (
    <AuthContext.Provider value={{ keycloak, authenticated, token }}>
      {children}
    </AuthContext.Provider>
  );
}
