export type UserRole = 'admin' | 'user';

export type DocumentType = 'nmck' | 'kp';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  mustChangePassword?: boolean;
}

export interface UserSettings {
  customer: string;
  executorPosition: string;
  executorName: string;
}

export interface StoredUser {
  id: number;
  username: string;
  password: string;
  role: UserRole;
  settings: UserSettings;
  mustChangePassword: boolean;
}

export interface PublicUser {
  id: number;
  username: string;
  role: UserRole;
}

export interface StoredDocument {
  id: number;
  userId: number;
  name: string;
  state: unknown;
  type: DocumentType;
  createdAt: number;
}

export interface DatabaseFile {
  users: StoredUser[];
  documents: StoredDocument[];
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'user';
}

export function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.username === 'string' &&
    isUserRole(v.role) &&
    (v.mustChangePassword === undefined || typeof v.mustChangePassword === 'boolean')
  );
}
