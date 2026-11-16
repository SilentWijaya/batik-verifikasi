
export default function Navbar() {
  return (
    <header className="navbar">
      <a href="#beranda" className="navbar-brand">
        <div className="brand-icon">✦</div>
        <div className="brand-text">
          <strong>Sistem Verifikasi Batik</strong>
          <span>AI & BLOCKCHAIN PROVENANCE</span>
        </div>
      </a>

      <nav className="navbar-menu">
        <a href="#deteksi-ai">Deteksi Ai</a>
        <a href="#cek-keaslian">Cek Keaslian</a>
        <a href="#koleksi-batik">Koleksi Batik</a>
        <a href="#admin-panel">Admin Panel</a>
      </nav>

      <div className="navbar-status">
        <span className="status-dot"></span>
        <span>Solana Devnet</span>
      </div>
    </header>
  );
}
