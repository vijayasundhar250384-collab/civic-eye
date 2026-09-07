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
      officers: {
        Row: {
          area: Database["public"]["Enums"]["area_type"]
          category: Database["public"]["Enums"]["issue_category"]
          contact: string | null
          created_at: string
          department: string
          designation: string
          escalation_authority: string
          id: string
          name: string
          ward: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["area_type"]
          category: Database["public"]["Enums"]["issue_category"]
          contact?: string | null
          created_at?: string
          department: string
          designation: string
          escalation_authority?: string
          id?: string
          name: string
          ward: string
        }
        Update: {
          area?: Database["public"]["Enums"]["area_type"]
          category?: Database["public"]["Enums"]["issue_category"]
          contact?: string | null
          created_at?: string
          department?: string
          designation?: string
          escalation_authority?: string
          id?: string
          name?: string
          ward?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          username: string
          ward: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          username: string
          ward?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          username?: string
          ward?: string | null
        }
        Relationships: []
      }
      report_events: {
        Row: {
          created_at: string
          detail: string
          id: string
          kind: string
          label: string
          report_id: string
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: string
          kind?: string
          label: string
          report_id: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          kind?: string
          label?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          address: string
          ai_authenticity: number
          ai_confidence: number
          ai_duplicate_risk: number
          ai_notes: string
          ai_verified: boolean
          area: Database["public"]["Enums"]["area_type"]
          category: Database["public"]["Enums"]["issue_category"]
          created_at: string
          description: string
          escalated: boolean
          escalated_at: string | null
          escalation_note: string | null
          id: string
          latitude: number
          longitude: number
          officer_id: string | null
          photo_url: string
          resolved_at: string | null
          resolved_photo_url: string | null
          severity: string
          sla_hours: number
          status: Database["public"]["Enums"]["report_status"]
          user_id: string
        }
        Insert: {
          address?: string
          ai_authenticity?: number
          ai_confidence?: number
          ai_duplicate_risk?: number
          ai_notes?: string
          ai_verified?: boolean
          area?: Database["public"]["Enums"]["area_type"]
          category: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          description?: string
          escalated?: boolean
          escalated_at?: string | null
          escalation_note?: string | null
          id?: string
          latitude: number
          longitude: number
          officer_id?: string | null
          photo_url: string
          resolved_at?: string | null
          resolved_photo_url?: string | null
          severity?: string
          sla_hours?: number
          status?: Database["public"]["Enums"]["report_status"]
          user_id: string
        }
        Update: {
          address?: string
          ai_authenticity?: number
          ai_confidence?: number
          ai_duplicate_risk?: number
          ai_notes?: string
          ai_verified?: boolean
          area?: Database["public"]["Enums"]["area_type"]
          category?: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          description?: string
          escalated?: boolean
          escalated_at?: string | null
          escalation_note?: string | null
          id?: string
          latitude?: number
          longitude?: number
          officer_id?: string | null
          photo_url?: string
          resolved_at?: string | null
          resolved_photo_url?: string | null
          severity?: string
          sla_hours?: number
          status?: Database["public"]["Enums"]["report_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "citizen" | "officer" | "admin"
      area_type: "urban" | "rural"
      issue_category:
        | "pothole"
        | "drainage"
        | "streetlight"
        | "garbage"
        | "water_supply"
        | "road_damage"
        | "other"
      report_status:
        | "submitted"
        | "verified"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "rejected"
        | "escalated"
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
      app_role: ["citizen", "officer", "admin"],
      area_type: ["urban", "rural"],
      issue_category: [
        "pothole",
        "drainage",
        "streetlight",
        "garbage",
        "water_supply",
        "road_damage",
        "other",
      ],
      report_status: [
        "submitted",
        "verified",
        "assigned",
        "in_progress",
        "resolved",
        "rejected",
        "escalated",
      ],
    },
  },
} as const
