import type { BlockoutRow } from '../api/blockouts';

/**
 * Get staff name from blockout
 */
export function getStaffNameFromBlockout(
  blockout: BlockoutRow,
  _staffId: string
): string {
  // Try to find in blockouts (they have staff relation)
  if ('staff' in blockout && blockout.staff) {
    const staffData = blockout.staff as { first_name: string; last_name: string };
    return `${staffData.first_name} ${staffData.last_name}`;
  }
  
  return 'Unknown';
}
