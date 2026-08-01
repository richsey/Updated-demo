import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  fetchProfile as fetchProfileFromDB,
  ensureProfileExists,
} from "@/lib/api/profiles";
import CacheManager from "@/lib/cache";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "student" | "lecturer" | "admin";
  avatar_url?: string | null;
  bio?: string | null;
  phone?: string | null;
  interests?: string[];
  learning_goals?: string | null;
  is_suspended?: boolean;
  created_at?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null; isNewUser?: boolean; profile?: Profile | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: Error | null; isNewUser?: boolean }>;
  // verifyEmailCode: (
  //   email: string,
  //   code: string,
  // ) => Promise<{ error: Error | null; isVerified?: boolean }>;
  signOut: () => Promise<void>;
  updateProfileCache: (updates: Partial<Profile>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileFetchRef = useRef<{ [key: string]: Promise<Profile | null> }>(
    {},
  );

  // Fetch profile with deduplication and advanced caching
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    // Deduplicate concurrent requests
    if (profileFetchRef.current[userId]) {
      return profileFetchRef.current[userId];
    }

    setProfileLoading(true);
    const fetchPromise = (async () => {
      try {
        console.log("[Auth] Fetching profile for:", userId);
        const profile = await fetchProfileFromDB(userId);
        if (profile) {
          setProfile(profile);
        }
        return profile;
      } catch (err) {
        console.error("[Auth] Error fetching profile:", err);
        return null;
      } finally {
        delete profileFetchRef.current[userId];
        setProfileLoading(false);
      }
    })();

    profileFetchRef.current[userId] = fetchPromise;
    return fetchPromise;
  };

  useEffect(() => {
    let mounted = true;

    // Emergency Loading Reset: never let the app stay stuck for more than 5s
    const emergencyReset = setTimeout(() => {
      if (mounted && loading) {
        console.warn("[Auth] Emergency loading reset triggered.");
        setLoading(false);
      }
    }, 5000);

    // Get initial session - FAST PATH
    console.log("[Auth] Initializing session...");
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        console.log(
          "[Auth] Session fetched:",
          session ? "Authenticated" : "Guest",
        );
        setSession(session);
        setUser(session?.user ?? null);

        if (mounted) {
          // Set loading to false immediately - don't wait for profile
          setLoading(false);
          clearTimeout(emergencyReset);
        }

        // Fetch profile in background WITHOUT blocking loading state
        if (session?.user) {
          fetchProfile(session.user.id).catch((err) => {
            console.error("[Auth] Background profile fetch failed:", err);
          });
        }
      })
      .catch((err) => {
        console.error("[Auth] Initial session error:", err);
        if (mounted) {
          setLoading(false);
          clearTimeout(emergencyReset);
        }
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log("[Auth] State changed:", event, session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);

      // Always set loading to false immediately
      setLoading(false);

      if (session?.user) {
        // Fetch profile in background
        fetchProfile(session.user.id).catch((err) => {
          console.error("[Auth] Background profile fetch failed:", err);
        });
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(emergencyReset);
    };
  }, []); // empty deps - ESLint warning fixed by proper structure

  const signIn = async (email: string, password: string) => {
    console.log("[Auth] Attempting sign in for:", email);
    const startTime = performance.now();

    // Clear any stale cached profile before signing in
    setProfile(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[Auth] Sign in error:", error.message);
      if (error.message.includes("Invalid login credentials")) {
        return { error: new Error("USER_NOT_FOUND"), isNewUser: true };
      }
      return { error: error as Error };
    }

    console.log(
      "[Auth] Sign in successful in",
      performance.now() - startTime,
      "ms",
    );
    // Fetch profile immediately so caller can use the role for navigation
    let signedInProfile: Profile | null = null;
    if (data?.user) {
      try {
        // Clear stale cache so fetchProfile hits the DB fresh
        await CacheManager.clear(`profile_${data.user.id}`);
        signedInProfile = await fetchProfile(data.user.id);
        if (signedInProfile) setProfile(signedInProfile);
      } catch {
        // Non-fatal — profile will be set via onAuthStateChange
      }
    }
    return { error: null, profile: signedInProfile };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    console.log("[Auth] Attempting sign up (no email verification) for:", email);
    
    try {
      // NOTE: Email verification is temporarily disabled.
      // Using /api/auth/create-user to directly create the user without a verification step.
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5001";
      const res = await fetch(`${SERVER_URL}/api/auth/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role: "student" }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return { error: new Error(data.error || "Failed to register") };
      }
      
      return { error: null, isNewUser: true };
    } catch (err: any) {
      console.error("[Auth] Sign up error:", err.message);
      return { error: err };
    }
  };

  // --- EMAIL VERIFICATION (commented out — not in use yet) ---
  // const verifyEmailCode = async (email: string, code: string) => {
  //   console.log("[Auth] Attempting code verification for:", email);
  //   try {
  //     const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5001";
  //     const res = await fetch(`${SERVER_URL}/api/auth/verify`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ email, code }),
  //     });
  //     const data = await res.json();
  //     if (!res.ok) {
  //       return { error: new Error(data.error || "Verification failed") };
  //     }
  //     return { error: null, isVerified: true };
  //   } catch (err: any) {
  //     console.error("[Auth] Verification error:", err.message);
  //     return { error: err };
  //   }
  // };

  const signOut = async () => {
    try {
      if (user?.id) {
        localStorage.removeItem(`active_time_${user.id}`);
      }
      await supabase.auth.signOut();
    } finally {
      setProfile(null);
      profileFetchRef.current = {};
      // Clear auth-related cache
      await CacheManager.clear("profile_");
    }
  };

  // Allow profile page to update local cache after editing
  const updateProfileCache = (updates: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  // Automatically log out if the user is inactive for 30 minutes
  useInactivityTimeout(
    () => {
      console.log("[Auth] Inactivity timeout reached. Logging out.");
      signOut();
    },
    30, // 30 minutes
    !!user // Only run the timeout when the user is actually logged in
  );

  return (
    <AuthContext.Provider
      value={{ 
        session, 
        user, 
        profile, 
        loading, 
        profileLoading, 
        signIn, 
        signUp, 
        // verifyEmailCode, // commented out — email verification not in use yet
        signOut, 
        updateProfileCache 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
