export type TriageStatus =
  | "draft"
  | "waiting_lawyer"
  | "in_attendance"
  | "attendance_finished"
  | "waiting_documents"
  | "converted"
  | "archived";

export type TriagePriority = "low" | "medium" | "high" | "urgent";

export type TriageListItem = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  document: string | null;
  city: string | null;
  practice_area: string | null;
  demand_type: string | null;
  priority: TriagePriority;
  origin: string | null;
  status: TriageStatus;
  assigned_to: string | null;
  client_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  created_at: string;
};

export type TriageDetail = TriageListItem & {
  address: string | null;
  raw_description: string;
  observations: string | null;
  secretary_notes: string | null;
  lawyer_notes: string | null;
  legal_analysis: string | null;
  legal_viability: string | null;
  internal_notes: string | null;
  recommended_action: string | null;
  pending_documents: string[] | null;
  archived_reason: string | null;
  attendance_duration_seconds: number | null;
  converted_at: string | null;
  ai_classification: Record<string, unknown> | null;
  notes: string | null;
  finished_at: string | null;
  converted_client_id: string | null;
  converted_case_id: string | null;
  converted_contract_id: string | null;
  converted_card_id: string | null;
  created_by: string;
  updated_at: string;
};

export type TriageTab =
  | "all"
  | "waiting_lawyer"
  | "mine"
  | "in_attendance"
  | "attendance_finished"
  | "waiting_documents"
  | "converted"
  | "archived";
