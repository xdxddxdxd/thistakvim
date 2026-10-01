import { serverClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
export const dynamic = "force-dynamic";
export default async function Login() {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user) redirect("/");
  return (
    <main className="login-page">
      <div className="login-wordmark">
        <h1>
          Haftalık Plan<span className="wordmark-dot">.</span>
        </h1>
        <p>Planla. Yap. İşaretle.</p>
      </div>
      <section className="login-card">
        <h2>Hoş geldin.</h2>
        <p>Haftalık planına kaldığın yerden devam et.</p>
        <LoginForm />
      </section>
      <span className="login-footer">Bir hafta, bir adım daha.</span>
    </main>
  );
}
