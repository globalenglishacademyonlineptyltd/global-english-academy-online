import Link from "next/link";

export default function Home() {
  return (
    <main className="login">
      <div className="login-card">
        <div className="brand">Global English Academy</div>
        <h1>Online English School</h1>
        <p className="muted">A dedicated platform for lessons, teachers, students, materials and teaching records.</p>
        <div style={{marginTop: 24}}>
          <Link href="/login"><button className="primary">Sign in</button></Link>
        </div>
      </div>
    </main>
  );
}