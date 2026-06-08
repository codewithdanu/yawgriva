/**
 * Auth utilities — token management for client-side auth state.
 */

const TOKEN_KEY = "yawgriva_token";
const USER_KEY = "yawgriva_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (typeof document !== "undefined") {
    document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=86400; SameSite=Lax`;
  }
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof document !== "undefined") {
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `yawgriva_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (typeof document !== "undefined") {
    document.cookie = `yawgriva_role=${user.role}; path=/; max-age=86400; SameSite=Lax`;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getDashboardPath(role: string): string {
  switch (role) {
    case "farmer":
      return "/farmer";
    case "distributor":
      return "/distributor";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  region: string | null;
}
