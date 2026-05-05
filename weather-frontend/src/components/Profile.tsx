import { useContext, useState } from 'react';
import { AuthContext } from '../auth/AuthProvider';

type ParsedToken = {
  sub?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  iss?: string;
  azp?: string;
  sid?: string;
  exp?: number;
  iat?: number;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
};

function formatTimestamp(unix?: number): string {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right break-all">
        {value || <span className="text-gray-400">—</span>}
      </span>
    </div>
  );
}

function RoleBadges({ roles }: { roles?: string[] }) {
  if (!roles || roles.length === 0) {
    return <span className="text-gray-400 text-sm">none</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      {roles.map((r) => (
        <span
          key={r}
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
        >
          {r}
        </span>
      ))}
    </div>
  );
}

export function Profile() {
  const { keycloak } = useContext(AuthContext);
  const [showRaw, setShowRaw] = useState(false);

  const parsed = keycloak?.tokenParsed as ParsedToken | undefined;

  if (!parsed) {
    return <p className="text-gray-500">Loading profile…</p>;
  }

  const realmRoles = parsed.realm_access?.roles ?? [];
  const resourceAccess = parsed.resource_access ?? {};

  return (
    <div className="w-full max-w-md space-y-4">
      <section className="bg-white shadow-lg rounded-xl p-6">
        <h2 className="text-lg font-bold mb-3">Identity</h2>
        <Field label="Username" value={parsed.preferred_username} />
        <Field
          label="Full name"
          value={
            parsed.name ||
            [parsed.given_name, parsed.family_name].filter(Boolean).join(' ')
          }
        />
        <Field
          label="Email"
          value={
            parsed.email ? (
              <span className="flex items-center gap-1.5 justify-end">
                {parsed.email}
                {parsed.email_verified ? (
                  <span className="text-green-600" title="Verified">
                    ✓
                  </span>
                ) : (
                  <span className="text-amber-500" title="Not verified">
                    ⚠
                  </span>
                )}
              </span>
            ) : null
          }
        />
        <Field label="Subject (sub)" value={parsed.sub} />
      </section>

      <section className="bg-white shadow-lg rounded-xl p-6">
        <h2 className="text-lg font-bold mb-3">Authorization</h2>
        <Field label="Realm roles" value={<RoleBadges roles={realmRoles} />} />
        {Object.entries(resourceAccess).map(([client, { roles }]) => (
          <Field
            key={client}
            label={`${client} (client)`}
            value={<RoleBadges roles={roles} />}
          />
        ))}
        {Object.keys(resourceAccess).length === 0 && (
          <Field label="Client roles" value={<RoleBadges roles={[]} />} />
        )}
      </section>

      <section className="bg-white shadow-lg rounded-xl p-6">
        <h2 className="text-lg font-bold mb-3">Session</h2>
        <Field label="Issuer (iss)" value={parsed.iss} />
        <Field label="Authorized party (azp)" value={parsed.azp} />
        <Field label="Session ID (sid)" value={parsed.sid} />
        <Field label="Issued at" value={formatTimestamp(parsed.iat)} />
        <Field label="Expires at" value={formatTimestamp(parsed.exp)} />
      </section>

      <section className="bg-white shadow-lg rounded-xl p-6">
        <button
          onClick={() => setShowRaw((s) => !s)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showRaw ? 'Hide' : 'Show'} raw token claims
        </button>
        {showRaw && (
          <pre className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
