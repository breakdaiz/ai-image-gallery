"use client"; // if using Next.js App Router

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

const AuthContext = createContext({ session: null });

export const AuthContextProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState(null);

  return (
    <AuthContext.Provider value={{ session }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
