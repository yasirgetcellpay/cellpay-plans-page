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
          upstream_reason: string | null
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
          upstream_reason?: string | null
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
          upstream_reason?: string | null
          upstream_status?: number | null
        }
        Relationships: []
      }
      campaign_email_log: {
        Row: {
          campaign: string
          carrier_name: string | null
          carrier_slug: string | null
          created_at: string
          email_plain: string | null
          email_sha256: string
          error: string | null
          expected_next: string | null
          id: string
          lang: string | null
          last_order_at: string | null
          phone_h: string | null
          phone_last4: string | null
          pick_reason: string | null
          prefill_token: string | null
          resend_id: string | null
          sender_variant: string | null
          sent_at: string | null
          status: string
          subj_variant: string | null
          subject: string | null
          template: string | null
          unsub_token: string
        }
        Insert: {
          campaign: string
          carrier_name?: string | null
          carrier_slug?: string | null
          created_at?: string
          email_plain?: string | null
          email_sha256: string
          error?: string | null
          expected_next?: string | null
          id?: string
          lang?: string | null
          last_order_at?: string | null
          phone_h?: string | null
          phone_last4?: string | null
          pick_reason?: string | null
          prefill_token?: string | null
          resend_id?: string | null
          sender_variant?: string | null
          sent_at?: string | null
          status?: string
          subj_variant?: string | null
          subject?: string | null
          template?: string | null
          unsub_token?: string
        }
        Update: {
          campaign?: string
          carrier_name?: string | null
          carrier_slug?: string | null
          created_at?: string
          email_plain?: string | null
          email_sha256?: string
          error?: string | null
          expected_next?: string | null
          id?: string
          lang?: string | null
          last_order_at?: string | null
          phone_h?: string | null
          phone_last4?: string | null
          pick_reason?: string | null
          prefill_token?: string | null
          resend_id?: string | null
          sender_variant?: string | null
          sent_at?: string | null
          status?: string
          subj_variant?: string | null
          subject?: string | null
          template?: string | null
          unsub_token?: string
        }
        Relationships: []
      }
      carrier_assist_controls: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      carrier_assist_log: {
        Row: {
          created_at: string
          host: string | null
          id: number
          mode: string | null
          ph_h: string | null
          picked: string | null
          src: string | null
          suggested: string | null
        }
        Insert: {
          created_at?: string
          host?: string | null
          id?: number
          mode?: string | null
          ph_h?: string | null
          picked?: string | null
          src?: string | null
          suggested?: string | null
        }
        Update: {
          created_at?: string
          host?: string | null
          id?: number
          mode?: string | null
          ph_h?: string | null
          picked?: string | null
          src?: string | null
          suggested?: string | null
        }
        Relationships: []
      }
      carrier_assist_secret: {
        Row: {
          id: number
          k: string
        }
        Insert: {
          id?: number
          k: string
        }
        Update: {
          id?: number
          k?: string
        }
        Relationships: []
      }
      carrier_check_log: {
        Row: {
          carrier_slug: string | null
          checkout_session_id: string | null
          created_at: string
          host: string | null
          http_status: number | null
          id: number
          kind: string | null
          message: string | null
          ok: boolean | null
          phone: string | null
          phone_last4: string | null
        }
        Insert: {
          carrier_slug?: string | null
          checkout_session_id?: string | null
          created_at?: string
          host?: string | null
          http_status?: number | null
          id?: number
          kind?: string | null
          message?: string | null
          ok?: boolean | null
          phone?: string | null
          phone_last4?: string | null
        }
        Update: {
          carrier_slug?: string | null
          checkout_session_id?: string | null
          created_at?: string
          host?: string | null
          http_status?: number | null
          id?: number
          kind?: string | null
          message?: string | null
          ok?: boolean | null
          phone?: string | null
          phone_last4?: string | null
        }
        Relationships: []
      }
      carrier_history: {
        Row: {
          carrier_slug: string
          phone_hash: string
        }
        Insert: {
          carrier_slug: string
          phone_hash: string
        }
        Update: {
          carrier_slug?: string
          phone_hash?: string
        }
        Relationships: []
      }
      cellpay_raw_replies: {
        Row: {
          body: Json | null
          created_at: string | null
          endpoint: string | null
          http_status: number | null
          id: string
          payment_method: string | null
          raw_text: string | null
          transaction_log_id: string | null
        }
        Insert: {
          body?: Json | null
          created_at?: string | null
          endpoint?: string | null
          http_status?: number | null
          id?: string
          payment_method?: string | null
          raw_text?: string | null
          transaction_log_id?: string | null
        }
        Update: {
          body?: Json | null
          created_at?: string | null
          endpoint?: string | null
          http_status?: number | null
          id?: string
          payment_method?: string | null
          raw_text?: string | null
          transaction_log_id?: string | null
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
      checkout_funnel_events: {
        Row: {
          amount: number | null
          ap_available: boolean | null
          cap: boolean | null
          carrier: string | null
          checkout_session_id: string | null
          client_ts: string | null
          created_at: string
          decline_ab: string | null
          decline_action: string | null
          decline_buttons: string | null
          decline_method: string | null
          event: string
          fee: number | null
          gp_available: boolean | null
          host: string | null
          id: number
          klarna_approved: boolean | null
          klarna_categories: string | null
          klarna_category: string | null
          klarna_error: string | null
          klarna_field: string | null
          klarna_finalize_required: boolean | null
          klarna_load: string | null
          klarna_reason: string | null
          klarna_result: string | null
          klarna_show_form: boolean | null
          lang: string | null
          retry_action: string | null
          retry_cause: string | null
          retry_to_carrier: string | null
          screen: string | null
          session_id: string | null
          shown: boolean | null
          total: number | null
        }
        Insert: {
          amount?: number | null
          ap_available?: boolean | null
          cap?: boolean | null
          carrier?: string | null
          checkout_session_id?: string | null
          client_ts?: string | null
          created_at?: string
          decline_ab?: string | null
          decline_action?: string | null
          decline_buttons?: string | null
          decline_method?: string | null
          event: string
          fee?: number | null
          gp_available?: boolean | null
          host?: string | null
          id?: number
          klarna_approved?: boolean | null
          klarna_categories?: string | null
          klarna_category?: string | null
          klarna_error?: string | null
          klarna_field?: string | null
          klarna_finalize_required?: boolean | null
          klarna_load?: string | null
          klarna_reason?: string | null
          klarna_result?: string | null
          klarna_show_form?: boolean | null
          lang?: string | null
          retry_action?: string | null
          retry_cause?: string | null
          retry_to_carrier?: string | null
          screen?: string | null
          session_id?: string | null
          shown?: boolean | null
          total?: number | null
        }
        Update: {
          amount?: number | null
          ap_available?: boolean | null
          cap?: boolean | null
          carrier?: string | null
          checkout_session_id?: string | null
          client_ts?: string | null
          created_at?: string
          decline_ab?: string | null
          decline_action?: string | null
          decline_buttons?: string | null
          decline_method?: string | null
          event?: string
          fee?: number | null
          gp_available?: boolean | null
          host?: string | null
          id?: number
          klarna_approved?: boolean | null
          klarna_categories?: string | null
          klarna_category?: string | null
          klarna_error?: string | null
          klarna_field?: string | null
          klarna_finalize_required?: boolean | null
          klarna_load?: string | null
          klarna_reason?: string | null
          klarna_result?: string | null
          klarna_show_form?: boolean | null
          lang?: string | null
          retry_action?: string | null
          retry_cause?: string | null
          retry_to_carrier?: string | null
          screen?: string | null
          session_id?: string | null
          shown?: boolean | null
          total?: number | null
        }
        Relationships: []
      }
      checkout_guard_controls: {
        Row: {
          key: string
          note: string | null
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          note?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          note?: string | null
          updated_at?: string
          value?: string
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
      email_prefill_tokens: {
        Row: {
          amount: number | null
          campaign: string | null
          carrier_slug: string
          created_at: string
          expires_at: string
          last_used_at: string | null
          log_id: string | null
          phone: string
          token: string
          used_count: number
        }
        Insert: {
          amount?: number | null
          campaign?: string | null
          carrier_slug: string
          created_at?: string
          expires_at?: string
          last_used_at?: string | null
          log_id?: string | null
          phone: string
          token?: string
          used_count?: number
        }
        Update: {
          amount?: number | null
          campaign?: string | null
          carrier_slug?: string
          created_at?: string
          expires_at?: string
          last_used_at?: string | null
          log_id?: string | null
          phone?: string
          token?: string
          used_count?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          amount: number | null
          carrier_slug: string | null
          charge_date: string | null
          charge_date_source: string | null
          created_at: string
          cycle_key: string
          email_sha256: string | null
          error: string | null
          holdout: boolean | null
          id: string
          kind: string
          lang: string | null
          last_refill_at: string | null
          mode: string
          optin_id: string | null
          order_id: string | null
          phone_last4: string | null
          provider: string | null
          provider_ref: string | null
          sent_at: string | null
          skip_reason: string | null
          status: string
          token_expires_at: string | null
          token_hash: string | null
          token_used_at: string | null
          touch: string
        }
        Insert: {
          amount?: number | null
          carrier_slug?: string | null
          charge_date?: string | null
          charge_date_source?: string | null
          created_at?: string
          cycle_key: string
          email_sha256?: string | null
          error?: string | null
          holdout?: boolean | null
          id?: string
          kind: string
          lang?: string | null
          last_refill_at?: string | null
          mode: string
          optin_id?: string | null
          order_id?: string | null
          phone_last4?: string | null
          provider?: string | null
          provider_ref?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status: string
          token_expires_at?: string | null
          token_hash?: string | null
          token_used_at?: string | null
          touch: string
        }
        Update: {
          amount?: number | null
          carrier_slug?: string | null
          charge_date?: string | null
          charge_date_source?: string | null
          created_at?: string
          cycle_key?: string
          email_sha256?: string | null
          error?: string | null
          holdout?: boolean | null
          id?: string
          kind?: string
          lang?: string | null
          last_refill_at?: string | null
          mode?: string
          optin_id?: string | null
          order_id?: string | null
          phone_last4?: string | null
          provider?: string | null
          provider_ref?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          token_expires_at?: string | null
          token_hash?: string | null
          token_used_at?: string | null
          touch?: string
        }
        Relationships: []
      }
      email_suppression: {
        Row: {
          created_at: string
          email_sha256: string
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email_sha256: string
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email_sha256?: string
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      failpay_email_controls: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      failpay_email_log: {
        Row: {
          amount: number | null
          asof: string
          attempt_at: string | null
          attempt_log_id: string | null
          carrier_slug: string | null
          created_at: string
          decision: string
          decline_class: string | null
          email_masked: string | null
          email_sha256: string | null
          error: string | null
          host: string | null
          id: string
          lang: string | null
          mode: string
          payment_method: string | null
          phone_h: string | null
          phone_last4: string | null
          provider: string | null
          provider_ref: string | null
          reason_code: string | null
          reasons: string[]
          refill_url: string | null
          run_id: string
          run_kind: string
          sent_at: string | null
          unsub_token: string
        }
        Insert: {
          amount?: number | null
          asof: string
          attempt_at?: string | null
          attempt_log_id?: string | null
          carrier_slug?: string | null
          created_at?: string
          decision: string
          decline_class?: string | null
          email_masked?: string | null
          email_sha256?: string | null
          error?: string | null
          host?: string | null
          id?: string
          lang?: string | null
          mode: string
          payment_method?: string | null
          phone_h?: string | null
          phone_last4?: string | null
          provider?: string | null
          provider_ref?: string | null
          reason_code?: string | null
          reasons?: string[]
          refill_url?: string | null
          run_id?: string
          run_kind?: string
          sent_at?: string | null
          unsub_token?: string
        }
        Update: {
          amount?: number | null
          asof?: string
          attempt_at?: string | null
          attempt_log_id?: string | null
          carrier_slug?: string | null
          created_at?: string
          decision?: string
          decline_class?: string | null
          email_masked?: string | null
          email_sha256?: string | null
          error?: string | null
          host?: string | null
          id?: string
          lang?: string | null
          mode?: string
          payment_method?: string | null
          phone_h?: string | null
          phone_last4?: string | null
          provider?: string | null
          provider_ref?: string | null
          reason_code?: string | null
          reasons?: string[]
          refill_url?: string | null
          run_id?: string
          run_kind?: string
          sent_at?: string | null
          unsub_token?: string
        }
        Relationships: []
      }
      failpay_ip_deny: {
        Row: {
          added_at: string
          added_by: string | null
          cidr: unknown
          kind: string
          note: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          cidr: unknown
          kind: string
          note?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          cidr?: unknown
          kind?: string
          note?: string | null
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
      fraud_link_log: {
        Row: {
          action: string
          created_at: string
          distinct_ids: number | null
          id: number
          linked_type: string | null
          linked_value: string | null
          mode: string | null
          source_id: string | null
          source_type: string | null
          source_value: string | null
          via_tx: string | null
        }
        Insert: {
          action: string
          created_at?: string
          distinct_ids?: number | null
          id?: number
          linked_type?: string | null
          linked_value?: string | null
          mode?: string | null
          source_id?: string | null
          source_type?: string | null
          source_value?: string | null
          via_tx?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          distinct_ids?: number | null
          id?: number
          linked_type?: string | null
          linked_value?: string | null
          mode?: string | null
          source_id?: string | null
          source_type?: string | null
          source_value?: string | null
          via_tx?: string | null
        }
        Relationships: []
      }
      fraud_link_queue: {
        Row: {
          block_id: string
          done_at: string | null
          enqueued_at: string
          err: string | null
          linked: number | null
        }
        Insert: {
          block_id: string
          done_at?: string | null
          enqueued_at?: string
          err?: string | null
          linked?: number | null
        }
        Update: {
          block_id?: string
          done_at?: string | null
          enqueued_at?: string
          err?: string | null
          linked?: number | null
        }
        Relationships: []
      }
      fraud_seed_log: {
        Row: {
          action: string
          created_at: string
          id: number
          key_type: string
          masked: string
          reason: string | null
          run_id: number | null
          source: string
          value_norm: string
          why: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          key_type: string
          masked: string
          reason?: string | null
          run_id?: number | null
          source: string
          value_norm: string
          why?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          key_type?: string
          masked?: string
          reason?: string | null
          run_id?: number | null
          source?: string
          value_norm?: string
          why?: string | null
        }
        Relationships: []
      }
      fraud_watch_alerts: {
        Row: {
          asof: string
          created_at: string
          detail: Json
          id: number
          kind: string
          label: string | null
          line: string | null
          relayed_at: string | null
          run_id: number
        }
        Insert: {
          asof: string
          created_at?: string
          detail?: Json
          id?: number
          kind: string
          label?: string | null
          line?: string | null
          relayed_at?: string | null
          run_id: number
        }
        Update: {
          asof?: string
          created_at?: string
          detail?: Json
          id?: number
          kind?: string
          label?: string | null
          line?: string | null
          relayed_at?: string | null
          run_id?: number
        }
        Relationships: []
      }
      fraud_watch_config: {
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
      fraud_watch_lists: {
        Row: {
          added_at: string
          list: string
          note: string | null
          value: string
        }
        Insert: {
          added_at?: string
          list: string
          note?: string | null
          value: string
        }
        Update: {
          added_at?: string
          list?: string
          note?: string | null
          value?: string
        }
        Relationships: []
      }
      fraud_watch_reported: {
        Row: {
          data: Json
          key: string
          updated_at: string
        }
        Insert: {
          data: Json
          key: string
          updated_at?: string
        }
        Update: {
          data?: Json
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      fraud_watch_runs: {
        Row: {
          alerts: number | null
          backlog_min: number | null
          chunks: number | null
          error: string | null
          finished_at: string | null
          first_asof: string | null
          held: number | null
          id: number
          job: string
          last_asof: string | null
          ok: boolean | null
          seeded: number | null
          started_at: string
          summary: Json
          undone: number | null
        }
        Insert: {
          alerts?: number | null
          backlog_min?: number | null
          chunks?: number | null
          error?: string | null
          finished_at?: string | null
          first_asof?: string | null
          held?: number | null
          id?: number
          job: string
          last_asof?: string | null
          ok?: boolean | null
          seeded?: number | null
          started_at?: string
          summary?: Json
          undone?: number | null
        }
        Update: {
          alerts?: number | null
          backlog_min?: number | null
          chunks?: number | null
          error?: string | null
          finished_at?: string | null
          first_asof?: string | null
          held?: number | null
          id?: number
          job?: string
          last_asof?: string | null
          ok?: boolean | null
          seeded?: number | null
          started_at?: string
          summary?: Json
          undone?: number | null
        }
        Relationships: []
      }
      fraud_watch_state: {
        Row: {
          fp_last_at: string | null
          id: number
          updated_at: string
          wm_asof: string | null
        }
        Insert: {
          fp_last_at?: string | null
          id?: number
          updated_at?: string
          wm_asof?: string | null
        }
        Update: {
          fp_last_at?: string | null
          id?: number
          updated_at?: string
          wm_asof?: string | null
        }
        Relationships: []
      }
      fraud_xsite_ids: {
        Row: {
          checked_at: string | null
          key_type: string
          source: string
          synced_at: string
          value: string
        }
        Insert: {
          checked_at?: string | null
          key_type: string
          source?: string
          synced_at?: string
          value: string
        }
        Update: {
          checked_at?: string | null
          key_type?: string
          source?: string
          synced_at?: string
          value?: string
        }
        Relationships: []
      }
      gpay_autopay_controls: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      gpay_autopay_rl: {
        Row: {
          email_h: string | null
          id: number
          ip_h: string | null
          ip_src: string
          phone_h: string | null
          stage: string
          ts: string
        }
        Insert: {
          email_h?: string | null
          id?: never
          ip_h?: string | null
          ip_src: string
          phone_h?: string | null
          stage: string
          ts?: string
        }
        Update: {
          email_h?: string | null
          id?: never
          ip_h?: string | null
          ip_src?: string
          phone_h?: string | null
          stage?: string
          ts?: string
        }
        Relationships: []
      }
      gpay_autopay_salt: {
        Row: {
          id: number
          salt: string
        }
        Insert: {
          id?: number
          salt: string
        }
        Update: {
          id?: number
          salt?: string
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
      ip_asn_ranges: {
        Row: {
          as_name: string | null
          asn: number | null
          country: string | null
          range_end: unknown
          range_start: unknown
        }
        Insert: {
          as_name?: string | null
          asn?: number | null
          country?: string | null
          range_end: unknown
          range_start: unknown
        }
        Update: {
          as_name?: string | null
          asn?: number | null
          country?: string | null
          range_end?: unknown
          range_start?: unknown
        }
        Relationships: []
      }
      ip_hosting_asns: {
        Row: {
          asn: number
          name: string | null
        }
        Insert: {
          asn: number
          name?: string | null
        }
        Update: {
          asn?: number
          name?: string | null
        }
        Relationships: []
      }
      mf_link_live_1012: {
        Row: {
          linked_type: string | null
          linked_value: string | null
          source_id: string | null
          source_type: string | null
          via_tx: string | null
        }
        Insert: {
          linked_type?: string | null
          linked_value?: string | null
          source_id?: string | null
          source_type?: string | null
          via_tx?: string | null
        }
        Update: {
          linked_type?: string | null
          linked_value?: string | null
          source_id?: string | null
          source_type?: string | null
          via_tx?: string | null
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
      paypal_funnel_events: {
        Row: {
          created_at: string
          detail: string | null
          event: string
          host: string | null
          id: number
          lang: string | null
          sess: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event: string
          host?: string | null
          id?: number
          lang?: string | null
          sess: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          event?: string
          host?: string | null
          id?: number
          lang?: string | null
          sess?: string
        }
        Relationships: []
      }
      plaid_v2_refs: {
        Row: {
          bind_h: string
          created_at: string
          expires_at: string
          ref_h: string
        }
        Insert: {
          bind_h: string
          created_at?: string
          expires_at: string
          ref_h: string
        }
        Update: {
          bind_h?: string
          created_at?: string
          expires_at?: string
          ref_h?: string
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
      purchase_fallback_excluded: {
        Row: {
          transaction_id: string
        }
        Insert: {
          transaction_id: string
        }
        Update: {
          transaction_id?: string
        }
        Relationships: []
      }
      purchase_fallback_items: {
        Row: {
          carrier_slug: string
          item_name: string
          margin: number
          plan_id: string
        }
        Insert: {
          carrier_slug: string
          item_name: string
          margin: number
          plan_id: string
        }
        Update: {
          carrier_slug?: string
          item_name?: string
          margin?: number
          plan_id?: string
        }
        Relationships: []
      }
      purchase_fallback_queue: {
        Row: {
          ads_value: number
          amount: number
          conv_time: string
          created_at: string
          first_served_at: string | null
          gclid: string | null
          item_name: string
          note: string | null
          status: string
          total: number
          transaction_id: string
        }
        Insert: {
          ads_value: number
          amount: number
          conv_time: string
          created_at?: string
          first_served_at?: string | null
          gclid?: string | null
          item_name: string
          note?: string | null
          status: string
          total: number
          transaction_id: string
        }
        Update: {
          ads_value?: number
          amount?: number
          conv_time?: string
          created_at?: string
          first_served_at?: string | null
          gclid?: string | null
          item_name?: string
          note?: string | null
          status?: string
          total?: number
          transaction_id?: string
        }
        Relationships: []
      }
      purchase_tag_fires: {
        Row: {
          created_at: string
          hashid: string | null
          source: string
          transaction_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          hashid?: string | null
          source?: string
          transaction_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          hashid?: string | null
          source?: string
          transaction_id?: string
          value?: number | null
        }
        Relationships: []
      }
      purchase_tag_guard_config: {
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
      receipt_assets: {
        Row: {
          b64: string
          mime: string
          name: string
          updated_at: string | null
        }
        Insert: {
          b64: string
          mime: string
          name: string
          updated_at?: string | null
        }
        Update: {
          b64?: string
          mime?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      receipt_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      receipt_sends: {
        Row: {
          attempts: number
          created_at: string | null
          error: string | null
          lang: string | null
          mandrill_id: string | null
          mode: string
          recipient_kind: string | null
          status: string
          transaction_id: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string | null
          error?: string | null
          lang?: string | null
          mandrill_id?: string | null
          mode: string
          recipient_kind?: string | null
          status?: string
          transaction_id: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string | null
          error?: string | null
          lang?: string | null
          mandrill_id?: string | null
          mode?: string
          recipient_kind?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      receipt_test_claims: {
        Row: {
          category: string
          claimed_at: string | null
          transaction_id: string | null
        }
        Insert: {
          category: string
          claimed_at?: string | null
          transaction_id?: string | null
        }
        Update: {
          category?: string
          claimed_at?: string | null
          transaction_id?: string | null
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
      reminder_consent_texts: {
        Row: {
          consent_text: string
          created_at: string
          lang: string
          version: string
        }
        Insert: {
          consent_text: string
          created_at?: string
          lang: string
          version: string
        }
        Update: {
          consent_text?: string
          created_at?: string
          lang?: string
          version?: string
        }
        Relationships: []
      }
      reminder_optins: {
        Row: {
          amount: number | null
          carrier: string | null
          carrier_slug: string | null
          consent_at: string
          consent_text: string
          consent_version: string
          created_at: string
          email: string
          email_sha256: string
          hashid: string | null
          holdout: boolean
          host: string | null
          id: string
          ip_hash: string | null
          lang: string
          order_id: string | null
          phone: string
          source: string
          token: string
          unsubscribe_source: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          carrier?: string | null
          carrier_slug?: string | null
          consent_at: string
          consent_text: string
          consent_version: string
          created_at?: string
          email: string
          email_sha256: string
          hashid?: string | null
          holdout?: boolean
          host?: string | null
          id?: string
          ip_hash?: string | null
          lang: string
          order_id?: string | null
          phone: string
          source: string
          token?: string
          unsubscribe_source?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          carrier?: string | null
          carrier_slug?: string | null
          consent_at?: string
          consent_text?: string
          consent_version?: string
          created_at?: string
          email?: string
          email_sha256?: string
          hashid?: string | null
          holdout?: boolean
          host?: string | null
          id?: string
          ip_hash?: string | null
          lang?: string
          order_id?: string | null
          phone?: string
          source?: string
          token?: string
          unsubscribe_source?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      retention_email_settings: {
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
      risk_decisions: {
        Row: {
          action: string | null
          amount: number | null
          checkout_session_id: string | null
          created_at: string | null
          err: string | null
          id: number
          ip_asn: number | null
          ip_country: string | null
          ip_country_hdr: string | null
          ip_datacenter: boolean | null
          ip_src: string | null
          latency_ms: number | null
          linked_block: Json | null
          mode: string | null
          payment_method: string | null
          phone_last4: string | null
          reasons: Json | null
          score: number | null
          timed_out: boolean | null
          transaction_log_id: string | null
        }
        Insert: {
          action?: string | null
          amount?: number | null
          checkout_session_id?: string | null
          created_at?: string | null
          err?: string | null
          id?: number
          ip_asn?: number | null
          ip_country?: string | null
          ip_country_hdr?: string | null
          ip_datacenter?: boolean | null
          ip_src?: string | null
          latency_ms?: number | null
          linked_block?: Json | null
          mode?: string | null
          payment_method?: string | null
          phone_last4?: string | null
          reasons?: Json | null
          score?: number | null
          timed_out?: boolean | null
          transaction_log_id?: string | null
        }
        Update: {
          action?: string | null
          amount?: number | null
          checkout_session_id?: string | null
          created_at?: string | null
          err?: string | null
          id?: number
          ip_asn?: number | null
          ip_country?: string | null
          ip_country_hdr?: string | null
          ip_datacenter?: boolean | null
          ip_src?: string | null
          latency_ms?: number | null
          linked_block?: Json | null
          mode?: string | null
          payment_method?: string | null
          phone_last4?: string | null
          reasons?: Json | null
          score?: number | null
          timed_out?: boolean | null
          transaction_log_id?: string | null
        }
        Relationships: []
      }
      risk_rules: {
        Row: {
          cap: number | null
          key: string
          note: string | null
          updated_at: string | null
          weight: number
        }
        Insert: {
          cap?: number | null
          key: string
          note?: string | null
          updated_at?: string | null
          weight: number
        }
        Update: {
          cap?: number | null
          key?: string
          note?: string | null
          updated_at?: string | null
          weight?: number
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
      transaction_card_facts: {
        Row: {
          billing_country: string | null
          billing_zip: string | null
          card_bin: string | null
          card_bin8: string | null
          card_brand: string | null
          card_funding: string | null
          card_last4: string | null
          cellpay_hashid: string | null
          cellpay_transaction_id: string | null
          created_at: string
          decline_message: string | null
          facts_version: number
          outcome: string | null
          payment_method: string | null
          processor_txn_id: string | null
          transaction_log_id: string
        }
        Insert: {
          billing_country?: string | null
          billing_zip?: string | null
          card_bin?: string | null
          card_bin8?: string | null
          card_brand?: string | null
          card_funding?: string | null
          card_last4?: string | null
          cellpay_hashid?: string | null
          cellpay_transaction_id?: string | null
          created_at?: string
          decline_message?: string | null
          facts_version?: number
          outcome?: string | null
          payment_method?: string | null
          processor_txn_id?: string | null
          transaction_log_id: string
        }
        Update: {
          billing_country?: string | null
          billing_zip?: string | null
          card_bin?: string | null
          card_bin8?: string | null
          card_brand?: string | null
          card_funding?: string | null
          card_last4?: string | null
          cellpay_hashid?: string | null
          cellpay_transaction_id?: string | null
          created_at?: string
          decline_message?: string | null
          facts_version?: number
          outcome?: string | null
          payment_method?: string | null
          processor_txn_id?: string | null
          transaction_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_card_facts_transaction_log_id_fkey"
            columns: ["transaction_log_id"]
            isOneToOne: true
            referencedRelation: "fraud_ip_risk"
            referencedColumns: ["tx"]
          },
          {
            foreignKeyName: "transaction_card_facts_transaction_log_id_fkey"
            columns: ["transaction_log_id"]
            isOneToOne: true
            referencedRelation: "order_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_card_facts_transaction_log_id_fkey"
            columns: ["transaction_log_id"]
            isOneToOne: true
            referencedRelation: "transaction_logs"
            referencedColumns: ["id"]
          },
        ]
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
          gbraid: string | null
          gclid: string | null
          hashid: string | null
          id: string
          last_name: string | null
          load_text: string | null
          marketing_opt_in: boolean | null
          marketing_opt_in_at: string | null
          metadata: Json | null
          payment_method: string | null
          phone_number: string | null
          plan_id: string | null
          raw_response: Json | null
          refund_amount: number | null
          refund_confirmed_at: string | null
          refund_reason: string | null
          refund_source: string | null
          refunded_at: string | null
          source_ip: string | null
          status: string
          total: number | null
          transaction_id: string | null
          user_agent: string | null
          wbraid: string | null
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
          gbraid?: string | null
          gclid?: string | null
          hashid?: string | null
          id?: string
          last_name?: string | null
          load_text?: string | null
          marketing_opt_in?: boolean | null
          marketing_opt_in_at?: string | null
          metadata?: Json | null
          payment_method?: string | null
          phone_number?: string | null
          plan_id?: string | null
          raw_response?: Json | null
          refund_amount?: number | null
          refund_confirmed_at?: string | null
          refund_reason?: string | null
          refund_source?: string | null
          refunded_at?: string | null
          source_ip?: string | null
          status?: string
          total?: number | null
          transaction_id?: string | null
          user_agent?: string | null
          wbraid?: string | null
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
          gbraid?: string | null
          gclid?: string | null
          hashid?: string | null
          id?: string
          last_name?: string | null
          load_text?: string | null
          marketing_opt_in?: boolean | null
          marketing_opt_in_at?: string | null
          metadata?: Json | null
          payment_method?: string | null
          phone_number?: string | null
          plan_id?: string | null
          raw_response?: Json | null
          refund_amount?: number | null
          refund_confirmed_at?: string | null
          refund_reason?: string | null
          refund_source?: string | null
          refunded_at?: string | null
          source_ip?: string | null
          status?: string
          total?: number | null
          transaction_id?: string | null
          user_agent?: string | null
          wbraid?: string | null
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
      velocity_shadow_keys: {
        Row: {
          created_at: string
          email_l: string | null
          id: number
          log_id: string
          name_l: string | null
          phone: string | null
          visitor_h: string | null
        }
        Insert: {
          created_at?: string
          email_l?: string | null
          id?: number
          log_id: string
          name_l?: string | null
          phone?: string | null
          visitor_h?: string | null
        }
        Update: {
          created_at?: string
          email_l?: string | null
          id?: number
          log_id?: string
          name_l?: string | null
          phone?: string | null
          visitor_h?: string | null
        }
        Relationships: []
      }
      visit_sources: {
        Row: {
          created_at: string
          day: string
          host: string | null
          id: number
          landing_path: string
          referrer_host: string | null
          session_id: string
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          day?: string
          host?: string | null
          id?: never
          landing_path?: string
          referrer_host?: string | null
          session_id: string
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          day?: string
          host?: string | null
          id?: never
          landing_path?: string
          referrer_host?: string | null
          session_id?: string
          utm_medium?: string | null
          utm_source?: string | null
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
      email_campaign_funnel: {
        Row: {
          attempts: number | null
          autopay_orders: number | null
          campaign: string | null
          carrier_slug: string | null
          clicks_prefill: number | null
          decline_reasons: string | null
          declines: number | null
          last_used_at: string | null
          orders: number | null
          recipient_id: string | null
          resend_id: string | null
          sent_at: string | null
        }
        Relationships: []
      }
      fraud_ip_risk: {
        Row: {
          created_at: string | null
          ip_class: string | null
          source_ip: string | null
          tx: string | null
        }
        Insert: {
          created_at?: string | null
          ip_class?: never
          source_ip?: string | null
          tx?: string | null
        }
        Update: {
          created_at?: string | null
          ip_class?: never
          source_ip?: string | null
          tx?: string | null
        }
        Relationships: []
      }
      order_outcomes: {
        Row: {
          amount: number | null
          autopay_ticked: boolean | null
          carrier_slug: string | null
          created_at: string | null
          day_ct: string | null
          hashid: string | null
          host: string | null
          id: string | null
          load_text: string | null
          order_state: string | null
          payment_method: string | null
          plan_id: string | null
          refund_amount: number | null
          refund_confirmed_at: string | null
          refund_reason: string | null
          refund_source: string | null
          refunded_at: string | null
          status: string | null
          total: number | null
        }
        Insert: {
          amount?: number | null
          autopay_ticked?: never
          carrier_slug?: string | null
          created_at?: string | null
          day_ct?: never
          hashid?: string | null
          host?: never
          id?: string | null
          load_text?: string | null
          order_state?: never
          payment_method?: string | null
          plan_id?: string | null
          refund_amount?: number | null
          refund_confirmed_at?: string | null
          refund_reason?: string | null
          refund_source?: string | null
          refunded_at?: string | null
          status?: string | null
          total?: number | null
        }
        Update: {
          amount?: number | null
          autopay_ticked?: never
          carrier_slug?: string | null
          created_at?: string | null
          day_ct?: never
          hashid?: string | null
          host?: never
          id?: string | null
          load_text?: string | null
          order_state?: never
          payment_method?: string | null
          plan_id?: string | null
          refund_amount?: number | null
          refund_confirmed_at?: string | null
          refund_reason?: string | null
          refund_source?: string | null
          refunded_at?: string | null
          status?: string | null
          total?: number | null
        }
        Relationships: []
      }
      refunds_by_carrier_plan_daily: {
        Row: {
          autopay_ticked: number | null
          carrier_slug: string | null
          confirmed: number | null
          day_ct: string | null
          plan_id: string | null
          refund_source: string | null
          refunded_face_usd: number | null
          refunded_orders: number | null
          refunded_usd: number | null
        }
        Relationships: []
      }
      vz_guard_daily: {
        Row: {
          day: string | null
          vz_guard_rows: number | null
          vz_successes: number | null
          vz291945_auto_refunds: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      ad1_prune_page_visitors: {
        Args: { _archive?: boolean; _batch?: number; _days?: number }
        Returns: number
      }
      addr_norm: { Args: { _line: string; _zip: string }; Returns: string }
      ap1_alarm_sweep: { Args: never; Returns: number }
      ap1_owner_match: {
        Args: { _email: string; _last4: string; _phone: string }
        Returns: string
      }
      ap1_rate_limit_hit: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      ap1_reason_not_enrolled: { Args: { _reason: string }; Returns: boolean }
      ap1_retry_record: {
        Args: {
          _domain: string
          _kind: string
          _log_id: string
          _status: number
        }
        Returns: number
      }
      ap1_retry_record_v2: {
        Args: {
          _domain: string
          _kind: string
          _log_id: string
          _reason?: string
          _status: number
        }
        Returns: number
      }
      autopay_notice_plan: {
        Args: { _now?: string }
        Returns: {
          amount: number
          carrier_slug: string
          charge_date: string
          cycle_key: string
          email_sha256: string
          lang: string
          order_id: string
          phone_last4: string
          skip_reason: string
        }[]
      }
      autopay_notice_run: {
        Args: { _ignore_window?: boolean; _now?: string }
        Returns: {
          log_id: string
          skip_reason: string
          status: string
        }[]
      }
      blocklist_norm: { Args: { _raw: string; _type: string }; Returns: string }
      carrier_assist_hash: { Args: { _phone: string }; Returns: string }
      carrier_hint: {
        Args: {
          _host?: string
          _ip: string
          _phone: string
          _picked: string
          _sess: string
        }
        Returns: Json
      }
      carrier_hint_lookup: {
        Args: { _host?: string; _phone: string; _picked: string }
        Returns: Json
      }
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
      checkout_blocklist_check_mf: {
        Args: {
          _address: string
          _card: string
          _card_exp: string
          _devices: string[]
        }
        Returns: {
          blocked: boolean
          key_type: string
          reason: string
          value_norm: string
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
      cp_clean_first_name: { Args: { fn: string; ln: string }; Returns: string }
      dupcharge_check: {
        Args: { _amount: string; _phone: string; _session: string }
        Returns: Json
      }
      failpay_carrier_path: { Args: { _slug: string }; Returns: string }
      failpay_decline_class: {
        Args: { _method: string; _msg: string }
        Returns: string
      }
      failpay_email_run: {
        Args: {
          _from?: string
          _run_id?: string
          _run_kind?: string
          _to?: string
        }
        Returns: Json
      }
      failpay_inet: { Args: { _s: string }; Returns: unknown }
      failpay_phone_h: { Args: { _p: string }; Returns: string }
      failpay_screen: {
        Args: {
          _asof: string
          _log_id: string
          _mode?: string
          _run_id?: string
          _run_kind?: string
        }
        Returns: {
          decline_class: string
          email_sha256: string
          phone_h: string
          reasons: string[]
        }[]
      }
      failpay_send_check: { Args: { _log_id: string }; Returns: string[] }
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
      fraud_alarm_log: {
        Args: {
          _detail: Json
          _kind: string
          _ref: string
          _severity: string
          _text: string
        }
        Returns: number
      }
      fraud_control_get: { Args: { _key: string }; Returns: string }
      fraud_detect: {
        Args: { _asof: string; _out_since: string }
        Returns: Json[]
      }
      fraud_f0: { Args: { _x: number }; Returns: string }
      fraud_ib_fp_guard: {
        Args: { _mode: string; _run_id: number }
        Returns: Json
      }
      fraud_ib_norm: {
        Args: { _kind: string; _raw: string }
        Returns: Record<string, unknown>
      }
      fraud_ib_seed_alerts: {
        Args: { _alerts: Json; _asof: string; _mode: string; _run_id: number }
        Returns: Json
      }
      fraud_ib_seed_one: {
        Args: {
          _asof: string
          _count_in_run: number
          _evidence: string
          _kind: string
          _mode: string
          _raw: string
          _reason: string
          _run_id: number
          _src: string
        }
        Returns: Json
      }
      fraud_ib_xsite: {
        Args: { _mode: string; _run_id: number }
        Returns: Json
      }
      fraud_ids_of: {
        Args: { _txs: string[] }
        Returns: {
          kt: string
          kv: string
          tx: string
        }[]
      }
      fraud_is_cgnat: { Args: { _ip: string }; Returns: boolean }
      fraud_link_apply: { Args: { _block_id: string }; Returns: number }
      fraud_link_candidates: {
        Args: { _block_id: string }
        Returns: {
          action: string
          distinct_ids: number
          linked_type: string
          linked_value: string
          via_tx: string
        }[]
      }
      fraud_link_worker: { Args: { _max?: number }; Returns: number }
      fraud_mask_text: { Args: { _s: string }; Returns: string }
      fraud_near_copy_ratio: {
        Args: { _a: string; _b: string }
        Returns: number
      }
      fraud_num: { Args: { _v: Json }; Returns: number }
      fraud_py: { Args: { _v: Json }; Returns: string }
      fraud_seqmatch_blocks: {
        Args: {
          _a: string
          _b: string
          ahi: number
          alo: number
          bhi: number
          blo: number
        }
        Returns: number
      }
      fraud_split: { Args: { _s: string }; Returns: string[] }
      fraud_truthy: { Args: { _v: Json }; Returns: boolean }
      fraud_tx_identifiers: {
        Args: { _since?: string }
        Returns: {
          kt: string
          kv: string
          tx: string
        }[]
      }
      fraud_txs_for: { Args: { _kt: string; _kv: string }; Returns: string[] }
      fraud_watch_apply: {
        Args: {
          _all?: boolean
          _asof: string
          _dry?: boolean
          _prev_asof: string
          _rows: Json
          _t: string
        }
        Returns: Json
      }
      fraud_watch_heartbeat_check: { Args: never; Returns: Json }
      fraud_watch_review: { Args: { _since?: string }; Returns: Json }
      fraud_watch_run: {
        Args: { _dry?: boolean; _max_chunks?: number }
        Returns: Json
      }
      fraud_watch_sets: {
        Args: never
        Returns: {
          bad_emails: string[]
          blocked: string[]
          customers: string[]
          not_block: string[]
          watch: Json
        }[]
      }
      gpay_autopay_check: {
        Args: {
          _country?: string
          _email: string
          _first?: string
          _last?: string
          _phone: string
          _stage?: string
        }
        Returns: Json
      }
      gpay_autopay_check_server: {
        Args: {
          _country?: string
          _email: string
          _first?: string
          _last?: string
          _phone: string
        }
        Returns: Json
      }
      gpay_autopay_eval: {
        Args: {
          _blocklist: boolean
          _country: string
          _email: string
          _first: string
          _last: string
          _need_country: boolean
          _phone: string
        }
        Returns: string
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
      ip_enrich: {
        Args: { _ip: string }
        Returns: {
          asn: number
          cgnat: boolean
          country: string
          datacenter: boolean
        }[]
      }
      log_card_facts: { Args: { _data: Json }; Returns: undefined }
      log_paypal_funnel: {
        Args: {
          _detail?: string
          _event: string
          _host?: string
          _lang?: string
          _sess: string
        }
        Returns: undefined
      }
      log_purchase_fire: {
        Args: {
          _hashid?: string
          _source?: string
          _transaction_id: string
          _value?: number
        }
        Returns: undefined
      }
      log_transaction_attempt: { Args: { _data: Json }; Returns: string }
      mark_order_refunded: {
        Args: { _id: string; _reason: string; _source: string }
        Returns: boolean
      }
      ops_alarm_push_key_ok: { Args: { _k: string }; Returns: boolean }
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
      order_refund_state: { Args: { _hashid: string }; Returns: Json }
      order_refund_states: {
        Args: { _hashids: string[] }
        Returns: {
          hashid: string
          total: number
        }[]
      }
      ourside_retry_enabled: { Args: never; Returns: boolean }
      pay_by_bank_available: { Args: never; Returns: boolean }
      paypal_capture_context: {
        Args: { _log_id?: string; _order_id: string }
        Returns: Json
      }
      paypal_finalize_log: {
        Args: {
          _error_message: string
          _hashid: string
          _id: string
          _order_id: string
          _raw_response: Json
          _status: string
          _transaction_id: string
        }
        Returns: Json
      }
      paypal_mark_abandoned: { Args: never; Returns: number }
      plaid_v2_bind: {
        Args: { _bind_h: string; _ref_h: string; _ttl_s?: number }
        Returns: Json
      }
      plaid_v2_claim: {
        Args: { _bind_h: string; _ref_h: string }
        Returns: Json
      }
      pockyt_mark_abandoned: { Args: never; Returns: number }
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
      postpurchase_autopay_link: { Args: { p_hashid: string }; Returns: Json }
      purchase_fallback_claimed: {
        Args: { _transaction_id: string }
        Returns: boolean
      }
      purchase_fallback_csv: {
        Args: { _token: string }
        Returns: {
          conv_time: string
          gclid: string
          order_id: string
          value: number
        }[]
      }
      purchase_fallback_csv_token_ok: {
        Args: { _token: string }
        Returns: boolean
      }
      purchase_fallback_sweep: { Args: never; Returns: undefined }
      purchase_tag_cliff_sweep: { Args: never; Returns: number }
      receipt_secret: { Args: { p_name: string }; Returns: string }
      record_attempt_marketing_opt_in: {
        Args: { _browser_language?: string; _id: string }
        Returns: undefined
      }
      record_marketing_opt_in: {
        Args: {
          p_browser_language?: string
          p_hashid: string
          p_lang?: string
          p_opt_in: boolean
        }
        Returns: undefined
      }
      record_presence: {
        Args: { _path: string; _session_id: string; _user_agent: string }
        Returns: undefined
      }
      record_visit_source: {
        Args: {
          _host: string
          _landing_path: string
          _referrer_host: string
          _session_id: string
          _utm_medium: string
          _utm_source: string
        }
        Returns: undefined
      }
      refill_cooldown_check: { Args: { _key: string }; Returns: Json }
      refill_cooldown_mark: {
        Args: { _key: string; _seconds?: number }
        Returns: Json
      }
      refund_retry_gate: {
        Args: { p_action: string; p_carrier: string; p_phone: string }
        Returns: Json
      }
      reminder_optin_create: {
        Args: {
          _consent_version: string
          _email?: string
          _hashid: string
          _lang: string
          _source?: string
        }
        Returns: string
      }
      reminder_unsubscribe: {
        Args: { _source: string; _token: string }
        Returns: string
      }
      resolve_email_prefill: {
        Args: { p_slug: string; p_token: string }
        Returns: Json
      }
      retention_bucket: { Args: { _phone: string }; Returns: number }
      retention_email_cron_auth: { Args: { _token: string }; Returns: boolean }
      retention_email_hmac_key: { Args: never; Returns: string }
      retention_email_setting: {
        Args: { _default: string; _key: string }
        Returns: string
      }
      retention_is_fraud: {
        Args: { _email: string; _phone: string }
        Returns: boolean
      }
      retention_reminder_plan: {
        Args: { _now?: string }
        Returns: {
          amount: number
          carrier_slug: string
          cycle_key: string
          email_sha256: string
          holdout: boolean
          lang: string
          last_refill_at: string
          optin_id: string
          order_id: string
          phone_last4: string
          skip_reason: string
          touch: string
        }[]
      }
      retention_reminder_run: {
        Args: { _ignore_window?: boolean; _now?: string }
        Returns: {
          log_id: string
          skip_reason: string
          status: string
        }[]
      }
      risk_score_features: {
        Args: {
          _amount: number
          _device: string
          _email: string
          _ip: string
          _method: string
          _phone: string
        }
        Returns: Json
      }
      set_tx_load_text: {
        Args: { _id: string; _text: string }
        Returns: boolean
      }
      tx_log_meta_merge: {
        Args: { _id: string; _patch: Json }
        Returns: undefined
      }
      vel1_enforce_check: {
        Args: {
          _email: string
          _first: string
          _last: string
          _method: string
          _phone: string
        }
        Returns: Json
      }
      vel1_eval: {
        Args: {
          _at: string
          _email: string
          _exclude: string
          _first: string
          _last: string
          _phone: string
        }
        Returns: Json
      }
      vel1_is_bank_decline: { Args: { _m: string }; Returns: boolean }
      vel1_is_severe_decline: { Args: { _m: string }; Returns: boolean }
      velocity_shadow_record: {
        Args: {
          _email: string
          _first: string
          _last: string
          _log_id: string
          _phone: string
          _visitor_h: string
        }
        Returns: Json
      }
      vz_prepaid_guard_check: { Args: { _phone: string }; Returns: Json }
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
