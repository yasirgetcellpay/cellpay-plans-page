export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ap1_rate_limits: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start?: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      autopay_cancel_retry: {
        Row: {
          attempt_count: number
          cellpay_domain: string
          created_at: string
          failure_kind: string
          id: number
          last_attempt_at: string
          resolved_at: string | null
          status: string
          transaction_log_id: string
          upstream_status: number | null
        }
        Insert: {
          attempt_count?: number
          cellpay_domain: string
          created_at?: string
          failure_kind: string
          id?: never
          last_attempt_at?: string
          resolved_at?: string | null
          status?: string
          transaction_log_id: string
          upstream_status?: number | null
        }
        Update: {
          attempt_count?: number
          cellpay_domain?: string
          created_at?: string
          failure_kind?: string
          id?: never
          last_attempt_at?: string
          resolved_at?: string | null
          status?: string
          transaction_log_id?: string
          upstream_status?: number | null
        }
        Relationships: []
      }
      checkout_blocklist: {
        Row: {
          active: boolean
          added_by: string
          created_at: string
          expires_at: string | null
          hit_count: number
          id: string
          key_type: string
          last_hit_at: string | null
          note: string | null
          reason: string
          source: string
          value_norm: string
        }
        Insert: {
          active?: boolean
          added_by: string
          created_at?: string
          expires_at?: string | null
          hit_count?: number
          id?: string
          key_type: string
          last_hit_at?: string | null
          note?: string | null
          reason: string
          source: string
          value_norm: string
        }
        Update: {
          active?: boolean
          added_by?: string
          created_at?: string
          expires_at?: string | null
          hit_count?: number
          id?: string
          key_type?: string
          last_hit_at?: string | null
          note?: string | null
          reason?: string
          source?: string
          value_norm?: string
        }
        Relationships: []
      }
      checkout_dedupe: {
        Row: {
          created_at: string
          dup_count: number
          id: number
          key_h: string
          last_dup_at: string | null
          payment_method: string | null
          phone_norm: string | null
        }
        Insert: {
          created_at?: string
          dup_count?: number
          id?: never
          key_h: string
          last_dup_at?: string | null
          payment_method?: string | null
          phone_norm?: string | null
        }
        Update: {
          created_at?: string
          dup_count?: number
          id?: never
          key_h?: string
          last_dup_at?: string | null
          payment_method?: string | null
          phone_norm?: string | null
        }
        Relationships: []
      }
      help_events: {
        Row: {
          created_at: string
          fn: string
          id: number
          lang: string
          outcome: string
        }
        Insert: {
          created_at?: string
          fn: string
          id?: number
          lang?: string
          outcome: string
        }
        Update: {
          created_at?: string
          fn?: string
          id?: number
          lang?: string
          outcome?: string
        }
        Relationships: []
      }
      help_rate_limits: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      help_settings: {
        Row: {
          chat_enabled: boolean
          contact_enabled: boolean
          id: number
          status_enabled: boolean
          updated_at: string
        }
        Insert: {
          chat_enabled?: boolean
          contact_enabled?: boolean
          id: number
          status_enabled?: boolean
          updated_at?: string
        }
        Update: {
          chat_enabled?: boolean
          contact_enabled?: boolean
          id?: number
          status_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      page_visitors: {
        Row: {
          created_at: string
          last_seen: string
          path: string
          session_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          last_seen?: string
          path?: string
          session_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          last_seen?: string
          path?: string
          session_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      proxy_guard_events: {
        Row: {
          code: string
          created_at: string
          dropped_before: number
          endpoint_shape: string | null
          guard_version: string
          has_origin: boolean
          id: number
          method: string | null
          origin_host: string | null
        }
        Insert: {
          code: string
          created_at?: string
          dropped_before?: number
          endpoint_shape?: string | null
          guard_version: string
          has_origin?: boolean
          id?: never
          method?: string | null
          origin_host?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          dropped_before?: number
          endpoint_shape?: string | null
          guard_version?: string
          has_origin?: boolean
          id?: never
          method?: string | null
          origin_host?: string | null
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          category: string | null
          contact: string
          created_at: string
          id: string
          lang: string
          message: string
          name: string
          order_last4: string | null
          page_path: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          category?: string | null
          contact: string
          created_at?: string
          id?: string
          lang?: string
          message: string
          name: string
          order_last4?: string | null
          page_path?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          category?: string | null
          contact?: string
          created_at?: string
          id?: string
          lang?: string
          message?: string
          name?: string
          order_last4?: string | null
          page_path?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      transaction_logs: {
        Row: {
          amount: number | null
          card_type: string | null
          carrier_id: string | null
          carrier_name: string | null
          carrier_slug: string | null
          created_at: string
          email: string | null
          error_message: string | null
          first_name: string | null
          hashid: string | null
          id: string
          last_name: string | null
          metadata: Json | null
          payment_method: string | null
          phone_number: string | null
          plan_id: string | null
          raw_response: Json | null
          source_ip: string | null
          status: string
          total: number | null
          transaction_id: string | null
          user_agent: string | null
        }
        Insert: {
          amount?: number | null
          card_type?: string | null
          carrier_id?: string | null
          carrier_name?: string | null
          carrier_slug?: string | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          first_name?: string | null
          hashid?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          payment_method?: string | null
          phone_number?: string | null
          plan_id?: string | null
          raw_response?: Json | null
          source_ip?: string | null
          status?: string
          total?: number | null
          transaction_id?: string | null
          user_agent?: string | null
        }
        Update: {
          amount?: number | null
          card_type?: string | null
          carrier_id?: string | null
          carrier_name?: string | null
          carrier_slug?: string | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          first_name?: string | null
          hashid?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          payment_method?: string | null
          phone_number?: string | null
          plan_id?: string | null
          raw_response?: Json | null
          source_ip?: string | null
          status?: string
          total?: number | null
          transaction_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ap1_owner_match: {
        Args: { _email: string; _last4: string; _phone: string }
        Returns: string
      }
      ap1_rate_limit_hit: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      ap1_retry_record: {
        Args: {
          _domain: string
          _kind: string
          _log_id: string
          _status: number
        }
        Returns: number
      }
      blocklist_norm: { Args: { _raw: string; _type: string }; Returns: string }
      checkout_blocklist_check: {
        Args: {
          _card_h: string
          _email: string
          _phone: string
          _session: string
          _visitor: string
        }
        Returns: {
          blocked: boolean
          key_type: string
          reason: string
        }[]
      }
      checkout_dedupe_claim: {
        Args: {
          _key: string
          _method: string
          _phone: string
          _window_s?: number
        }
        Returns: Json
      }
      finalize_transaction_log: {
        Args: {
          _error_message: string
          _hashid: string
          _id: string
          _raw_response: Json
          _status: string
          _transaction_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      help_rate_limit_hit: {
        Args: { _bucket: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      log_transaction_attempt: { Args: { _data: Json }; Returns: string }
      record_presence: {
        Args: { _path: string; _session_id: string; _user_agent: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
