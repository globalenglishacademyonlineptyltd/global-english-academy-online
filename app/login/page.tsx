"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  function submit(e: FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
  }
  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">Global English Academy</div>
        <h1>Sign in</h1>
        <p className="muted">Admin, teacher and student access will be secured here.</p>
        <label>Email<input className="input" type="email" required placeholder="you@example.com" /></label>
        <label>Password<input className="input" type="password" required placeholder="••••••••" /></label>
        <button className="primary" type="submit">Continue</button>
      </form>
    </main>
  );
}