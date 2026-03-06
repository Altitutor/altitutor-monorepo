/**
 * Get initials from first and last name for avatar display
 */
export function getUserInitials(firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (firstName) {
    return firstName.charAt(0).toUpperCase();
  }
  return '?';
}
