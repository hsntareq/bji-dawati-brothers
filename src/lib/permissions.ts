import { isSuperAdmin } from './superadmin';

export interface UserAuthContext {
  uid: string;
  email?: string | null;
}

export interface OrgItem {
  id: string;
  name?: string;
  type?: 'ward' | 'unit' | string;
  createdBy?: string;
  creatorEmail?: string | null;
  allowedEmails?: string[];
  parentOrgId?: string | null;
  [key: string]: any;
}

export interface ContactItem {
  id: string;
  organizationId?: string | null;
  createdBy?: string;
  [key: string]: any;
}

const emailEquals = (a?: string | null, b?: string | null): boolean => {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
};

const emailInList = (list?: string[] | null, targetEmail?: string | null): boolean => {
  if (!list || !targetEmail) return false;
  const target = targetEmail.trim().toLowerCase();
  return list.some(item => typeof item === 'string' && item.trim().toLowerCase() === target);
};

/**
 * Checks if a user is the owner/creator of a specific ward.
 */
export const isWardOwner = (user: UserAuthContext | null | undefined, ward: OrgItem): boolean => {
  if (!user || ward.type !== 'ward') return false;
  if (isSuperAdmin(user.email)) return true;
  return (
    ward.createdBy === user.uid ||
    emailEquals(ward.creatorEmail, user.email)
  );
};

/**
 * Determines all organizations accessible to a user based on strict role & scoping rules:
 * - SuperAdmin: All organizations
 * - Ward Owner: The ward they own AND all child units of that ward ("ward owner can see their and their children's persons")
 * - Ward Member (in allowedEmails of a ward, but not owner): Only that ward itself ("ward can only see their own persons"), NOT the child units
 * - Unit Owner / Member: Only their specific unit
 * - General/Other Orgs: If created by user or in allowedEmails
 */
export const getAccessibleOrganizations = (
  user: UserAuthContext | null | undefined,
  allOrgs: OrgItem[]
): OrgItem[] => {
  if (!user) return [];
  if (isSuperAdmin(user.email)) return allOrgs;

  // Identify all wards owned by the user
  const ownedWardIds = new Set(
    allOrgs
      .filter(o => o.type === 'ward' && isWardOwner(user, o))
      .map(o => o.id)
  );

  return allOrgs.filter(o => {
    // 1. Direct creator/owner of this organization
    if (o.createdBy === user.uid || emailEquals(o.creatorEmail, user.email)) {
      return true;
    }

    // 2. Child unit of a ward owned by the user
    // "ward owner can see their and their children's persons"
    if (o.type === 'unit' && o.parentOrgId && ownedWardIds.has(o.parentOrgId)) {
      return true;
    }

    // 3. User is directly in allowedEmails of this organization (ward member or unit member)
    // Note: a ward member gets access to the ward itself ("ward can only see their own persons"),
    // but not child units unless they are the ward owner or explicitly in the child unit's allowedEmails.
    if (emailInList(o.allowedEmails, user.email)) {
      return true;
    }

    return false;
  });
};

/**
 * Returns a Set of all accessible organization IDs.
 */
export const getAccessibleOrgIds = (
  user: UserAuthContext | null | undefined,
  allOrgs: OrgItem[]
): Set<string> => {
  return new Set(getAccessibleOrganizations(user, allOrgs).map(o => o.id));
};

/**
 * Determines if a specific contact is accessible to the user:
 * - SuperAdmin: Access to all contacts
 * - Contact with organizationId: Must belong to one of the user's accessible organizations
 * - Contact without organizationId: Accessible only to its creator (prevents foreign leaks)
 */
export const isContactAccessible = (
  contact: ContactItem,
  user: UserAuthContext | null | undefined,
  accessibleOrgIds: Set<string>
): boolean => {
  if (!user) return false;
  if (isSuperAdmin(user.email)) return true;

  if (contact.organizationId) {
    return accessibleOrgIds.has(contact.organizationId);
  }

  // Fallback for contacts without organizationId: only creator can see
  return contact.createdBy === user.uid;
};

/**
 * Filters a list of contacts to only those accessible to the user.
 */
export const filterAccessibleContacts = (
  contacts: ContactItem[],
  user: UserAuthContext | null | undefined,
  accessibleOrgIds: Set<string>
): ContactItem[] => {
  if (!user) return [];
  if (isSuperAdmin(user.email)) return contacts;
  return contacts.filter(c => isContactAccessible(c, user, accessibleOrgIds));
};
