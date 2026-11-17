
import { useState } from "react";
import "./Login.css";

const API_BASE_URL = "https://batik-verifikasi.onrender.com";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (isRegister && password !== confirmPassword) {
      setMessage("Konfirmasi password tidak sama.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password minimal 8 karakter.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isRegister ? "/api/register" : "/api/login";

      const payload = isRegister
        ? { name, email, password }
        : { email, password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Terjadi kesalahan pada server."
        );
      }

      if (isRegister) {
        setMessage("Registrasi berhasil! Silakan masuk menggunakan akun Anda.");
        setIsRegister(false);
        setName("");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const user = result.user;

if (!user || !user.id || !user.role) {
  setMessage("Data akun tidak lengkap. Silakan coba login kembali.");
  return;
}

// Hapus sesi login sebelumnya
localStorage.removeItem("batik_user");
sessionStorage.removeItem("batik_user");

// Simpan data akun tanpa menyimpan password
const storage = remember ? localStorage : sessionStorage;

storage.setItem("batik_user", JSON.stringify({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
}));

if (user.role === "admin") {
  window.location.href = "/admin";
} else if (user.role === "user") {
  window.location.href = "/user";
} else {
  localStorage.removeItem("batik_user");
  sessionStorage.removeItem("batik_user");
  setMessage("Role akun tidak dikenali.");
}
    } catch (error) {
      setMessage(error.message || "Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setIsRegister(!isRegister);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="login-page">
      <header className="login-navbar">
        <a href="/" className="login-brand">
          <span className="login-brand-icon">✥</span>
          <span>
            <strong>Sistem Verifikasi Batik</strong>
            <small>PUSAKA VERIFIKASI PLATFORM</small>
          </span>
        </a>

        <nav className="login-nav-links">
          <a href="/">Beranda</a>
          <a href="#bantuan">Bantuan</a>
        </nav>
      </header>

      <div className="login-container">
        <div className="login-layout">

          <section className="login-heritage">
            <div className="heritage-pattern" />

            <div className="heritage-content">
              <span className="heritage-badge">
                ✦ PUSAKA WARISAN NUSANTARA
              </span>

              <h1>
                Pelindung Keaslian
                <span> Mahakarya Nusantara</span>
              </h1>

              <p className="heritage-description">
                Menjaga warisan budaya Indonesia melalui teknologi
                verifikasi batik yang membantu mengenali keaslian,
                asal-usul, dan nilai pengetahuan lokal.
              </p>

              <div className="heritage-audit">
                <div className="audit-top">
                  <span>CONTOH HASIL VERIFIKASI</span>
                  <span className="audit-status">● TERVERIFIKASI</span>
                </div>

                <div className="audit-motif">
                  <div className="audit-motif-icon">❖</div>
                  <div>
                    <strong>Batik Parang Rusak Barong</strong>
                    <small>Motif tradisional · Yogyakarta</small>
                  </div>
                </div>

                <div className="audit-divider" />

                <div className="audit-stat">
                  <div>
                    <small>AKURASI MODEL CNN v4.2</small>
                    <strong>99.82%</strong>
                  </div>
                  <span>CONFIDENCE</span>
                </div>
              </div>

              <div className="heritage-footer">
                <span>WARISAN BUDAYA INDONESIA</span>
                <span>TEKNOLOGI · IDENTITAS · KEASLIAN</span>
              </div>
            </div>
          </section>

          <section className="login-form-panel">
            <div className="login-form-content">

              <span className="login-eyebrow">
                {isRegister ? "REGISTRASI AKUN" : "AUTENTIKASI AKUN"}
              </span>

              <h2>
                {isRegister ? "Buat Akun Baru" : "Selamat Datang"}
              </h2>

              <p className="login-subtitle">
                {isRegister
                  ? "Daftarkan akun Anda untuk mulai menggunakan sistem."
                  : "Masuk ke sistem untuk melanjutkan aktivitas Anda."}
              </p>

              <form onSubmit={handleSubmit}>

                {isRegister && (
                  <div className="login-field">
                    <label htmlFor="register-name">Nama Lengkap</label>
                    <input
                      id="register-name"
                      type="text"
                      placeholder="Masukkan nama lengkap"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      maxLength={100}
                      required
                    />
                  </div>
                )}

                <div className="login-field">
                  <label htmlFor="login-email">Alamat Email</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="login-password">Kata Sandi</label>

                  <div className="password-input-wrapper">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan kata sandi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isRegister ? "new-password" : "current-password"}
                      required
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "Sembunyikan" : "Lihat"}
                    </button>
                  </div>
                </div>

                {isRegister && (
                  <div className="login-field">
                    <label htmlFor="confirm-password">
                      Konfirmasi Kata Sandi
                    </label>

                    <input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ulangi kata sandi"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                )}

                {!isRegister && (
                  <div className="login-options">
                    <label className="remember-option">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                      />
                      <span>Ingat saya</span>
                    </label>

                    <a href="#bantuan">Lupa kata sandi?</a>
                  </div>
                )}

                {message && (
                  <p className="login-message" role="status">
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  className="login-submit"
                  disabled={loading}
                >
                  {loading
                    ? "Memproses..."
                    : isRegister
                      ? "Daftar Akun"
                      : "Masuk ke Sistem"}

                  {!loading && <span>→</span>}
                </button>
              </form>

              <div className="auth-switch">
                {isRegister ? (
                  <>
                    <span>Sudah punya akun?</span>
                    <button type="button" onClick={switchMode}>
                      Masuk sekarang
                    </button>
                  </>
                ) : (
                  <>
                    <span>Belum punya akun?</span>
                    <button type="button" onClick={switchMode}>
                      Daftar sekarang
                    </button>
                  </>
                )}
              </div>

              <div className="login-security">
                <span>◈</span>
                <p>
                  Akses akun dilindungi melalui autentikasi sistem.
                </p>
              </div>

            </div>
          </section>

        </div>

        <footer className="login-page-footer">
          <span>© 2026 Sistem Verifikasi Batik</span>
          <span>Melestarikan Warisan, Menjaga Keaslian.</span>
        </footer>
      </div>
    </div>
  );
}
