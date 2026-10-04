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
      checkout_guard_events: {
        Row: {
          amount: number | null
          card_h: string | null
          card_type: string | null
          carrier_slug: string | null
          created_at: string
          decision: string
          email_h: string | null
          id: string
          ip_class: string | null
          ip_h: string | null
          ip_src: string | null
          mode: string | null
          outcome: string
          payment_method: string | null
          phone_h: string | null
          reason: string | null
          sess_h: string | null
          turnstile: string | null
          visitor_h: string | null
        }
        Insert: {
          amount?: number | null
          card_h?: string | null
          card_type?: string | null
          carrier_slug?: string | null
          created_at?: string
          decision?: string
          email_h?: string | null
          id?: string
          ip_class?: string | null
          ip_h?: string | null
          ip_src?: string | null
          mode?: string | null
          outcome?: string
          payment_method?: string | null
          phone_h?: string | null
          reason?: string | null
          sess_h?: string | null
          turnstile?: string | null
          visitor_h?: string | null
        }
        Update: {
          amount?: number | null
          card_h?: string | null
          card_type?: string | null
          carrier_slug?: string | null
          created_at?: string
          decision?: string
          email_h?: string | null
          id?: string
          ip_class?: string | null
          ip_h?: string | null
          ip_src?: string | null
          mode?: string | null
          outcome?: string
          payment_method?: string | null
          phone_h?: string | null
          reason?: string | null
          sess_h?: string | null
          turnstile?: string | null
          visitor_h?: string | null
        }
        Relationships: []
      }
      checkout_guard_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      fraud_controls: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
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
      ops_alarms: {
        Row: {
          acked_at: string | null
          acked_by: string | null
          created_at: string
          detail: Json
          id: number
          kind: string
          notified_at: string | null
          notify_note: string | null
          notify_request_id: number | null
          ref: string
          severity: string
          source: string
        }
        Insert: {
          acked_at?: string | null
          acked_by?: string | null
          created_at?: string
          detail?: Json
          id?: never
          kind: string
          notified_at?: string | null
          notify_note?: string | null
          notify_request_id?: number | null
          ref: string
          severity?: string
          source: string
        }
        Update: {
          acked_at?: string | null
          acked_by?: string | null
          created_at?: string
          detail?: Json
          id?: never
          kind?: string
          notified_at?: string | null
          notify_note?: string | null
          notify_request_id?: number | null
          ref?: string
          severity?: string
          source?: string
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
      page_visitors_archive_20261003: {
        Row: {
          archived_at: string
          created_at: string
          last_seen: string
          path: string
          session_id: string
          user_agent: string | null
        }
        Insert: {
          archived_at?: string
          created_at: string
          last_seen: string
          path: string
          session_id: string
          user_agent?: string | null
        }
        Update: {
          archived_at?: string
          created_at?: string
          last_seen?: string
          path?: string
          session_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      pockyt_settlement_checks: {
        Row: {
          applied: boolean
          caller_host: string | null
          check_count: number
          first_checked_at: string | null
          last_checked_at: string | null
          last_error: string | null
          last_http: number | null
          last_ok_checked_at: string | null
          last_upstream: string | null
          log_created_at: string
          log_id: string
          mode: string
          next_check_at: string
          ok_check_count: number
          outcome: string | null
          outcome_at: string | null
          session_id: string
        }
        Insert: {
          applied?: boolean
          caller_host?: string | null
          check_count?: number
          first_checked_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_http?: number | null
          last_ok_checked_at?: string | null
          last_upstream?: string | null
          log_created_at: string
          log_id: string
          mode: string
          next_check_at?: string
          ok_check_count?: number
          outcome?: string | null
          outcome_at?: string | null
          session_id: string
        }
        Update: {
          applied?: boolean
          caller_host?: string | null
          check_count?: number
          first_checked_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_http?: number | null
          last_ok_checked_at?: string | null
          last_upstream?: string | null
          log_created_at?: string
          log_id?: string
          mode?: string
          next_check_at?: string
          ok_check_count?: number
          outcome?: string | null
          outcome_at?: string | null
          session_id?: string
        }
        Relationships: []
      }
      pockyt_sweep_runs: {
        Row: {
          auth_errors: number
          claimed: number
          expired: number
          failed: number
          finished_at: string
          http_errors: number
          id: number
          mode: string
          note: string | null
          paid: number
          started_at: string
          still_pending: number
        }
        Insert: {
          auth_errors?: number
          claimed?: number
          expired?: number
          failed?: number
          finished_at?: string
          http_errors?: number
          id?: number
          mode: string
          note?: string | null
          paid?: number
          started_at: string
          still_pending?: number
        }
        Update: {
          auth_errors?: number
          claimed?: number
          expired?: number
          failed?: number
          finished_at?: string
          http_errors?: number
          id?: number
          mode?: string
          note?: string | null
          paid?: number
          started_at?: string
          still_pending?: number
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
      refill_cooldown: {
        Row: {
          created_at: string
          expires_at: string
          hits: number
          key: string
          last_hit_at: string | null
          marks: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          hits?: number
          key: string
          last_hit_at?: string | null
          marks?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          hits?: number
          key?: string
          last_hit_at?: string | null
          marks?: number
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
      ap1_cancel_outcomes: {
        Row: {
          code: string | null
          confirmed_by_cellpay: boolean | null
          created_at: string | null
          event_id: number | null
          origin_host: string | null
          queue_row_id: number | null
        }
        Insert: {
          code?: string | null
          confirmed_by_cellpay?: never
          created_at?: string | null
          event_id?: number | null
          origin_host?: string | null
          queue_row_id?: never
        }
        Update: {
          code?: string | null
          confirmed_by_cellpay?: never
          created_at?: string | null
          event_id?: number | null
          origin_host?: string | null
          queue_row_id?: never
        }
        Relationships: []
      }
    }
    Functions: {
      ad1_prune_page_visitors: {
        Args: { _archive?: boolean; _batch?: number; _days?: number }
        Returns: number
      }
      ap1_alarm_sweep: { Args: never; Returns: number }
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
      checkout_guard_check: { Args: { _k: Json }; Returns: Json }
      checkout_guard_outcome: {
        Args: { _id: string; _outcome: string }
        Returns: boolean
      }
      finalize_pockyt_log: {
        Args: {
          _msg: string
          _pending_log_id: string
          _raw: Json
          _session_id: string
          _status: string
          _txn: string
        }
        Returns: boolean
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
      fraud_control_get: { Args: { _key: string }; Returns: string }
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
      ops_alarm_raise: {
        Args: {
          _detail: Json
          _kind: string
          _ref: string
          _severity: string
          _source: string
          _text: string
        }
        Returns: number
      }
      pockyt_sweep_claim: {
        Args: { _limit: number; _mode: string }
        Returns: {
          caller_host: string
          check_count: number
          log_created_at: string
          log_id: string
          session_id: string
        }[]
      }
      pockyt_sweep_expire: { Args: never; Returns: number }
      pockyt_sweep_finish_run: {
        Args: {
          _auth_errors: number
          _claimed: number
          _expired: number
          _failed: number
          _http_errors: number
          _mode: string
          _note: string
          _paid: number
          _started_at: string
          _still_pending: number
        }
        Returns: undefined
      }
      pockyt_sweep_record: {
        Args: {
          _http: number
          _log_id: string
          _msg: string
          _raw: Json
          _session_id: string
          _txn: string
          _upstream: string
          _verdict: string
        }
        Returns: string
      }
      pockyt_sweep_secret_ok: { Args: { _s: string }; Returns: boolean }
      record_presence: {
        Args: { _path: string; _session_id: string; _user_agent: string }
        Returns: undefined
      }
      refill_cooldown_check: { Args: { _key: string }; Returns: Json }
      refill_cooldown_mark: {
        Args: { _key: string; _seconds?: number }
        Returns: Json
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
