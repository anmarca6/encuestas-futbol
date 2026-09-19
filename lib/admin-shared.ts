// Constantes de las cuentas de administración, válidas también en el navegador.
export const MIN_ADMIN_PASSWORD_LENGTH = 6;
export const ADMIN_USERNAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{1,29}$/;

export interface AdminAccountInfo {
  id: string;
  username: string;
  role: 'super' | 'community';
  communitySlug: string | null;
  createdAt: number;
}

export interface AdminSessionInfo {
  username: string;
  role: 'super' | 'community';
  communitySlug: string | null;
  communityName: string | null;
}
