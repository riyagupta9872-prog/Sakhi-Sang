// Single source of truth for the 4 roles in Sakhi Sang.
// Internal IDs stay stable so old user docs keep working;
// only the display labels were renamed.

export const ROLES = ['superAdmin', 'departmentAdmin', 'teamAdmin', 'serviceDevotee'];

export const ROLE_LABELS = {
  superAdmin:      'Super Admin',
  departmentAdmin: 'Department Admin',
  teamAdmin:       'Team Coordinator',
  serviceDevotee:  'Facilitator',
};

// Role hierarchy — higher = more privileges
export const ROLE_RANK = {
  superAdmin: 4,
  departmentAdmin: 3,
  teamAdmin: 2,
  serviceDevotee: 1,
};

// Convenience predicates
export const isAdminRole       = r => r === 'superAdmin' || r === 'departmentAdmin';
export const isCoordinatorRole = r => isAdminRole(r) || r === 'teamAdmin';
export const isValidRole       = r => ROLES.includes(r);
