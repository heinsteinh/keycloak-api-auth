import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { config } from '../config.js';

const jwksUri = new URL(`${config.KEYCLOAK_ISSUER}/protocol/openid-connect/certs`);
const JWKS = createRemoteJWKSet(jwksUri);

export type AuthenticatedUser = {
  sub: string;
  username?: string;
  email?: string;
  roles: string[];
  raw: JWTPayload;
};

type KeycloakAccessToken = JWTPayload & {
  preferred_username?: string;
  email?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<string, { roles?: string[] }>;
  azp?: string;
};

export async function verifyAccessToken(token: string): Promise<AuthenticatedUser> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: config.KEYCLOAK_ISSUER,
  });

  const kcPayload = payload as KeycloakAccessToken;

  if (!kcPayload.azp || !config.ALLOWED_AZP.includes(kcPayload.azp)) {
    throw new Error('Invalid authorized party');
  }

  const realmRoles = kcPayload.realm_access?.roles ?? [];
  const clientRoles = kcPayload.azp
    ? (kcPayload.resource_access?.[kcPayload.azp]?.roles ?? [])
    : [];

  return {
    sub: kcPayload.sub ?? '',
    username: kcPayload.preferred_username,
    email: kcPayload.email,
    roles: [...new Set([...realmRoles, ...clientRoles])],
    raw: payload,
  };
}