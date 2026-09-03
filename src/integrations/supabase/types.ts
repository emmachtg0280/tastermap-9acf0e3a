export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      cities: {
        Row: {
          created_at: string;
          default_zoom: number;
          id: string;
          key: string;
          label: string;
          lat: number;
          lng: number;
          radius: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_zoom?: number;
          id?: string;
          key: string;
          label: string;
          lat: number;
          lng: number;
          radius?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_zoom?: number;
          id?: string;
          key?: string;
          label?: string;
          lat?: number;
          lng?: number;
          radius?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      neighborhoods: {
        Row: {
          centroid_lat: number | null;
          centroid_lng: number | null;
          city_id: string;
          created_at: string;
          geometry: Json | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          centroid_lat?: number | null;
          centroid_lng?: number | null;
          city_id: string;
          created_at?: string;
          geometry?: Json | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          centroid_lat?: number | null;
          centroid_lng?: number | null;
          city_id?: string;
          created_at?: string;
          geometry?: Json | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "neighborhoods_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
        ];
      };
      place_signals: {
        Row: {
          computed_at: string;
          favorites_30d: number;
          hype_score: number;
          place_id: string;
          visits_30d: number;
        };
        Insert: {
          computed_at?: string;
          favorites_30d?: number;
          hype_score?: number;
          place_id: string;
          visits_30d?: number;
        };
        Update: {
          computed_at?: string;
          favorites_30d?: number;
          hype_score?: number;
          place_id?: string;
          visits_30d?: number;
        };
        Relationships: [
          {
            foreignKeyName: "place_signals_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: true;
            referencedRelation: "places";
            referencedColumns: ["place_id"];
          },
        ];
      };
      place_tags: {
        Row: {
          confidence: number;
          created_at: string;
          id: string;
          place_id: string;
          source: string;
          tag: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          id?: string;
          place_id: string;
          source?: string;
          tag: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          id?: string;
          place_id?: string;
          source?: string;
          tag?: string;
        };
        Relationships: [
          {
            foreignKeyName: "place_tags_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["place_id"];
          },
        ];
      };
      places: {
        Row: {
          city_id: string | null;
          created_at: string;
          first_seen_at: string;
          geo_cell: string | null;
          last_refreshed_at: string | null;
          neighborhood_id: string | null;
          place_id: string;
          replaced_by_place_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          city_id?: string | null;
          created_at?: string;
          first_seen_at?: string;
          geo_cell?: string | null;
          last_refreshed_at?: string | null;
          neighborhood_id?: string | null;
          place_id: string;
          replaced_by_place_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          city_id?: string | null;
          created_at?: string;
          first_seen_at?: string;
          geo_cell?: string | null;
          last_refreshed_at?: string | null;
          neighborhood_id?: string | null;
          place_id?: string;
          replaced_by_place_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "places_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "places_neighborhood_id_fkey";
            columns: ["neighborhood_id"];
            isOneToOne: false;
            referencedRelation: "neighborhoods";
            referencedColumns: ["id"];
          },
        ];
      };
      places_cache: {
        Row: {
          expires_at: string;
          fetched_at: string;
          payload: Json;
          place_id: string;
          rating_fetched_at: string | null;
        };
        Insert: {
          expires_at?: string;
          fetched_at?: string;
          payload: Json;
          place_id: string;
          rating_fetched_at?: string | null;
        };
        Update: {
          expires_at?: string;
          fetched_at?: string;
          payload?: Json;
          place_id?: string;
          rating_fetched_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "places_cache_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: true;
            referencedRelation: "places";
            referencedColumns: ["place_id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          home_city_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          home_city_id?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          home_city_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_home_city_id_fkey";
            columns: ["home_city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
        ];
      };
      user_places: {
        Row: {
          comment: string | null;
          created_at: string;
          favorite: boolean;
          id: string;
          personal_rating: number | null;
          place_id: string;
          saved: boolean;
          updated_at: string;
          user_id: string;
          visited: boolean;
          visited_at: string | null;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          favorite?: boolean;
          id?: string;
          personal_rating?: number | null;
          place_id: string;
          saved?: boolean;
          updated_at?: string;
          user_id: string;
          visited?: boolean;
          visited_at?: string | null;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          favorite?: boolean;
          id?: string;
          personal_rating?: number | null;
          place_id?: string;
          saved?: boolean;
          updated_at?: string;
          user_id?: string;
          visited?: boolean;
          visited_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
