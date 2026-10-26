
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
/**
 * Checks if a user is the owner/creator or assigned member of a specific ward.
 */
export const isWardOwner = (user: UserAuthContext | null | undefined, ward: OrgItem): boolean => {
  if (!user || ward.type !== 'ward') return false;
  return (
    ward.createdBy === user.uid ||
    emailEquals(ward.creatorEmail, user.email) ||
    emailInList(ward.allowedEmails, user.email)
  );
};

/**
 * Determines all organizations accessible to a user:
 * Shows ONLY own and child organizations everywhere.
 * - Own organization: Created by user, creator email matches, or user is in allowedEmails.
 * - Child organization: Has parentOrgId matching one of the user's own organizations (e.g. units of an owned ward).
 */
export const getAccessibleOrganizations = (
  user: UserAuthContext | null | undefined,
  allOrgs: OrgItem[]
): OrgItem[] => {
  if (!user) return [];

  // 1. Collect all organizations directly owned by or assigned to the user ("own organizations")
  const ownOrgIds = new Set<string>();

  allOrgs.forEach(o => {
    const isDirectOwnerOrMember =
      o.createdBy === user.uid ||
      emailEquals(o.creatorEmail, user.email) ||
      emailInList(o.allowedEmails, user.email);

    if (isDirectOwnerOrMember) {
      ownOrgIds.add(o.id);
    }
  });

  // 2. Expand to include child organizations (e.g. units under an owned/assigned ward)
  const accessibleOrgIds = new Set<string>(ownOrgIds);
  let addedNew = true;
  while (addedNew) {
    addedNew = false;
    allOrgs.forEach(o => {
      if (!accessibleOrgIds.has(o.id) && o.parentOrgId && accessibleOrgIds.has(o.parentOrgId)) {
        accessibleOrgIds.add(o.id);
        addedNew = true;
      }
    });
  }

  // 3. Return only own and child organizations
  return allOrgs.filter(o => accessibleOrgIds.has(o.id));
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
 * - Contact with organizationId: Must belong to one of the user's accessible organizations (own or child)
 * - Contact without organizationId: Accessible only to its creator (prevents foreign leaks)
 */
export const isContactAccessible = (
  contact: ContactItem,
  user: UserAuthContext | null | undefined,
  accessibleOrgIds: Set<string>
): boolean => {
  if (!user) return false;

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
  return contacts.filter(c => isContactAccessible(c, user, accessibleOrgIds));
};
