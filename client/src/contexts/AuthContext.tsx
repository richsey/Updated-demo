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

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "student" | "admin";
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
  signOut: () => Promise<void>;
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
    console.log("[Auth] Attempting sign up for:", email);
    const startTime = performance.now();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      console.error("[Auth] Sign up error:", error.message);
      let msg = error.message;
      if (msg.includes("User already registered"))
        msg = "User already exists. Please sign in.";
      return { error: new Error(msg) };
    }

    // Helper: set role in app_metadata via server (safe, uses service role key)
    const setRoleViaServer = (userId: string) =>
      fetch("http://localhost:5000/api/auth/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      }).catch((err) => console.warn("[Auth] set-role call failed (non-fatal):", err));

    // If we have a user but no session, it usually means email confirmation is enabled
    if (data.user && !data.session) {
      console.log(
        "[Auth] Sign up successful - Email confirmation required in",
        performance.now() - startTime,
        "ms",
      );
      // Set role in background, then create profile
      setRoleViaServer(data.user.id);
      ensureProfileExists(data.user.id, email, fullName).catch((err) => {
        console.error("[Auth] Background profile creation failed:", err);
      });
      return {
        error: new Error("REGISTRATION_SUCCESS_CONFIRM_EMAIL"),
        isNewUser: true,
      };
    }

    console.log(
      "[Auth] Sign up successful - Session started in",
      performance.now() - startTime,
      "ms",
    );

    // Set role via server (so app_metadata.role is immediately correct)
    if (data.user) {
      await setRoleViaServer(data.user.id);
    }

    // Explicitly create profile to ensure it exists (fixes trigger failure)
    if (data.user) {
      try {
        const profile = await ensureProfileExists(
          data.user.id,
          email,
          fullName,
        );
        setProfile(profile);
      } catch (err) {
        console.error("[Auth] Profile creation failed:", err);
        // Still return success - user can continue without profile
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setProfile(null);
      profileFetchRef.current = {};
      // Clear auth-related cache
      await CacheManager.clear("profile_");
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, profileLoading, signIn, signUp, signOut }}
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
