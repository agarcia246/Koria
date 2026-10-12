export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          decision_note: string | null
          email: string
          id: string
          invite_code: string | null
          note: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["access_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          decision_note?: string | null
          email: string
          id?: string
          invite_code?: string | null
          note?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["access_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          decision_note?: string | null
          email?: string
          id?: string
          invite_code?: string | null
          note?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["access_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft: {
        Row: {
          baggage_cu_ft: number | null
          cabin_notes: string | null
          created_at: string
          golf: boolean
          home_base_id: string | null
          id: string
          interior_configuration: string | null
          is_active: boolean
          lavatory: boolean
          model_id: string
          operator_id: string
          pet_policy: string | null
          pets: boolean
          pricing_mode_default: Database["public"]["Enums"]["pricing_mode"]
          seating: number
          skis: boolean
          tail_number: string
          updated_at: string
          wifi: boolean
          year: number | null
        }
        Insert: {
          baggage_cu_ft?: number | null
          cabin_notes?: string | null
          created_at?: string
          golf?: boolean
          home_base_id?: string | null
          id?: string
          interior_configuration?: string | null
          is_active?: boolean
          lavatory?: boolean
          model_id: string
          operator_id: string
          pet_policy?: string | null
          pets?: boolean
          pricing_mode_default?: Database["public"]["Enums"]["pricing_mode"]
          seating: number
          skis?: boolean
          tail_number: string
          updated_at?: string
          wifi?: boolean
          year?: number | null
        }
        Update: {
          baggage_cu_ft?: number | null
          cabin_notes?: string | null
          created_at?: string
          golf?: boolean
          home_base_id?: string | null
          id?: string
          interior_configuration?: string | null
          is_active?: boolean
          lavatory?: boolean
          model_id?: string
          operator_id?: string
          pet_policy?: string | null
          pets?: boolean
          pricing_mode_default?: Database["public"]["Enums"]["pricing_mode"]
          seating?: number
          skis?: boolean
          tail_number?: string
          updated_at?: string
          wifi?: boolean
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_home_base_id_fkey"
            columns: ["home_base_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "aircraft_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_availability: {
        Row: {
          aircraft_id: string
          based_at_id: string | null
          created_at: string
          ends_at: string
          id: string
          import_batch_id: string | null
          kind: Database["public"]["Enums"]["availability_kind"]
          notes: string | null
          source: Database["public"]["Enums"]["availability_source"]
          starts_at: string
          updated_at: string
        }
        Insert: {
          aircraft_id: string
          based_at_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          import_batch_id?: string | null
          kind: Database["public"]["Enums"]["availability_kind"]
          notes?: string | null
          source?: Database["public"]["Enums"]["availability_source"]
          starts_at: string
          updated_at?: string
        }
        Update: {
          aircraft_id?: string
          based_at_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          import_batch_id?: string | null
          kind?: Database["public"]["Enums"]["availability_kind"]
          notes?: string | null
          source?: Database["public"]["Enums"]["availability_source"]
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_availability_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_availability_based_at_id_fkey"
            columns: ["based_at_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_models: {
        Row: {
          baggage_cu_ft: number | null
          cabin_height_ft: number | null
          cabin_length_ft: number | null
          cabin_width_ft: number | null
          category: Database["public"]["Enums"]["aircraft_category"]
          created_at: string
          cruise_speed_ktas: number
          id: string
          manufacturer: string
          max_pax: number
          name: string
          range_nm: number
          typical_pax: number
          updated_at: string
        }
        Insert: {
          baggage_cu_ft?: number | null
          cabin_height_ft?: number | null
          cabin_length_ft?: number | null
          cabin_width_ft?: number | null
          category: Database["public"]["Enums"]["aircraft_category"]
          created_at?: string
          cruise_speed_ktas: number
          id?: string
          manufacturer: string
          max_pax: number
          name: string
          range_nm: number
          typical_pax: number
          updated_at?: string
        }
        Update: {
          baggage_cu_ft?: number | null
          cabin_height_ft?: number | null
          cabin_length_ft?: number | null
          cabin_width_ft?: number | null
          category?: Database["public"]["Enums"]["aircraft_category"]
          created_at?: string
          cruise_speed_ktas?: number
          id?: string
          manufacturer?: string
          max_pax?: number
          name?: string
          range_nm?: number
          typical_pax?: number
          updated_at?: string
        }
        Relationships: []
      }
      aircraft_photos: {
        Row: {
          aircraft_id: string
          caption: string | null
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          aircraft_id: string
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          aircraft_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_photos_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_pricing_rules: {
        Row: {
          aircraft_id: string
          created_at: string
          hourly_rate: number | null
          id: string
          minimum: number | null
          mode: Database["public"]["Enums"]["pricing_mode"]
          per_nm: number | null
          positioning_fee: number | null
          updated_at: string
        }
        Insert: {
          aircraft_id: string
          created_at?: string
          hourly_rate?: number | null
          id?: string
          minimum?: number | null
          mode?: Database["public"]["Enums"]["pricing_mode"]
          per_nm?: number | null
          positioning_fee?: number | null
          updated_at?: string
        }
        Update: {
          aircraft_id?: string
          created_at?: string
          hourly_rate?: number | null
          id?: string
          minimum?: number | null
          mode?: Database["public"]["Enums"]["pricing_mode"]
          per_nm?: number | null
          positioning_fee?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_pricing_rules_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      airports: {
        Row: {
          city: string
          country: string
          created_at: string
          fbo_name: string | null
          iata: string | null
          icao: string
          id: string
          latitude: number
          location: unknown
          longitude: number
          name: string
          region: string | null
          runway_length_ft: number | null
          time_zone: string | null
          updated_at: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          fbo_name?: string | null
          iata?: string | null
          icao: string
          id?: string
          latitude: number
          longitude: number
          name: string
          region?: string | null
          runway_length_ft?: number | null
          time_zone?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          fbo_name?: string | null
          iata?: string | null
          icao?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          region?: string | null
          runway_length_ft?: number | null
          time_zone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          broker_role_disclosure: string | null
          certificate_number: string | null
          created_at: string
          currency: string
          customer_total: number
          estimated_block_minutes: number | null
          fbo: string | null
          id: string
          operating_carrier_dba: string | null
          operating_carrier_legal_name: string | null
          operator_amount: number
          platform_fee_amount: number
          quote_id: string
          status: Database["public"]["Enums"]["booking_status"]
          taxes_amount: number
          trip_request_id: string
          updated_at: string
        }
        Insert: {
          broker_role_disclosure?: string | null
          certificate_number?: string | null
          created_at?: string
          currency?: string
          customer_total: number
          estimated_block_minutes?: number | null
          fbo?: string | null
          id?: string
          operating_carrier_dba?: string | null
          operating_carrier_legal_name?: string | null
          operator_amount: number
          platform_fee_amount?: number
          quote_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          taxes_amount?: number
          trip_request_id: string
          updated_at?: string
        }
        Update: {
          broker_role_disclosure?: string | null
          certificate_number?: string | null
          created_at?: string
          currency?: string
          customer_total?: number
          estimated_block_minutes?: number | null
          fbo?: string | null
          id?: string
          operating_carrier_dba?: string | null
          operating_carrier_legal_name?: string | null
          operator_amount?: number
          platform_fee_amount?: number
          quote_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          taxes_amount?: number
          trip_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_request_id_fkey"
            columns: ["trip_request_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      empty_legs: {
        Row: {
          aircraft_id: string
          created_at: string
          depart_at: string
          destination_id: string
          id: string
          notes: string | null
          operator_id: string
          origin_id: string
          price: number | null
          pricing_mode: Database["public"]["Enums"]["pricing_mode"]
          seats_available: number | null
          status: Database["public"]["Enums"]["empty_leg_status"]
          updated_at: string
          whole_aircraft: boolean
        }
        Insert: {
          aircraft_id: string
          created_at?: string
          depart_at: string
          destination_id: string
          id?: string
          notes?: string | null
          operator_id: string
          origin_id: string
          price?: number | null
          pricing_mode?: Database["public"]["Enums"]["pricing_mode"]
          seats_available?: number | null
          status?: Database["public"]["Enums"]["empty_leg_status"]
          updated_at?: string
          whole_aircraft?: boolean
        }
        Update: {
          aircraft_id?: string
          created_at?: string
          depart_at?: string
          destination_id?: string
          id?: string
          notes?: string | null
          operator_id?: string
          origin_id?: string
          price?: number | null
          pricing_mode?: Database["public"]["Enums"]["pricing_mode"]
          seats_available?: number | null
          status?: Database["public"]["Enums"]["empty_leg_status"]
          updated_at?: string
          whole_aircraft?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "empty_legs_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empty_legs_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empty_legs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empty_legs_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          event: string | null
          id: string
          profile_id: string | null
          read_at: string | null
          title: string | null
          trip_request_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event?: string | null
          id?: string
          profile_id?: string | null
          read_at?: string | null
          title?: string | null
          trip_request_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event?: string | null
          id?: string
          profile_id?: string | null
          read_at?: string | null
          title?: string | null
          trip_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_trip_request_id_fkey"
            columns: ["trip_request_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_members: {
        Row: {
          created_at: string
          id: string
          operator_id: string
          profile_id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operator_id: string
          profile_id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operator_id?: string
          profile_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_members_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          certificate_number: string
          certificate_type: string
          city: string | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          dba: string | null
          default_fee_bps: number | null
          home_airport_id: string | null
          id: string
          legal_name: string
          name: string
          operational_control_disclosure: string | null
          updated_at: string
        }
        Insert: {
          certificate_number: string
          certificate_type?: string
          city?: string | null
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          dba?: string | null
          default_fee_bps?: number | null
          home_airport_id?: string | null
          id?: string
          legal_name: string
          name: string
          operational_control_disclosure?: string | null
          updated_at?: string
        }
        Update: {
          certificate_number?: string
          certificate_type?: string
          city?: string | null
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          dba?: string | null
          default_fee_bps?: number | null
          home_airport_id?: string | null
          id?: string
          legal_name?: string
          name?: string
          operational_control_disclosure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operators_home_airport_id_fkey"
            columns: ["home_airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_profiles: {
        Row: {
          created_at: string
          customer_id: string
          date_of_birth: string | null
          full_name: string
          id: string
          updated_at: string
          weight_lb: number | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          updated_at?: string
          weight_lb?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          weight_lb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "passenger_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_stamps: {
        Row: {
          created_at: string
          customer_id: string
          detail: string | null
          id: string
          is_earned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          detail?: string | null
          id?: string
          is_earned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          detail?: string | null
          id?: string
          is_earned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_stamps_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          booking_id: string | null
          created_at: string
          currency: string | null
          id: string
          provider: string | null
          provider_ref: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number | null
          booking_id: string | null
          created_at: string
          currency: string | null
          id: string
          operator_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          operator_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          operator_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fee_rules: {
        Row: {
          booking_id: string | null
          bps: number | null
          created_at: string
          effective_from: string
          effective_to: string | null
          fixed_amount: number | null
          id: string
          operator_id: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          bps?: number | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          fixed_amount?: number | null
          id?: string
          operator_id?: string | null
          scope: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          bps?: number | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          fixed_amount?: number | null
          id?: string
          operator_id?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_fee_rules_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fee_rules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          aircraft_preferences: string | null
          created_at: string
          customer_id: string
          home_airport_id: string | null
          id: string
          pets: boolean
          ski_golf: boolean
          typical_passengers: number | null
          updated_at: string
          wifi_preferred: boolean
        }
        Insert: {
          aircraft_preferences?: string | null
          created_at?: string
          customer_id: string
          home_airport_id?: string | null
          id?: string
          pets?: boolean
          ski_golf?: boolean
          typical_passengers?: number | null
          updated_at?: string
          wifi_preferred?: boolean
        }
        Update: {
          aircraft_preferences?: string | null
          created_at?: string
          customer_id?: string
          home_airport_id?: string | null
          id?: string
          pets?: boolean
          ski_golf?: boolean
          typical_passengers?: number | null
          updated_at?: string
          wifi_preferred?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_home_airport_id_fkey"
            columns: ["home_airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_status: Database["public"]["Enums"]["access_status"]
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          access_status?: Database["public"]["Enums"]["access_status"]
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          access_status?: Database["public"]["Enums"]["access_status"]
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          aircraft_id: string
          carrier_disclosure_snapshot: Json | null
          created_at: string
          currency: string
          customer_total: number
          id: string
          notes: string | null
          operator_amount: number
          operator_id: string
          parent_quote_id: string | null
          platform_fee_amount: number
          pricing_mode: Database["public"]["Enums"]["pricing_mode"]
          status: Database["public"]["Enums"]["quote_status"]
          taxes_amount: number
          trip_request_id: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          aircraft_id: string
          carrier_disclosure_snapshot?: Json | null
          created_at?: string
          currency?: string
          customer_total: number
          id?: string
          notes?: string | null
          operator_amount: number
          operator_id: string
          parent_quote_id?: string | null
          platform_fee_amount?: number
          pricing_mode?: Database["public"]["Enums"]["pricing_mode"]
          status?: Database["public"]["Enums"]["quote_status"]
          taxes_amount?: number
          trip_request_id: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          aircraft_id?: string
          carrier_disclosure_snapshot?: Json | null
          created_at?: string
          currency?: string
          customer_total?: number
          id?: string
          notes?: string | null
          operator_amount?: number
          operator_id?: string
          parent_quote_id?: string | null
          platform_fee_amount?: number
          pricing_mode?: Database["public"]["Enums"]["pricing_mode"]
          status?: Database["public"]["Enums"]["quote_status"]
          taxes_amount?: number
          trip_request_id?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_trip_request_id_fkey"
            columns: ["trip_request_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      route_watches: {
        Row: {
          created_at: string
          customer_id: string | null
          destination_id: string | null
          id: string
          origin_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          destination_id?: string | null
          id?: string
          origin_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          destination_id?: string | null
          id?: string
          origin_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_watches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_watches_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_watches_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          query: Json
          result_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          query?: Json
          result_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          query?: Json
          result_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "searches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_documents: {
        Row: {
          created_at: string
          id: string
          storage_path: string | null
          title: string | null
          trip_request_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_path?: string | null
          title?: string | null
          trip_request_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_path?: string | null
          title?: string | null
          trip_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_documents_trip_request_id_fkey"
            columns: ["trip_request_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string | null
          role: string | null
          trip_request_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id?: string | null
          role?: string | null
          trip_request_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string | null
          role?: string | null
          trip_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_trip_request_id_fkey"
            columns: ["trip_request_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_request_operators: {
        Row: {
          created_at: string
          decline_reason: string | null
          operator_id: string
          status: Database["public"]["Enums"]["trip_request_operator_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          operator_id: string
          status?: Database["public"]["Enums"]["trip_request_operator_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          operator_id?: string
          status?: Database["public"]["Enums"]["trip_request_operator_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_request_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_request_operators_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_requests: {
        Row: {
          aircraft_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          depart_at: string
          destination_id: string
          empty_leg_id: string | null
          fbo: string | null
          flexible_days: number
          id: string
          nearby_airports: boolean
          notes: string | null
          origin_id: string
          passengers: number
          prefs: Json
          return_at: string | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          aircraft_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id: string
          depart_at: string
          destination_id: string
          empty_leg_id?: string | null
          fbo?: string | null
          flexible_days?: number
          id?: string
          nearby_airports?: boolean
          notes?: string | null
          origin_id: string
          passengers?: number
          prefs?: Json
          return_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          aircraft_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string
          depart_at?: string
          destination_id?: string
          empty_leg_id?: string | null
          fbo?: string | null
          flexible_days?: number
          id?: string
          nearby_airports?: boolean
          notes?: string | null
          origin_id?: string
          passengers?: number
          prefs?: Json
          return_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_empty_leg_id_fkey"
            columns: ["empty_leg_id"]
            isOneToOne: false
            referencedRelation: "empty_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_trip_with_fanout: {
        Args: {
          p_aircraft_id: string | null
          p_customer_id: string
          p_depart_at: string
          p_destination_id: string
          p_empty_leg_id: string | null
          p_notes: string | null
          p_operator_ids: string[]
          p_origin_id: string
          p_passengers: number
          p_prefs: Json
          p_return_at: string | null
        }
        Returns: Database["public"]["Tables"]["trip_requests"]["Row"]
      }
      is_admin: { Args: never; Returns: boolean }
      operator_can_access_trip: { Args: { trip_id: string }; Returns: boolean }
      operator_ids: { Args: never; Returns: string[] }
      airports_within_nm: {
        Args: { p_lat: number; p_lng: number; p_nm: number }
        Returns: Database["public"]["Tables"]["airports"]["Row"][]
      }
      search_airports: {
        Args: { p_limit?: number; p_q: string }
        Returns: Database["public"]["Tables"]["airports"]["Row"][]
      }
    }
    Enums: {
      access_status: "requested" | "approved" | "declined" | "invited"
      aircraft_category:
        | "very_light"
        | "light"
        | "midsize"
        | "super_midsize"
        | "heavy"
        | "ultra_long_range"
      availability_kind: "available" | "blocked"
      availability_source: "manual" | "import" | "api"
      booking_status: "pending" | "confirmed" | "completed" | "cancelled"
      empty_leg_status: "published" | "withdrawn" | "booked"
      pricing_mode: "live" | "estimated" | "quote_required"
      quote_status:
        | "pending"
        | "accepted"
        | "declined"
        | "expired"
        | "countered"
      trip_request_operator_status: "pending" | "quoted" | "declined"
      trip_status:
        | "requested"
        | "quote_received"
        | "awaiting_payment"
        | "confirmed"
        | "upcoming"
        | "completed"
        | "cancelled"
        | "declined"
      user_role: "customer" | "operator" | "admin"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_status: ["requested", "approved", "declined", "invited"],
      aircraft_category: [
        "very_light",
        "light",
        "midsize",
        "super_midsize",
        "heavy",
        "ultra_long_range",
      ],
      availability_kind: ["available", "blocked"],
      booking_status: ["pending", "confirmed", "completed", "cancelled"],
      empty_leg_status: ["published", "withdrawn", "booked"],
      pricing_mode: ["live", "estimated", "quote_required"],
      quote_status: ["pending", "accepted", "declined", "expired", "countered"],
      trip_request_operator_status: ["pending", "quoted", "declined"],
      trip_status: [
        "requested",
        "quote_received",
        "awaiting_payment",
        "confirmed",
        "upcoming",
        "completed",
        "cancelled",
        "declined",
      ],
      user_role: ["customer", "operator", "admin"],
    },
  },
} as const

/** Convenience aliases used across portal + API code. */
export type UserRole = Enums<"user_role">
export type AccessStatus = Enums<"access_status">
export type PricingMode = Enums<"pricing_mode">
export type AvailabilityKind = Enums<"availability_kind">
export type TripStatus = Enums<"trip_status">
export type AircraftCategory = Enums<"aircraft_category">
export type BookingStatus = Enums<"booking_status">
export type QuoteStatus = Enums<"quote_status">
export type EmptyLegStatus = Enums<"empty_leg_status">

