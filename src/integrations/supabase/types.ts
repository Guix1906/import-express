export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          company_id: string;
          created_at: string;
          entity_id: string | null;
          entity_label: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          user_id: string;
        };
        Insert: {
          action: string;
          company_id: string;
          created_at?: string;
          entity_id?: string | null;
          entity_label?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          user_id: string;
        };
        Update: {
          action?: string;
          company_id?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_label?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      atendimentos: {
        Row: {
          amount: number | null;
          assigned_to: string | null;
          billable: boolean;
          case_id: string | null;
          channel: Database["public"]["Enums"]["atendimento_channel"];
          client_id: string | null;
          company_id: string;
          consultation_type: string;
          created_at: string;
          created_by: string;
          duration_minutes: number | null;
          fee_schedule_id: string | null;
          hourly_rate: number | null;
          id: string;
          scheduled_at: string | null;
          status: Database["public"]["Enums"]["atendimento_status"];
          subject: string;
          summary: string | null;
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          assigned_to?: string | null;
          billable?: boolean;
          case_id?: string | null;
          channel?: Database["public"]["Enums"]["atendimento_channel"];
          client_id?: string | null;
          company_id: string;
          consultation_type?: string;
          created_at?: string;
          created_by: string;
          duration_minutes?: number | null;
          fee_schedule_id?: string | null;
          hourly_rate?: number | null;
          id?: string;
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["atendimento_status"];
          subject: string;
          summary?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          assigned_to?: string | null;
          billable?: boolean;
          case_id?: string | null;
          channel?: Database["public"]["Enums"]["atendimento_channel"];
          client_id?: string | null;
          company_id?: string;
          consultation_type?: string;
          created_at?: string;
          created_by?: string;
          duration_minutes?: number | null;
          fee_schedule_id?: string | null;
          hourly_rate?: number | null;
          id?: string;
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["atendimento_status"];
          subject?: string;
          summary?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "atendimentos_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimentos_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimentos_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      board_columns: {
        Row: {
          board_id: string;
          company_id: string;
          created_at: string;
          id: string;
          key: string;
          position: number;
          title: string;
        };
        Insert: {
          board_id: string;
          company_id: string;
          created_at?: string;
          id?: string;
          key: string;
          position?: number;
          title: string;
        };
        Update: {
          board_id?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          key?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "board_columns_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      board_members: {
        Row: {
          board_id: string;
          company_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          board_id: string;
          company_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          board_id?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      boards: {
        Row: {
          board_type: string;
          color: string;
          company_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          gradient: string | null;
          icon: string | null;
          id: string;
          name: string;
          owner_id: string | null;
          role_label: string | null;
          updated_at: string;
        };
        Insert: {
          board_type?: string;
          color?: string;
          company_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          gradient?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          owner_id?: string | null;
          role_label?: string | null;
          updated_at?: string;
        };
        Update: {
          board_type?: string;
          color?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          gradient?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          owner_id?: string | null;
          role_label?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      card_phase_history: {
        Row: {
          actor_id: string;
          card_id: string;
          company_id: string;
          created_at: string;
          from_value: string | null;
          id: string;
          to_value: string;
          track: string;
        };
        Insert: {
          actor_id: string;
          card_id: string;
          company_id: string;
          created_at?: string;
          from_value?: string | null;
          id?: string;
          to_value: string;
          track: string;
        };
        Update: {
          actor_id?: string;
          card_id?: string;
          company_id?: string;
          created_at?: string;
          from_value?: string | null;
          id?: string;
          to_value?: string;
          track?: string;
        };
        Relationships: [];
      };
      cases: {
        Row: {
          assigned_to: string | null;
          case_value: number | null;
          client_id: string | null;
          cnj_number: string | null;
          company_id: string;
          court: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          distribution_date: string | null;
          id: string;
          instance: string | null;
          internal_number: string | null;
          lawyer_id: string | null;
          phase: string | null;
          polo_ativo: string | null;
          polo_passivo: string | null;
          practice_area: string | null;
          priority: string;
          procedural_status: string | null;
          status: Database["public"]["Enums"]["case_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          case_value?: number | null;
          client_id?: string | null;
          cnj_number?: string | null;
          company_id: string;
          court?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          distribution_date?: string | null;
          id?: string;
          instance?: string | null;
          internal_number?: string | null;
          lawyer_id?: string | null;
          phase?: string | null;
          polo_ativo?: string | null;
          polo_passivo?: string | null;
          practice_area?: string | null;
          priority?: string;
          procedural_status?: string | null;
          status?: Database["public"]["Enums"]["case_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          case_value?: number | null;
          client_id?: string | null;
          cnj_number?: string | null;
          company_id?: string;
          court?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          distribution_date?: string | null;
          id?: string;
          instance?: string | null;
          internal_number?: string | null;
          lawyer_id?: string | null;
          phase?: string | null;
          polo_ativo?: string | null;
          polo_passivo?: string | null;
          practice_area?: string | null;
          priority?: string;
          procedural_status?: string | null;
          status?: Database["public"]["Enums"]["case_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          birth_date: string | null;
          city: string | null;
          client_type: Database["public"]["Enums"]["client_type"];
          company_id: string;
          created_at: string;
          created_by: string;
          document: string | null;
          email: string | null;
          id: string;
          is_provisional: boolean;
          marital_status: string | null;
          name: string;
          notes: string | null;
          phone: string | null;
          photo_url: string | null;
          profession: string | null;
          rg: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          birth_date?: string | null;
          city?: string | null;
          client_type?: Database["public"]["Enums"]["client_type"];
          company_id: string;
          created_at?: string;
          created_by: string;
          document?: string | null;
          email?: string | null;
          id?: string;
          is_provisional?: boolean;
          marital_status?: string | null;
          name: string;
          notes?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          profession?: string | null;
          rg?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          birth_date?: string | null;
          city?: string | null;
          client_type?: Database["public"]["Enums"]["client_type"];
          company_id?: string;
          created_at?: string;
          created_by?: string;
          document?: string | null;
          email?: string | null;
          id?: string;
          is_provisional?: boolean;
          marital_status?: string | null;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          profession?: string | null;
          rg?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          slug: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          slug?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          slug?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      contracts: {
        Row: {
          case_id: string | null;
          client_id: string | null;
          company_id: string;
          contract_type: string;
          counterparty: string | null;
          created_at: string;
          created_by: string;
          end_date: string | null;
          file_url: string | null;
          id: string;
          notes: string | null;
          payment_terms: string | null;
          signed_at: string | null;
          start_date: string | null;
          status: string;
          title: string;
          updated_at: string;
          value: number | null;
        };
        Insert: {
          case_id?: string | null;
          client_id?: string | null;
          company_id: string;
          contract_type?: string;
          counterparty?: string | null;
          created_at?: string;
          created_by: string;
          end_date?: string | null;
          file_url?: string | null;
          id?: string;
          notes?: string | null;
          payment_terms?: string | null;
          signed_at?: string | null;
          start_date?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          value?: number | null;
        };
        Update: {
          case_id?: string | null;
          client_id?: string | null;
          company_id?: string;
          contract_type?: string;
          counterparty?: string | null;
          created_at?: string;
          created_by?: string;
          end_date?: string | null;
          file_url?: string | null;
          id?: string;
          notes?: string | null;
          payment_terms?: string | null;
          signed_at?: string | null;
          start_date?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          value?: number | null;
        };
        Relationships: [];
      };
      deadlines: {
        Row: {
          assigned_to: string | null;
          case_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          due_date: string;
          id: string;
          is_double_term: boolean;
          last_alert_at: string | null;
          last_alert_level: string | null;
          publication_id: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          case_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          due_date: string;
          id?: string;
          is_double_term?: boolean;
          last_alert_at?: string | null;
          last_alert_level?: string | null;
          publication_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          case_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          due_date?: string;
          id?: string;
          is_double_term?: boolean;
          last_alert_at?: string | null;
          last_alert_level?: string | null;
          publication_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deadlines_publication_id_fkey";
            columns: ["publication_id"];
            isOneToOne: false;
            referencedRelation: "publications";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          card_id: string | null;
          case_id: string | null;
          category: string | null;
          client_id: string | null;
          company_id: string;
          created_at: string;
          description: string | null;
          id: string;
          mime_type: string | null;
          name: string;
          owner_member_id: string | null;
          scope: string;
          size_bytes: number | null;
          storage_path: string;
          subcategory: string | null;
          triagem_id: string | null;
          updated_at: string;
          uploaded_by: string;
        };
        Insert: {
          card_id?: string | null;
          case_id?: string | null;
          category?: string | null;
          client_id?: string | null;
          company_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          mime_type?: string | null;
          name: string;
          owner_member_id?: string | null;
          scope?: string;
          size_bytes?: number | null;
          storage_path: string;
          subcategory?: string | null;
          triagem_id?: string | null;
          updated_at?: string;
          uploaded_by: string;
        };
        Update: {
          card_id?: string | null;
          case_id?: string | null;
          category?: string | null;
          client_id?: string | null;
          company_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          mime_type?: string | null;
          name?: string;
          owner_member_id?: string | null;
          scope?: string;
          size_bytes?: number | null;
          storage_path?: string;
          subcategory?: string | null;
          triagem_id?: string | null;
          updated_at?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          assigned_to: string | null;
          case_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          ends_at: string | null;
          event_type: Database["public"]["Enums"]["event_type"];
          id: string;
          location: string | null;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          case_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          ends_at?: string | null;
          event_type?: Database["public"]["Enums"]["event_type"];
          id?: string;
          location?: string | null;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          case_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          ends_at?: string | null;
          event_type?: Database["public"]["Enums"]["event_type"];
          id?: string;
          location?: string | null;
          starts_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      fee_schedule: {
        Row: {
          active: boolean;
          company_id: string;
          created_at: string;
          created_by: string;
          default_amount: number;
          description: string | null;
          id: string;
          service_type: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          company_id: string;
          created_at?: string;
          created_by: string;
          default_amount?: number;
          description?: string | null;
          id?: string;
          service_type: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          default_amount?: number;
          description?: string | null;
          id?: string;
          service_type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      financial_entries: {
        Row: {
          amount: number;
          case_id: string | null;
          category: string | null;
          client_id: string | null;
          company_id: string;
          contract_id: string | null;
          created_at: string;
          created_by: string;
          description: string;
          due_date: string | null;
          entry_type: string;
          id: string;
          notes: string | null;
          paid_at: string | null;
          payment_method: string | null;
          source: string | null;
          source_id: string | null;
          source_ref: string | null;
          status: string;
          subtype: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          case_id?: string | null;
          category?: string | null;
          client_id?: string | null;
          company_id: string;
          contract_id?: string | null;
          created_at?: string;
          created_by: string;
          description: string;
          due_date?: string | null;
          entry_type: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          source?: string | null;
          source_id?: string | null;
          source_ref?: string | null;
          status?: string;
          subtype?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          case_id?: string | null;
          category?: string | null;
          client_id?: string | null;
          company_id?: string;
          contract_id?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          due_date?: string | null;
          entry_type?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          source?: string | null;
          source_id?: string | null;
          source_ref?: string | null;
          status?: string;
          subtype?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      member_board_columns: {
        Row: {
          color: string;
          company_id: string;
          created_at: string;
          id: string;
          key: string;
          owner_user_id: string;
          position: number;
          title: string;
        };
        Insert: {
          color?: string;
          company_id: string;
          created_at?: string;
          id?: string;
          key: string;
          owner_user_id: string;
          position?: number;
          title: string;
        };
        Update: {
          color?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          key?: string;
          owner_user_id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          company_id: string;
          created_at: string;
          id: string;
          link: string | null;
          payload: Json;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          payload?: Json;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          payload?: Json;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      process_movements: {
        Row: {
          case_id: string;
          company_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          metadata: Json;
          movement_date: string;
          movement_type: string;
          source: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          company_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          metadata?: Json;
          movement_date?: string;
          movement_type?: string;
          source?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          metadata?: Json;
          movement_date?: string;
          movement_type?: string;
          source?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      production_card_checklist: {
        Row: {
          card_id: string;
          company_id: string;
          created_at: string;
          done: boolean;
          id: string;
          position: number;
          text: string;
        };
        Insert: {
          card_id: string;
          company_id: string;
          created_at?: string;
          done?: boolean;
          id?: string;
          position?: number;
          text: string;
        };
        Update: {
          card_id?: string;
          company_id?: string;
          created_at?: string;
          done?: boolean;
          id?: string;
          position?: number;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_card_checklist_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "production_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      production_card_comments: {
        Row: {
          author_id: string;
          card_id: string;
          company_id: string;
          content: string;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          card_id: string;
          company_id: string;
          content: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          card_id?: string;
          company_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_card_comments_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "production_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      production_card_events: {
        Row: {
          actor_id: string;
          card_id: string;
          company_id: string;
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
        };
        Insert: {
          actor_id: string;
          card_id: string;
          company_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          payload?: Json;
        };
        Update: {
          actor_id?: string;
          card_id?: string;
          company_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "production_card_events_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "production_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      production_card_watchers: {
        Row: {
          card_id: string;
          company_id: string;
          created_at: string;
          id: string;
          profile_id: string;
        };
        Insert: {
          card_id: string;
          company_id: string;
          created_at?: string;
          id?: string;
          profile_id: string;
        };
        Update: {
          card_id?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_card_watchers_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "production_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      production_cards: {
        Row: {
          assignee_id: string;
          board_id: string | null;
          case_id: string | null;
          category: string | null;
          client_id: string | null;
          client_name_snapshot: string | null;
          column_key: string;
          company_id: string;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          demand_type: string | null;
          department: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          legal_phase: string;
          legal_phase_changed_at: string;
          observations: string | null;
          operational_status: string;
          operational_status_changed_at: string;
          position: number;
          practice_area: string | null;
          priority: string;
          process_number: string | null;
          questionnaire: Json;
          sla_hours: number | null;
          started_at: string | null;
          status_flags: Json;
          title: string;
          triagem_id: string | null;
          updated_at: string;
        };
        Insert: {
          assignee_id: string;
          board_id?: string | null;
          case_id?: string | null;
          category?: string | null;
          client_id?: string | null;
          client_name_snapshot?: string | null;
          column_key?: string;
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          demand_type?: string | null;
          department?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          legal_phase?: string;
          legal_phase_changed_at?: string;
          observations?: string | null;
          operational_status?: string;
          operational_status_changed_at?: string;
          position?: number;
          practice_area?: string | null;
          priority?: string;
          process_number?: string | null;
          questionnaire?: Json;
          sla_hours?: number | null;
          started_at?: string | null;
          status_flags?: Json;
          title: string;
          triagem_id?: string | null;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string;
          board_id?: string | null;
          case_id?: string | null;
          category?: string | null;
          client_id?: string | null;
          client_name_snapshot?: string | null;
          column_key?: string;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          demand_type?: string | null;
          department?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          legal_phase?: string;
          legal_phase_changed_at?: string;
          observations?: string | null;
          operational_status?: string;
          operational_status_changed_at?: string;
          position?: number;
          practice_area?: string | null;
          priority?: string;
          process_number?: string | null;
          questionnaire?: Json;
          sla_hours?: number | null;
          started_at?: string | null;
          status_flags?: Json;
          title?: string;
          triagem_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_cards_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active_company_id: string | null;
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          oab_number: string | null;
          oab_state: string | null;
          updated_at: string;
        };
        Insert: {
          active_company_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          oab_number?: string | null;
          oab_state?: string | null;
          updated_at?: string;
        };
        Update: {
          active_company_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          oab_number?: string | null;
          oab_state?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_active_company_id_fkey";
            columns: ["active_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      publication_comments: {
        Row: {
          author_id: string;
          company_id: string;
          content: string;
          created_at: string;
          id: string;
          publication_id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          company_id: string;
          content: string;
          created_at?: string;
          id?: string;
          publication_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          company_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          publication_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      publications: {
        Row: {
          ai_analysis: Json | null;
          assigned_to: string | null;
          availability_date: string | null;
          case_id: string | null;
          client_id: string | null;
          client_name: string | null;
          communication_type: string | null;
          company_id: string;
          content: string | null;
          court: string | null;
          court_branch: string | null;
          created_at: string;
          created_by: string;
          diary: string | null;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          lawyer_name: string | null;
          oab_number: string | null;
          oab_state: string | null;
          process_number: string | null;
          process_subject: string | null;
          publication_date: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          ai_analysis?: Json | null;
          assigned_to?: string | null;
          availability_date?: string | null;
          case_id?: string | null;
          client_id?: string | null;
          client_name?: string | null;
          communication_type?: string | null;
          company_id: string;
          content?: string | null;
          court?: string | null;
          court_branch?: string | null;
          created_at?: string;
          created_by: string;
          diary?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          lawyer_name?: string | null;
          oab_number?: string | null;
          oab_state?: string | null;
          process_number?: string | null;
          process_subject?: string | null;
          publication_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          ai_analysis?: Json | null;
          assigned_to?: string | null;
          availability_date?: string | null;
          case_id?: string | null;
          client_id?: string | null;
          client_name?: string | null;
          communication_type?: string | null;
          company_id?: string;
          content?: string | null;
          court?: string | null;
          court_branch?: string | null;
          created_at?: string;
          created_by?: string;
          diary?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          lawyer_name?: string | null;
          oab_number?: string | null;
          oab_state?: string | null;
          process_number?: string | null;
          process_subject?: string | null;
          publication_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          closed_at: string | null;
          company_id: string;
          created_at: string;
          id: string;
          message: string;
          priority: string;
          responded_at: string | null;
          responded_by: string | null;
          response: string | null;
          status: string;
          subject: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          closed_at?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          message: string;
          priority?: string;
          responded_at?: string | null;
          responded_by?: string | null;
          response?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          closed_at?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          message?: string;
          priority?: string;
          responded_at?: string | null;
          responded_by?: string | null;
          response?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          assigned_to: string | null;
          case_id: string | null;
          checklist: Json;
          client_id: string | null;
          company_id: string;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          due_date: string | null;
          id: string;
          position: number;
          priority: Database["public"]["Enums"]["task_priority"];
          status: Database["public"]["Enums"]["task_status"];
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          case_id?: string | null;
          checklist?: Json;
          client_id?: string | null;
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          position?: number;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          case_id?: string | null;
          checklist?: Json;
          client_id?: string | null;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          position?: number;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      triagem_credentials: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string | null;
          gov_password: string | null;
          inss_password: string | null;
          triagem_id: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          gov_password?: string | null;
          inss_password?: string | null;
          triagem_id: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          gov_password?: string | null;
          inss_password?: string | null;
          triagem_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "triagem_credentials_triagem_id_fkey";
            columns: ["triagem_id"];
            isOneToOne: true;
            referencedRelation: "triagens";
            referencedColumns: ["id"];
          },
        ];
      };
      triagens: {
        Row: {
          address: string | null;
          ai_classification: Json | null;
          assigned_to: string | null;
          benefit_type: string | null;
          city: string | null;
          client_id: string | null;
          company_id: string;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          converted_case_id: string | null;
          converted_card_id: string | null;
          converted_client_id: string | null;
          converted_contract_id: string | null;
          cpf: string | null;
          created_at: string;
          created_by: string;
          demand_type: string | null;
          document: string | null;
          finished_at: string | null;
          id: string;
          lawyer_notes: string | null;
          legal_analysis: string | null;
          notes: string | null;
          observations: string | null;
          origin: string | null;
          practice_area: string | null;
          priority: string;
          raw_description: string;
          recommended_action: string | null;
          scheduled_at: string | null;
          secretary_notes: string | null;
          started_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          ai_classification?: Json | null;
          assigned_to?: string | null;
          benefit_type?: string | null;
          city?: string | null;
          client_id?: string | null;
          company_id: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          converted_case_id?: string | null;
          converted_card_id?: string | null;
          converted_client_id?: string | null;
          converted_contract_id?: string | null;
          cpf?: string | null;
          created_at?: string;
          created_by: string;
          demand_type?: string | null;
          document?: string | null;
          finished_at?: string | null;
          id?: string;
          lawyer_notes?: string | null;
          legal_analysis?: string | null;
          notes?: string | null;
          observations?: string | null;
          origin?: string | null;
          practice_area?: string | null;
          priority?: string;
          raw_description: string;
          recommended_action?: string | null;
          scheduled_at?: string | null;
          secretary_notes?: string | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          ai_classification?: Json | null;
          assigned_to?: string | null;
          benefit_type?: string | null;
          city?: string | null;
          client_id?: string | null;
          company_id?: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          converted_case_id?: string | null;
          converted_card_id?: string | null;
          converted_client_id?: string | null;
          converted_contract_id?: string | null;
          cpf?: string | null;
          created_at?: string;
          created_by?: string;
          demand_type?: string | null;
          document?: string | null;
          finished_at?: string | null;
          id?: string;
          lawyer_notes?: string | null;
          legal_analysis?: string | null;
          notes?: string | null;
          observations?: string | null;
          origin?: string | null;
          practice_area?: string | null;
          priority?: string;
          raw_description?: string;
          recommended_action?: string | null;
          scheduled_at?: string | null;
          secretary_notes?: string | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_any_company_role: {
        Args: {
          _company_id: string;
          _roles: Database["public"]["Enums"]["app_role"][];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_company_role: {
        Args: {
          _company_id: string;
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_company_member: {
        Args: { _company_id: string; _user_id: string };
        Returns: boolean;
      };
      shares_company_with: {
        Args: { _a: string; _b: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "owner" | "admin" | "lawyer" | "assistant" | "viewer";
      atendimento_channel: "presencial" | "video" | "telefone" | "whatsapp" | "email";
      atendimento_status:
        | "agendado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "confirmado"
        | "em_atendimento"
        | "aguardando_retorno"
        | "nao_compareceu";
      case_status: "active" | "paused" | "archived" | "won" | "lost" | "settled";
      client_type: "individual" | "company";
      event_type: "hearing" | "meeting" | "deadline" | "other";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "todo" | "in_progress" | "done" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "lawyer", "assistant", "viewer"],
      atendimento_channel: ["presencial", "video", "telefone", "whatsapp", "email"],
      atendimento_status: [
        "agendado",
        "em_andamento",
        "concluido",
        "cancelado",
        "confirmado",
        "em_atendimento",
        "aguardando_retorno",
        "nao_compareceu",
      ],
      case_status: ["active", "paused", "archived", "won", "lost", "settled"],
      client_type: ["individual", "company"],
      event_type: ["hearing", "meeting", "deadline", "other"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
    },
  },
} as const;
