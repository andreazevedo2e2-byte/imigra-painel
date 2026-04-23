import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { requireAdminSession, setAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function LoginPage() {
  const session = await requireAdminSession();
  if (session) redirect('/');

  async function login(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      redirect('/login?error=invalid');
    }

    const env = getEnv();
    if (
      parsed.data.email.toLowerCase() !== env.ADMIN_LOGIN_EMAIL.toLowerCase() ||
      parsed.data.password !== env.ADMIN_LOGIN_PASSWORD
    ) {
      redirect('/login?error=auth');
    }

    await setAdminSession(env.ADMIN_LOGIN_EMAIL);
    redirect('/');
  }

  return (
    <div className="container auth-shell">
      <div className="card auth-card">
        <h1 className="auth-title">Imigra Painel</h1>
        <p className="page-subtitle" style={{ marginTop: 10, marginBottom: 18 }}>
          Acesso restrito para administradores.
        </p>

        <form action={login} className="form-stack">
          <label className="form-label">
            <span>E-mail</span>
            <input className="input" name="email" type="email" required />
          </label>
          <label className="form-label">
            <span>Senha</span>
            <input className="input" name="password" type="password" required />
          </label>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 10 }}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
