// Типы схемы PostgreSQL, сгенерированные Supabase (generate_typescript_types).
// Не редактировать вручную: при изменении схемы перегенерировать
// `npx supabase gen types typescript --project-id xvkimvpcrfsspyntalmg > src/models/database.types.ts`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.17';
  };
  public: {
    Tables: {
      bids: {
        Row: {
          comment: string | null;
          created_at: string;
          driver_id: string;
          id: string;
          offered_price: number;
          order_id: string;
          status: Database['public']['Enums']['bid_status'];
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          driver_id: string;
          id?: string;
          offered_price: number;
          order_id: string;
          status?: Database['public']['Enums']['bid_status'];
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          driver_id?: string;
          id?: string;
          offered_price?: number;
          order_id?: string;
          status?: Database['public']['Enums']['bid_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'bids_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bids_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      disputes: {
        Row: {
          created_at: string;
          id: string;
          initiated_by: string;
          order_id: string;
          reason: string;
          resolution_comment: string | null;
          resolved_at: string | null;
          status: Database['public']['Enums']['dispute_status'];
        };
        Insert: {
          created_at?: string;
          id?: string;
          initiated_by: string;
          order_id: string;
          reason: string;
          resolution_comment?: string | null;
          resolved_at?: string | null;
          status?: Database['public']['Enums']['dispute_status'];
        };
        Update: {
          created_at?: string;
          id?: string;
          initiated_by?: string;
          order_id?: string;
          reason?: string;
          resolution_comment?: string | null;
          resolved_at?: string | null;
          status?: Database['public']['Enums']['dispute_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'disputes_initiated_by_fkey';
            columns: ['initiated_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'disputes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_photos: {
        Row: {
          id: string;
          order_id: string;
          photo_url: string;
          stage: Database['public']['Enums']['photo_stage'];
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          photo_url: string;
          stage: Database['public']['Enums']['photo_stage'];
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          photo_url?: string;
          stage?: Database['public']['Enums']['photo_stage'];
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_photos_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          cancel_reason: string | null;
          cargo_height: number;
          cargo_length: number;
          cargo_type: Database['public']['Enums']['cargo_type'];
          cargo_weight: number;
          cargo_width: number;
          client_id: string;
          created_at: string;
          description: string | null;
          destination_address: string;
          destination_lat: number | null;
          destination_lng: number | null;
          driver_id: string | null;
          id: string;
          is_escrow_locked: boolean;
          origin_address: string;
          origin_lat: number | null;
          origin_lng: number | null;
          price: number;
          status: Database['public']['Enums']['order_status'];
          updated_at: string;
        };
        Insert: {
          cancel_reason?: string | null;
          cargo_height: number;
          cargo_length: number;
          cargo_type?: Database['public']['Enums']['cargo_type'];
          cargo_weight: number;
          cargo_width: number;
          client_id: string;
          created_at?: string;
          description?: string | null;
          destination_address: string;
          destination_lat?: number | null;
          destination_lng?: number | null;
          driver_id?: string | null;
          id?: string;
          is_escrow_locked?: boolean;
          origin_address: string;
          origin_lat?: number | null;
          origin_lng?: number | null;
          price: number;
          status?: Database['public']['Enums']['order_status'];
          updated_at?: string;
        };
        Update: {
          cancel_reason?: string | null;
          cargo_height?: number;
          cargo_length?: number;
          cargo_type?: Database['public']['Enums']['cargo_type'];
          cargo_weight?: number;
          cargo_width?: number;
          client_id?: string;
          created_at?: string;
          description?: string | null;
          destination_address?: string;
          destination_lat?: number | null;
          destination_lng?: number | null;
          driver_id?: string | null;
          id?: string;
          is_escrow_locked?: boolean;
          origin_address?: string;
          origin_lat?: number | null;
          origin_lng?: number | null;
          price?: number;
          status?: Database['public']['Enums']['order_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          author_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          order_id: string;
          rating: number | null;
          target_id: string;
        };
        Insert: {
          author_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          order_id: string;
          rating?: number | null;
          target_id: string;
        };
        Update: {
          author_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          order_id?: string;
          rating?: number | null;
          target_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_target_id_fkey';
            columns: ['target_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          is_blocked: boolean;
          is_verified: boolean;
          phone: string | null;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
          verification_doc_url: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id?: string;
          is_blocked?: boolean;
          is_verified?: boolean;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
          verification_doc_url?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          is_blocked?: boolean;
          is_verified?: boolean;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
          verification_doc_url?: string | null;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          created_at: string;
          driver_id: string;
          height: number;
          id: string;
          length: number;
          max_weight: number;
          model: string | null;
          special_permits_url: string | null;
          updated_at: string;
          vehicle_type: Database['public']['Enums']['vehicle_type'];
          width: number;
        };
        Insert: {
          created_at?: string;
          driver_id: string;
          height: number;
          id?: string;
          length: number;
          max_weight: number;
          model?: string | null;
          special_permits_url?: string | null;
          updated_at?: string;
          vehicle_type?: Database['public']['Enums']['vehicle_type'];
          width: number;
        };
        Update: {
          created_at?: string;
          driver_id?: string;
          height?: number;
          id?: string;
          length?: number;
          max_weight?: number;
          model?: string | null;
          special_permits_url?: string | null;
          updated_at?: string;
          vehicle_type?: Database['public']['Enums']['vehicle_type'];
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_bid: {
        Args: { p_bid_id: string };
        Returns: {
          cancel_reason: string | null;
          cargo_height: number;
          cargo_length: number;
          cargo_type: Database['public']['Enums']['cargo_type'];
          cargo_weight: number;
          cargo_width: number;
          client_id: string;
          created_at: string;
          description: string | null;
          destination_address: string;
          destination_lat: number | null;
          destination_lng: number | null;
          driver_id: string | null;
          id: string;
          is_escrow_locked: boolean;
          origin_address: string;
          origin_lat: number | null;
          origin_lng: number | null;
          price: number;
          status: Database['public']['Enums']['order_status'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      guard_bypassed: { Args: never; Returns: boolean };
      has_bid_on: { Args: { p_order_id: string }; Returns: boolean };
      is_admin: { Args: never; Returns: boolean };
      is_order_client: { Args: { p_order_id: string }; Returns: boolean };
      is_order_driver: { Args: { p_order_id: string }; Returns: boolean };
      is_order_participant: { Args: { p_order_id: string }; Returns: boolean };
      my_role: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      shares_order_with: { Args: { p_user_id: string }; Returns: boolean };
    };
    Enums: {
      bid_status: 'Pending' | 'Accepted' | 'Rejected';
      cargo_type: 'Car' | 'Container' | 'Machinery' | 'Agricultural' | 'Equipment' | 'Other';
      dispute_status: 'Open' | 'Resolved_Client' | 'Resolved_Driver' | 'Closed';
      order_status:
        | 'Created'
        | 'Bidding'
        | 'Assigned'
        | 'Loading'
        | 'InTransit'
        | 'Unloading'
        | 'Completed'
        | 'Cancelled'
        | 'Disputed';
      photo_stage: 'Loading' | 'Unloading';
      user_role: 'Client' | 'Driver' | 'Admin';
      vehicle_type: 'Trawl' | 'Manipulator' | 'TowTruck' | 'Flatbed' | 'Other';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
