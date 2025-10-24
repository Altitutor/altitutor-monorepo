// Format message dates with relative dates for today/yesterday
export function formatMessageDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  // Reset time parts for date comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const timeStr = date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  if (diffDays === 0) {
    return `Today ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday ${timeStr}`;
  } else {
    return date.toLocaleString('en-AU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
}

// Format conversation list dates (no time, just relative/absolute date)
export function formatConversationDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-AU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  }
}

// Format day separator (e.g., "Today", "Yesterday", "24/10/2025")
export function formatDaySeparator(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-AU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  }
}

// Check if two dates are on different days
export function isDifferentDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getDate() !== d2.getDate() || 
         d1.getMonth() !== d2.getMonth() || 
         d1.getFullYear() !== d2.getFullYear();
}

// Format status text for outbound messages
export function formatMessageStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'QUEUED': 'Queued',
    'SENDING': 'Sending',
    'SENT': 'Sent',
    'DELIVERED': 'Delivered',
    'FAILED': 'Failed',
    'UNDELIVERED': 'Undelivered',
  };
  return statusMap[status] || status;
}
