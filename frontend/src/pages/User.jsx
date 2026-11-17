
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./User.css";

const API = "http://127.0.0.1:8000";

const emptyForm = {
  name: "",
  artisan: "",
  origin: "",
  technique: "",
  motif: "",
};

function getSavedUser() {
  try {
    const saved =
      localStorage.getItem("batik_user") ||
      sessionStorage.getItem("batik_user");

    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export default function User() {
  const [user] = useState(getSavedUser);
  const [products, setProducts] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("beranda");

  useEffect(() => {
    if (!user || !user.id || user.role !== "user") {
      window.location.href = "/";
      return;
    }

    loadDashboard();
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function loadDashboard() {
    setPageLoading(true);

    try {
      const [myResponse, catalogResponse] = await Promise.all([
        fetch(`${API}/api/my-products/${user.id}`),
        fetch(`${API}/api/products`),
      ]);

      const myData = await myResponse.json();
      const catalogData = await catalogResponse.json();

      if (!myResponse.ok) {
        throw new Error(myData.detail || "Gagal memuat riwayat pengajuan.");
      }

      if (!catalogResponse.ok) {
        throw new Error(catalogData.detail || "Gagal memuat katalog.");
      }

      setProducts(myData.products || []);
      setCatalog(catalogData.products || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPageLoading(false);
    }
  }

  const filteredCatalog = useMemo(() => {
    const keyword = search.toLowerCase();

    return catalog.filter((item) =>
      [
        item.name,
        item.artisan,
        item.origin,
        item.motif,
      ].some((value) =>
        String(value || "").toLowerCase().includes(keyword)
      )
    );
  }, [catalog, search]);

  const verifiedCount = products.filter(
    (item) => item.blockchain_id
  ).length;

  const pendingCount = products.length - verifiedCount;

  function navigateTo(section) {
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handlePhotoChange(file) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Format foto harus JPG, PNG, atau WEBP.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("Ukuran foto maksimal 10 MB.");
      return;
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setMessage("");
  }

  
async function submitProduct(e) {
  e.preventDefault();

  if (!user?.id) {
    setMessage("Sesi akun tidak ditemukan. Silakan login kembali.");
    return;
  }

  setLoading(true);
  setMessage("");

  try {
    // 1. Simpan data produk ke database
    const response = await fetch(`${API}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        user_id: user.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.detail || "Gagal mengajukan produk.");
    }

    // 2. Ambil ID produk yang baru disimpan
    const productId =
      result.product_id ||
      result.id ||
      result.product?.id;

    if (!productId) {
      throw new Error(
        "Produk tersimpan, tetapi ID produk tidak ditemukan."
      );
    }

    // 3. Upload foto jika ada
    let successMessage = "Pengajuan produk berhasil dikirim.";

    if (photo) {
      const body = new FormData();
      body.append("photo", photo);

      const uploadResponse = await fetch(
        `${API}/api/products/${productId}/photo`,
        {
          method: "POST",
          body,
        }
      );

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        successMessage =
          "Produk tersimpan, tetapi foto gagal diunggah: " +
          (uploadResult.detail || "Terjadi kesalahan.");
      } else {
        successMessage =
          "Pengajuan produk dan foto berhasil dikirim.";
      }
    }

    // 4. Kosongkan formulir
    setForm(emptyForm);
    setPhoto(null);
    setPhotoPreview("");

    // 5. Muat ulang data dashboard
    await loadDashboard();

    setMessage(successMessage);
    navigateTo("riwayat");

  } catch (error) {
    setMessage(error.message);
  } finally {
    setLoading(false);
  }
}


  function logout() {
    localStorage.removeItem("batik_user");
    sessionStorage.removeItem("batik_user");
    window.location.href = "/";
  }

  function imageUrl(path) {
    if (!path) return "";

    return path.startsWith("http") ? path : `${API}${path}`;
  }

  if (!user || user.role !== "user") {
    return null;
  }

  return (
    <div className="user-dashboard">
      <header className="user-navbar">
        <a className="user-brand" href="#beranda">
          <span className="user-brand-icon">✥</span>
          <span>
            <strong>Pusaka Verifikasi</strong>
            <small>BATIK IDN · VERIFICATION PLATFORM</small>
          </span>
        </a>

        <nav className="user-nav-links">
          {[
            ["beranda", "Beranda"],
            ["katalog", "Katalog Batik"],
            ["ajukan", "Ajukan Produk"],
            ["riwayat", "Riwayat Pengajuan"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={activeSection === id ? "active" : ""}
              onClick={() => navigateTo(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="user-account">
          <div className="user-avatar">
            {(user.name || "U").charAt(0).toUpperCase()}
          </div>
          <div className="user-account-info">
            <strong>{user.name}</strong>
            <small>Pengguna</small>
          </div>
          <button className="user-logout" onClick={logout}>
            Keluar
          </button>
        </div>
      </header>

      <main className="user-main">
        <section className="user-welcome" id="beranda">
          <div>
            <span className="user-eyebrow">
              PUSAKA WARISAN NUSANTARA
            </span>
            <h1>
              Selamat datang, {user.name}
            </h1>
            <p>
              Kelola pengajuan dan jelajahi koleksi warisan batik
              Indonesia melalui satu platform.
            </p>
          </div>

          <div className="user-welcome-decoration">
            <span>❖</span>
            <small>IDENTITAS · BUDAYA · KEASLIAN</small>
          </div>
        </section>

        {message && (
          <div className="user-message" role="status">
            {message}
            <button onClick={() => setMessage("")}>×</button>
          </div>
        )}

        <section className="user-stat-grid">
          <article className="user-stat-card">
            <span>Total Pengajuan</span>
            <strong>{products.length}</strong>
            <small>Produk milik akun Anda</small>
          </article>

          <article className="user-stat-card">
            <span>Tercatat di Blockchain</span>
            <strong>{verifiedCount}</strong>
            <small>Memiliki transaksi Solana</small>
          </article>

          <article className="user-stat-card">
            <span>Menunggu Verifikasi</span>
            <strong>{pendingCount}</strong>
            <small>Belum tercatat di blockchain</small>
          </article>

          <article className="user-stat-card">
            <span>Koleksi Katalog</span>
            <strong>{catalog.length}</strong>
            <small>Total produk terdaftar</small>
          </article>
        </section>

        <section className="user-section" id="katalog">
          <div className="user-section-heading">
            <div>
              <span className="user-eyebrow">JELAJAHI WARISAN</span>
              <h2>Katalog Batik</h2>
              <p>Temukan koleksi batik yang telah terdaftar.</p>
            </div>

            <input
              className="user-search"
              type="search"
              placeholder="Cari batik, motif, pengrajin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {pageLoading ? (
            <p className="user-empty">Memuat katalog...</p>
          ) : filteredCatalog.length ? (
            <div className="user-product-grid">
              {filteredCatalog.map((item) => (
                <article className="user-product-card" key={item.id}>
                  <div className="user-product-image">
                    {item.photo_url ? (
                      <img
                        src={imageUrl(item.photo_url)}
                        alt={item.name}
                      />
                    ) : (
                      <span>❖</span>
                    )}
                  </div>

                  <div className="user-product-content">
                    <span className="user-product-id">
                      ID #{item.id}
                    </span>
                    <h3>{item.name}</h3>
                    <p>{item.motif || "Motif belum tersedia"}</p>

                    <div className="user-product-meta">
                      <span>Pengrajin</span>
                      <strong>{item.artisan}</strong>
                      <span>Asal daerah</span>
                      <strong>{item.origin}</strong>
                    </div>

                    <span className={
                      item.blockchain_id
                        ? "user-status verified"
                        : "user-status pending"
                    }>
                      {item.blockchain_id
                        ? "Tercatat di Solana"
                        : "Belum tercatat"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="user-empty">Tidak ada produk yang ditemukan.</p>
          )}
        </section>

        <section className="user-section user-submit-section" id="ajukan">
          <div className="user-section-heading">
            <div>
              <span className="user-eyebrow">REGISTRASI KARYA</span>
              <h2>Ajukan Produk Batik</h2>
              <p>
                Lengkapi informasi batik yang ingin Anda daftarkan.
              </p>
            </div>
          </div>

          <form className="user-submit-form" onSubmit={submitProduct}>
            <div className="user-form-fields">
              {[
                ["name", "Nama Batik", "Contoh: Batik Parang Barong"],
                ["artisan", "Nama Pengrajin", "Nama pengrajin atau sanggar"],
                ["origin", "Asal Daerah", "Contoh: Yogyakarta"],
                ["technique", "Teknik Pembuatan", "Contoh: Batik Tulis"],
                ["motif", "Motif Batik", "Contoh: Parang Rusak"],
              ].map(([key, label, placeholder]) => (
                <label className="user-field" key={key}>
                  <span>{label} *</span>
                  <input
                    type="text"
                    value={form[key]}
                    placeholder={placeholder}
                    maxLength={150}
                    required
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>

            <div className="user-photo-upload">
              <span>Foto Dokumentasi Batik</span>

              <label className="user-upload-area">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview batik" />
                ) : (
                  <>
                    <strong>＋</strong>
                    <span>Pilih foto batik</span>
                    <small>JPG, PNG, WEBP · Maksimal 10 MB</small>
                  </>
                )}

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    handlePhotoChange(e.target.files?.[0])
                  }
                />
              </label>

              {photo && (
                <button
                  type="button"
                  className="user-remove-photo"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview("");
                  }}
                >
                  Hapus foto
                </button>
              )}
            </div>

            <div className="user-form-actions">
              <button
                type="button"
                className="user-button secondary"
                onClick={() => {
                  setForm(emptyForm);
                  setPhoto(null);
                  setPhotoPreview("");
                }}
              >
                Reset Form
              </button>

              <button
                type="submit"
                className="user-button primary"
                disabled={loading}
              >
                {loading ? "Mengirim..." : "Kirim Pengajuan →"}
              </button>
            </div>
          </form>
        </section>

        <section className="user-section" id="riwayat">
          <div className="user-section-heading">
            <div>
              <span className="user-eyebrow">AKTIVITAS AKUN</span>
              <h2>Riwayat Pengajuan</h2>
              <p>Daftar produk yang diajukan oleh akun Anda.</p>
            </div>

            <button
              className="user-button secondary"
              onClick={loadDashboard}
            >
              ↻ Muat Ulang
            </button>
          </div>

          {pageLoading ? (
            <p className="user-empty">Memuat riwayat...</p>
          ) : products.length ? (
            <div className="user-history-list">
              {products.map((item) => (
                <article className="user-history-card" key={item.id}>
                  <div className="user-history-image">
                    {item.photo_url ? (
                      <img
                        src={imageUrl(item.photo_url)}
                        alt={item.name}
                      />
                    ) : (
                      <span>❖</span>
                    )}
                  </div>

                  <div className="user-history-info">
                    <small>ID #{item.id}</small>
                    <h3>{item.name}</h3>
                    <p>{item.origin} · {item.technique}</p>
                    <span className={
                      item.blockchain_id
                        ? "user-status verified"
                        : "user-status pending"
                    }>
                      {item.blockchain_id
                        ? "Tercatat di Solana Devnet"
                        : "Menunggu pencatatan blockchain"}
                    </span>
                  </div>

                  <div className="user-history-qr">
                    <QRCodeSVG
                      value={`${window.location.origin}/?product=${item.id}`}
                      size={68}
                      level="H"
                    />
                    <small>QR Produk</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="user-empty">
              Belum ada pengajuan produk.
            </div>
          )}
        </section>


        <footer className="user-footer">
          <strong>Pusaka Verifikasi</strong>
          <span>Melestarikan Warisan, Menjaga Keaslian.</span>
          <small>© 2026 Sistem Verifikasi Batik</small>
        </footer>
      </main>
    </div>
  );
}
