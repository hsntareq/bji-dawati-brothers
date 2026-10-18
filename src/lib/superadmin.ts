export const SUPERADMIN_EMAIL = 'hsntareq@gmail.com';

export const isSuperAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
};
