"use client";

import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { onDisconnect, onValue, ref, remove, serverTimestamp, set } from "firebase/database";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { firebase } from "@/lib/firebase/client";
import { normalizeUser, type UserRecord } from "@/lib/profile";
import { toast } from "@/lib/toast";

type Status = "loading" | "signedOut" | "signedIn";

interface AuthValue {
  status: Status;
  user: User | null;
  profile: UserRecord | null;
  isGuest: boolean;
  signInGuest: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  linkEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-email": "El correo no es válido",
  "auth/missing-password": "Escribe tu contraseña",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres",
  "auth/email-already-in-use": "Ese correo ya tiene una cuenta; entra con él",
  "auth/invalid-credential": "Correo o contraseña incorrectos",
  "auth/wrong-password": "Correo o contraseña incorrectos",
  "auth/user-not-found": "No existe una cuenta con ese correo",
  "auth/too-many-requests": "Demasiados intentos; espera un momento",
  "auth/popup-closed-by-user": "Cerraste la ventana de Google",
  "auth/cancelled-popup-request": "Ya hay una ventana de inicio abierta",
  "auth/popup-blocked": "El navegador bloqueó la ventana emergente",
  "auth/network-request-failed": "Sin conexión a internet",
  "auth/operation-not-allowed": "Ese método de inicio no está habilitado",
  "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase",
  "auth/credential-already-in-use": "Esa cuenta ya existe",
  "auth/provider-already-linked": "Tu cuenta ya está vinculada",
};

export function authMessage(err: unknown) {
  const code = (err as { code?: string })?.code ?? "";
  return AUTH_ERRORS[code] ?? (err instanceof Error ? err.message : "No se pudo iniciar sesión");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserRecord | null>(null);

  useEffect(() => {
    const { auth } = firebase();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setStatus(u ? "signedIn" : "signedOut");
      if (!u) setProfile(null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const { db } = firebase();
    api("/api/profile", { action: "init" }).catch((err) => toast.error(err.message));
    const offProfile = onValue(
      ref(db, `users/${user.uid}`),
      (snap) => setProfile(normalizeUser(snap.val())),
      () => setProfile(null),
    );
    const onlineRef = ref(db, `online/${user.uid}`);
    const offConnected = onValue(ref(db, ".info/connected"), (snap) => {
      if (snap.val() !== true) return;
      onDisconnect(onlineRef)
        .remove()
        .then(() => set(onlineRef, serverTimestamp()))
        .catch(() => {});
    });
    return () => {
      offProfile();
      offConnected();
      remove(onlineRef).catch(() => {});
    };
  }, [user]);

  const signInGuest = useCallback(async () => {
    await signInAnonymously(firebase().auth);
  }, []);

  const signInGoogle = useCallback(async () => {
    const { auth } = firebase();
    const provider = new GoogleAuthProvider();
    const current = auth.currentUser;
    if (current?.isAnonymous) {
      try {
        await linkWithPopup(current, provider);
        await current.reload();
        setUser(auth.currentUser);
        toast.success("Cuenta de Google vinculada: tu progreso está a salvo");
        return;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "auth/credential-already-in-use") throw err;
        const credential = GoogleAuthProvider.credentialFromError(err as never);
        if (!credential) throw err;
        await signInWithCredential(auth, credential);
        toast.info("Entraste con tu cuenta de Google existente");
        return;
      }
    }
    await signInWithPopup(auth, provider);
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebase().auth, email.trim(), password);
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(firebase().auth, email.trim(), password);
  }, []);

  const linkEmail = useCallback(async (email: string, password: string) => {
    const { auth } = firebase();
    const current = auth.currentUser;
    if (!current) throw new Error("Inicia sesión primero");
    await linkWithCredential(current, EmailAuthProvider.credential(email.trim(), password));
    await current.reload();
    setUser(auth.currentUser);
    toast.success("Correo vinculado: tu progreso está a salvo");
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(firebase().auth);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      profile,
      isGuest: !!user?.isAnonymous,
      signInGuest,
      signInGoogle,
      signInEmail,
      signUpEmail,
      linkEmail,
      signOut,
    }),
    [status, user, profile, signInGuest, signInGoogle, signInEmail, signUpEmail, linkEmail, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
