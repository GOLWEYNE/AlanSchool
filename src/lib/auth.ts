type RoleClaims = {
  [key: string]: unknown;
  role?: string;
  metadata?: { role?: string };
  publicMetadata?: { role?: string };
};

export const getUserRole = (
  sessionClaims: RoleClaims | null | undefined,
  fallbackRole = ""
) => {
  const role = (
    sessionClaims?.role ??
    sessionClaims?.metadata?.role ??
    sessionClaims?.publicMetadata?.role ??
    fallbackRole
  );

  return String(role).trim().toLowerCase();
};
