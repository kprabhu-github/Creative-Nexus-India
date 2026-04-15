export type Role = 
  | 'super_admin' 
  | 'manager' 
  | 'employee' 
  | 'account_manager' 
  | 'client_admin' 
  | 'client_viewer';

export function hasRole(userRole: string, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole as Role);
}

export function hasMinimumRole(userRole: string, minimumRole: Role): boolean {
  const hierarchy: Record<Role, number> = {
    'client_viewer': 1,
    'client_admin': 2,
    'employee': 3,
    'account_manager': 4,
    'manager': 5,
    'super_admin': 6,
  };
  
  const userRoleLevel = hierarchy[userRole as Role] || 0;
  const minRoleLevel = hierarchy[minimumRole] || 99;
  
  return userRoleLevel >= minRoleLevel;
}
