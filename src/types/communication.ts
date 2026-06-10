export interface EmailParams {
  to: string;
  subject: string;
  body: string;
  attachments?: Attachment[];
  replyTo?: string;
}

export interface WhatsAppParams {
  phoneNumber: string;
  message: string;
  mediaUrl?: string;
}

export interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface MessageResult {
  messageId: string;
  channel: 'email' | 'whatsapp' | 'web';
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  timestamp: string;
  recipient: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  preferredChannel: 'email' | 'whatsapp' | 'web';
}

export interface MessageTemplate {
  type: 'vendor_inquiry' | 'speaker_confirmation' | 'attendee_confirmation' | 'follow_up' | 'bulk_announcement';
  variables: Record<string, string>;
}

export interface CommunicationLog {
  id: string;
  eventId: string;
  recipient: string;
  channel: 'email' | 'whatsapp' | 'web';
  contentSummary: string;
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  relatedAgent: string;
  timestamp: string;
}

export interface WebNavigationParams {
  url: string;
  actions: StagehandAction[];
  extractData?: DataExtractionSchema;
}

export interface StagehandAction {
  type: 'click' | 'type' | 'scroll' | 'wait' | 'extract';
  selector?: string;
  value?: string;
  timeout?: number;
}

export interface DataExtractionSchema {
  fields: { name: string; selector: string; type: 'text' | 'number' | 'url' }[];
}

export interface WebInteractionResult {
  success: boolean;
  extractedData?: Record<string, unknown>;
  screenshots?: string[];
  error?: string;
}
