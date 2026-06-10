export type EventStatus = 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'draft';

export type EventType =
  | 'wedding'
  | 'corporate'
  | 'birthday'
  | 'launch'
  | 'social'
  | 'other';

export type VendorCategory =
  | 'flowers'
  | 'cake'
  | 'catering'
  | 'dj'
  | 'photography'
  | 'venue'
  | 'transport'
  | 'decoration'
  | 'other';

export type VendorStatus =
  | 'booked'
  | 'deposit_paid'
  | 'awaiting_confirmation'
  | 'quote_requested'
  | 'delivered'
  | 'cancelled';

export interface VendorContact {
  id: string;
  category: VendorCategory;
  vendorName: string;
  contactName: string;
  phone: string;
  email: string;
  website?: string;
  status: VendorStatus;
  notes?: string;
  statusHistory: { status: VendorStatus; timestamp: string }[];
}

export type MilestoneStatus = 'pending' | 'done' | 'overdue';
export type MilestoneCategory =
  | 'finance'
  | 'logistics'
  | 'catering'
  | 'venue'
  | 'communication'
  | 'other';

export interface Milestone {
  id: string;
  date: string;
  title: string;
  category: MilestoneCategory;
  status: MilestoneStatus;
}

export interface ScheduleItem {
  time: string;
  title: string;
  speaker?: string;
  status?: 'confirmed' | 'discussing' | 'pending';
}

export interface EventModel {
  id: string;
  name: string;
  status: EventStatus;
  type?: EventType;
  pinned?: boolean;
  date: string; // ISO
  updatedAt: string;
  coverImage?: string;
  venue?: { name: string; address: string; confirmed: boolean };
  catering?: { name: string; menu: string; confirmed: boolean };
  attendees?: { count: number; confirmed: number };
  schedule?: ScheduleItem[];
  budget?: { committed: number; spent: number; total: number };
  topics?: string[];
  vendors: VendorContact[];
  milestones: Milestone[];
}
