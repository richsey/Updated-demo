// Auto-generated Supabase types — matches actual schema in production.
// Run `supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts`
// to regenerate after schema changes.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "student" | "admin";
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: "student" | "admin";
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: "student" | "admin";
          created_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          difficulty: "beginner" | "intermediate" | "advanced";
          format: "video" | "article" | "interactive";
          duration_minutes: number;
          thumbnail: string;
          instructor: string;
          rating: number;
          enrolled_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          category: string;
          difficulty: "beginner" | "intermediate" | "advanced";
          format?: "video" | "article" | "interactive";
          duration_minutes?: number;
          thumbnail?: string;
          instructor: string;
          rating?: number;
          enrolled_count?: number;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          category?: string;
          difficulty?: "beginner" | "intermediate" | "advanced";
          format?: "video" | "article" | "interactive";
          duration_minutes?: number;
          thumbnail?: string;
          instructor?: string;
          rating?: number;
          enrolled_count?: number;
        };
      };
      materials: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          type: "video" | "tutorial" | "article" | "pdf";
          url: string;
          duration_minutes: number;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          type: "video" | "tutorial";
          url: string;
          duration_minutes?: number;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          title?: string;
          type?: "video" | "tutorial";
          url?: string;
          duration_minutes?: number;
          order_index?: number;
        };
      };
      quizzes: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          created_at?: string;
        };
        Update: {
          course_id?: string;
          title?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          quizzes_id: string;
          text: string;
          options: string[];
          correct_index: number;
          explanation: string;
          order_index: number;
        };
        Insert: {
          id?: string;
          quizzes_id: string;
          text: string;
          options: string[];
          correct_index: number;
          explanation: string;
          order_index?: number;
        };
        Update: {
          text?: string;
          options?: string[];
          correct_index?: number;
          explanation?: string;
          order_index?: number;
        };
      };
      quiz_attempts: {
        Row: {
          id: string;
          user_id: string;
          quiz_id: string;
          score: number;
          total_questions: number;
          duration_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          quiz_id: string;
          score: number;
          total_questions: number;
          duration_seconds?: number;
          created_at?: string;
        };
        Update: never;
      };
      student_progress: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          progress: number;
          last_accessed: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          progress?: number;
          last_accessed?: string;
          updated_at?: string;
        };
        Update: {
          progress?: number;
          last_accessed?: string;
          updated_at?: string;
        };
      };
      material_progress: {
        Row: {
          id: string;
          user_id: string;
          material_id: string;
          progress_pct: number;
          time_spent_seconds: number;
          completed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          progress_pct?: number;
          time_spent_seconds?: number;
          completed?: boolean;
          updated_at?: string;
        };
        Update: {
          progress_pct?: number;
          time_spent_seconds?: number;
          completed?: boolean;
          updated_at?: string;
        };
      };
      user_material_progress: {
        Row: {
          id: string;
          user_id: string;
          material_id: string;
          completed: boolean | null;
          completed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          completed?: boolean | null;
          completed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          completed?: boolean | null;
          completed_at?: string | null;
        };
      };
      user_course_progress: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          progress: number | null;
          completed_materials: number | null;
          total_materials: number | null;
          last_updated: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          progress?: number | null;
          completed_materials?: number | null;
          total_materials?: number | null;
          last_updated?: string | null;
        };
        Update: {
          progress?: number | null;
          completed_materials?: number | null;
          total_materials?: number | null;
          last_updated?: string | null;
        };
      };
      telemetry: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          entity_id: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          entity_id: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: never;
      };
      content: {
        Row: {
          id: string;
          title: string;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          category?: string;
        };
      };
      user_interactions: {
        Row: {
          id: string;
          user_id: string;
          content_id: string;
          action_type: string | null;
          rating: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content_id: string;
          action_type?: string | null;
          rating?: number | null;
          created_at?: string;
        };
        Update: {
          action_type?: string | null;
          rating?: number | null;
        };
      };
      recommendations: {
        Row: {
          id: string;
          user_id: string;
          content_id: string;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content_id: string;
          score: number;
          created_at?: string;
        };
        Update: {
          score?: number;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
