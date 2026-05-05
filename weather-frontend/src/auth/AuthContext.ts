import { createContext } from 'react';
import type Keycloak from 'keycloak-js';

export type AuthContextType = {
  keycloak: Keycloak | null;
  authenticated: boolean;
  token: string | null;
};

export const AuthContext = createContext<AuthContextType>({
  keycloak: null,
  authenticated: false,
  token: null,
});
