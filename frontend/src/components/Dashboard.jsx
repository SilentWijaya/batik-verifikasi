
export default function Dashboard({ products = [] }) {
  const totalProducts = products.length;

  const verifiedProducts = products.filter(
    (product) => Boolean(product.blockchain_id)
  ).length;

  const unverifiedProducts = totalProducts - verifiedProducts;

  const totalArtisans = new Set(
    products
      .map((product) => product.artisan?.trim())
      .filter(Boolean)
  ).size;

  return (
    <section className="dashboard" id="beranda">
      <div className="dashboard-hero">
        <div className="dashboard-intro">
          <span className="dashboard-label">
            ✦ SISTEM VERIFIKASI BUDAYA DIGITAL
          </span>

          <h1>
            Sistem Verifikasi
            <br />
            <span>Batik Nusantara</span>
          </h1>

          <p>
            Kenali identitas batik Nusantara melalui teknologi
            Artificial Intelligence dan pencatatan hash
            sertifikat pada blockchain secara transparan.
          </p>
        </div>

        <div className="dashboard-info">
          <div className="info-card">
            <span>TEKNOLOGI AI</span>
            <strong>Roboflow 3.0</strong>
          </div>

          <div className="info-card">
            <span>BLOCKCHAIN</span>
            <strong>Solana Devnet</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span>Total Produk</span>
          <strong>{totalProducts}</strong>
          <small>Produk dalam database</small>
        </div>

        <div className="stat-card">
          <span>Terverifikasi</span>
          <strong>{verifiedProducts}</strong>
          <small>Tercatat di Solana Devnet</small>
        </div>

        <div className="stat-card">
          <span>Belum Terverifikasi</span>
          <strong>{unverifiedProducts}</strong>
          <small>Belum tercatat di blockchain</small>
        </div>

        <div className="stat-card">
          <span>Pengrajin</span>
          <strong>{totalArtisans}</strong>
          <small>Pengrajin terdaftar</small>
        </div>
      </div>
    </section>
  );
}
