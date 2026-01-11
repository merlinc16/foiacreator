// TypeScript types for FOIA Creator

export interface Agency {
  id: string;
  name: string;
  abbreviation: string;
  description?: string;
  website?: string;
  foia_email?: string;
  submission_url?: string;
  parent_agency?: string;
}

export interface AgencyComponent {
  id: string;
  name: string;
  abbreviation?: string;
  agency: {
    id: string;
    name: string;
    abbreviation: string;
  };
  emails?: string[];
  website?: {
    uri: string;
  };
  submission_address?: {
    address_lines?: string[];
    city?: string;
    state?: string;
    zip?: string;
  };
}

export interface RephraseResponse {
  original: string;
  rephrased: string;
  suggestedAgency?: string;
  suggestedAgencyId?: string;
  briefDescription: string;
}

export interface UserDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
  };
  feeCategory: "commercial" | "educational" | "news_media" | "other";
  maxFee: number;
  feeWaiverRequested: boolean;
  feeWaiverReason?: string;
}

export interface FOIARequest {
  id?: string;
  query: string;
  rephrasedRequest: string;
  briefDescription: string;
  agency: Agency | AgencyComponent;
  userDetails: UserDetails;
  status: "draft" | "submitted" | "pending" | "completed" | "rejected";
  submittedAt?: Date;
  trackingNumber?: string;
}

export interface WizardState {
  step: 1 | 2 | 3 | 4;
  query: string;
  rephraseResponse: RephraseResponse | null;
  selectedAgency: AgencyComponent | null;
  userDetails: UserDetails | null;
  isLoading: boolean;
  error: string | null;
}

export interface SubmitResponse {
  success: boolean;
  message: string;
  trackingId?: string;
  emailSentTo?: string;
}
