export interface RegistrationConfig {
  eventId: string;
  ticketTypes: TicketType[];
  customFields?: FormField[];
}

export interface TicketType {
  name: string;
  price: number;
  currency: 'SGD';
  capacity?: number;
  description?: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
}

export interface AttendeeRecord {
  id: string;
  eventId: string;
  name: string;
  email: string;
  ticketType: string;
  paymentStatus: 'paid' | 'free' | 'pending' | 'expired';
  stripePaymentId?: string;
  qrCode: string;
  checkedIn: boolean;
  checkedInAt?: string;
  registeredAt: string;
  customFields?: Record<string, string>;
}

export interface CheckInResult {
  success: boolean;
  attendee?: AttendeeRecord;
  error?: 'invalid_code' | 'duplicate_checkin' | 'unregistered' | 'system_unavailable';
  badge?: Badge;
}

export interface Badge {
  attendeeName: string;
  organization?: string;
  ticketType: string;
  eventName: string;
  eventBranding?: string;
  format: 'digital' | 'print';
}

export interface AttendeeStats {
  totalRegistered: number;
  ticketsByType: Record<string, number>;
  revenue: number;
  currency: 'SGD';
  remainingCapacity: Record<string, number>;
  checkedIn: number;
  pendingArrivals: number;
  checkInRate: { interval: string; count: number }[];
}

export interface RegistrationData {
  eventId: string;
  name: string;
  email: string;
  ticketType: string;
  customFields?: Record<string, string>;
}

export interface RegistrationResult {
  success: boolean;
  attendee?: AttendeeRecord;
  error?: string;
  paymentRequired?: boolean;
  paymentUrl?: string;
}
