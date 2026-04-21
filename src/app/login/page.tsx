import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { requireAdminSession, setAdminSession } from '@/lib/auth';

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
    <div className="container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 440, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.2 }}>Imigra Painel</h1>
        <p className="muted" style={{ marginTop: 8, marginBottom: 18 }}>
          Acesso restrito para administradores.
        </p>

        <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              E-mail
            </span>
            <input className="input" name="email" type="email" required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Senha
            </span>
            <input className="input" name="password" type="password" required />
          </label>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
