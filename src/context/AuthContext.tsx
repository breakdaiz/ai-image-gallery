"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import supabase from "./../lib/supabase-config";
import type { Session, User } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

import toast from "react-hot-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
});

export const AuthContextProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Signup
  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });

    // step1 : check if user already exist using email, if yes give sucess false

    const { data: existingUser, error: existingError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("email", email);

    if (existingError) {
      toast.error(existingError.message);
    }

    if (existingUser && existingUser.length > 0) {
      toast.error("User already exists with this email.");
      return { error };
    }

    // step2: if user does not exist, hash the password

    const hashPassword = await bcrypt.hash(password || "", 10);
    password = hashPassword;

    // step3: create user profile in user_profiles table

    const { data: newUser, error: profileError } = await supabase
      .from("user_profiles")
      .insert([{ email, password: hashPassword, role: "user" }]);

    if (profileError) {
      toast.error(profileError.message);
      console.error("Error creating user profile:", profileError.message);
    }

    if (error) {
      console.error("Error signing up:", error.message);
      toast.error(`Sign-up failed. ${error.message}`);

      return { error };
    }

    toast.success("Signup successful! Please check your email to confirm.");
  };

  // Signin user
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Error signing in:", error.message);
        toast.error(
          `Sign-in failed. Please check your credentials.,${error.message}`
        );

        return { error };
      }

      toast.success("Successfully signed in!");
      // Update local state
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);

      return { error: null };
    } catch (err) {
      toast.error(`An unexpected error occurred during sign-in.,${err}`);

      console.error("Unexpected sign-in error:", err);

      return { error: err };
    }
  };

  // Signout
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error.message);
      toast.error(`Sign-out failed. ${error.message}`);

      throw error;
    }
    setUser(null);
    setSession(null);
    toast.success("Successfully signed out!");
  };

  // Session management
  useEffect(() => {
    const currentSession = supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signOut, signUp, signIn }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
