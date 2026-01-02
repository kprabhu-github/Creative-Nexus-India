export enum Step {
  WELCOME = 1,
  CLIENT_INFO = 2,
  SCOPE = 3,
  TERMS = 4,
  SIGNATURE = 5,
  SUCCESS = 6
}

export interface ClientDetails {
  companyName: string;
  gstNumber: string;
  billingAddress: string;
  contactName: string;
  designation: string;
  contactEmail: string;
  contactPhone: string;
  phoneCountryCode: string;
  financeEmail: string;
}

export interface ProjectScope {
  services: string[];
  deliverables: string;
  customRequirements: string;
  momDocument: File | null;
  sowDocument: File | null;
  msaDocument: File | null;
  ndaDocument: File | null;
}

export interface AgreementState {
  signatureData: string | null;
  sealData: string | null;
  signedDate: string;
  signerName: string;
  signerTitle: string;
  ticketNumber?: string;
}

export interface OnboardingData {
  step: Step;
  clientDetails: ClientDetails;
  projectScope: ProjectScope;
  agreement: AgreementState;
}

export interface ServiceOption {
  id: string;
  label: string;
}

// Formal Database Structure for "Manage" phase
export interface DatabaseRecord {
  id: string; // Ticket Number
  status: 'EXECUTED' | 'ARCHIVED';
  client: {
    name: string;
    email: string;
    taxId: string;
  };
  deal: {
    services: string[];
    signedAt: string;
    signer: string;
  };
  audit: {
    originIp: string;
    platform: string;
    hash: string;
  };
}