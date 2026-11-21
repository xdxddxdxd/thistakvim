"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import AuthForm from "@/components/AuthForm";
import GoogleSignIn from "./GoogleSignIn";
import styles from "./page.module.css";

export default function LandingAuth({ initiallyOpen, initiallyRegistering, loginError, signupError, checkEmail }: {
  initiallyOpen: boolean;
  initiallyRegistering: boolean;
  loginError: string;
  signupError: string;
  checkEmail: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [register, setRegister] = useState(initiallyRegistering);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <a className={styles.navLogin} href="/login?giris=1#giris" onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          setRegister(false);
          setOpen(true);
        }}>
          Giriş yap <ArrowRight size={16} aria-hidden="true" />
        </a>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={`modal-overlay ${styles.authOverlay}`} />
        <Dialog.Content className={`modal-content ${styles.authDialog}`}>
          <div className={styles.authHeader}>
            <Dialog.Title>{register ? "Hesap oluştur" : "Hesabına giriş yap"}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="icon-button" aria-label="Pencereyi kapat"><X size={21} aria-hidden="true" /></button>
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.authDescription}>
            {register ? "Kendi haftalık planını oluşturmak için kaydol." : "Haftalık planına kaldığın yerden devam et."}
          </Dialog.Description>
          <div className={styles.switcher} role="group" aria-label="Hesap işlemi">
            <button type="button" aria-pressed={!register} onClick={() => setRegister(false)}>Giriş yap</button>
            <button type="button" aria-pressed={register} onClick={() => setRegister(true)}>Kayıt ol</button>
          </div>
          <GoogleSignIn />
          <AuthForm key={register ? "register" : "login"} mode={register ? "register" : "login"}
            initialError={register ? signupError : loginError} checkEmail={register && checkEmail} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
