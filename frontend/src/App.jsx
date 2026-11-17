import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Navbar from "./components/Navbar";
import "./App.css";
import Dashboard from "./components/Dashboard";
import DetectionAi from "./components/DetectionAi";
import VerificationQueue from "./components/VerificationQueue";

const API = "https://batik-verifikasi.onrender.com";

const emptyForm = {
  name: "",
  artisan: "",
  origin: "",
  technique: "",
  motif: "",
};

export default function App() {
  const [products, setProducts] = useState([]);
  const [localKnowledge, setLocalKnowledge] = useState([]);
  const [aiKnowledge, setAiKnowledge] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [searchId, setSearchId] = useState("");
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogOrigin, setCatalogOrigin] = useState("Semua Asal");
  const [catalogPage, setCatalogPage] = useState(1);

  const itemsPerPage = 8;

  const [aiPhoto, setAiPhoto] = useState(null);
  const [aiProductId, setAiProductId] = useState("");
  const [aiPreview, setAiPreview] = useState("");
  const [aiResult, setAiResult] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  async function loadLocalKnowledge() {
    const res = await fetch(`${API}/api/local-knowledge`);
    const data = await res.json();
    if (!res.ok) throw new Error("Gagal memuat pengetahuan lokal");
    setLocalKnowledge(data.knowledge || []);
  }
  async function loadAiKnowledge() {
    const res = await fetch(`${API}/api/ai-knowledge`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Gagal memuat pengetahuan Lokal");
    setAiKnowledge(data.knowledge || []);
  }

  async function loadProducts() {
    const res = await fetch(`${API}/api/products`);
    const data = await res.json();
    if (!res.ok) throw new Error("Gagal memuat produk");
    setProducts(data.products || []);
  }

  useEffect(() => {
    loadProducts().catch((err) => setMessage(err.message));
    loadLocalKnowledge().catch((err) => setMessage(err.message));
    loadAiKnowledge().catch((err) => setAiMessage(err.message));
  }, []);

  useEffect(() => {
    return () => {
      if (aiPreview) URL.revokeObjectURL(aiPreview);
    };
  }, [aiPreview]);

  const foundProduct = searched
    ? products.find((p) => String(p.id) === searchId.trim())
    : null;

    // Daftar asal daerah untuk filter katalog
const catalogOrigins = [
  ...new Set(products.map((p) => p.origin).filter(Boolean)),
];

// Filter pencarian dan asal daerah
const filteredProducts = products.filter((p) => {
  const keyword = catalogSearch.toLowerCase();

  const matchesSearch = [
    p.name,
    p.artisan,
    p.origin,
    p.motif,
  ].some((value) =>
    String(value || "").toLowerCase().includes(keyword)
  );

  const matchesOrigin =
    catalogOrigin === "Semua Asal" ||
    p.origin === catalogOrigin;

  return matchesSearch && matchesOrigin;
});

const totalPages = Math.ceil(
  filteredProducts.length / itemsPerPage
);

const paginatedProducts = filteredProducts.slice(
  (catalogPage - 1) * itemsPerPage,
  catalogPage * itemsPerPage
);

  function productUrl(id) {
    return `${window.location.origin}/?product=${id}`;
  }

  function downloadQR(id, type = "inspection") {
  const svg = document.getElementById(`qr-${type}-${id}`);
  if (!svg) {
    setMessage("QR Code tidak ditemukan.");
    return;
  }

  const data = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([data], {
    type: "image/svg+xml;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `QR-Batik-${id}.svg`;
  link.click();

  URL.revokeObjectURL(url);
}

  async function createProduct(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${API}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal menambah produk");

      setForm(emptyForm);
      setMessage("Produk berhasil ditambahkan.");
      await loadProducts();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadPhoto(id, file) {
    if (!file) return;
    setBusyId(id);
    setMessage("");

    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch(`${API}/api/products/${id}/photo`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload gagal");

      setMessage("Foto berhasil diunggah.");
      await loadProducts();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function verifyProduct(id) {
    if (!window.confirm("Catat hash produk ini ke Solana Devnet?")) return;
    setBusyId(id);
    setMessage("Sedang mencatat ke Solana Devnet...");

    try {
      const res = await fetch(`${API}/api/products/${id}/verify`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Verifikasi gagal");

      setMessage("Berhasil dicatat ke Solana Devnet.");
      await loadProducts();
    } catch (err) {
      setMessage(`Gagal: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  function selectAiPhoto(file) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAiMessage("Gunakan foto JPG, PNG, atau WEBP.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAiMessage("Ukuran foto maksimal 10 MB.");
      return;
    }

    setAiPhoto(file);
    setAiPreview(URL.createObjectURL(file));
    setAiResult([]);
    setAiMessage("");
  }

  async function detectBatik(e) {
    e.preventDefault();

    if (!aiPhoto) {
      setAiMessage("Pilih foto batik terlebih dahulu.");
      return;
    }

    setAiLoading(true);
    setAiMessage("Sedang menganalisis foto...");
    setAiResult([]);

    try {
      const body = new FormData();
      body.append("photo", aiPhoto);
      body.append("product_id", aiProductId);

      const res = await fetch(`${API}/api/predict`, {
        method: "POST",
        body,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Deteksi gagal.");
      }

      const predictions = (data.result || []).flatMap(
        (item) => item.predictions?.predictions || []
      );

      setAiResult(predictions);
      setAiMessage(
        predictions.length
          ? "Analisis berhasil. Berikut hasil prediksi model."
          : "Model tidak menemukan objek yang terdeteksi."
      );
    } catch (err) {
      setAiMessage(`Gagal melakukan deteksi: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }

  function findAiKnowledge(className) {
    const normalize = (value) =>
      String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const detected = normalize(className);

    return aiKnowledge.find((item) =>
      normalize(item.class_name) === detected
    ) || null;
  }

  function findLocalKnowledge(className) {
    const normalize = (value) =>
      String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const detected = normalize(className);

    return localKnowledge.find((item) => {
      const motif = normalize(item.motif);
      return motif && (
        motif === detected ||
        detected.endsWith(motif) ||
        motif.endsWith(detected)
      );
    }) || null;
  }
  function productDetails(p) {
    const normalizedMotif = String(p.motif || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchingKnowledge = localKnowledge.filter((item) => {
      const motif = String(item.motif || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return motif === normalizedMotif || motif.endsWith(normalizedMotif);
    });
    const knowledge = matchingKnowledge.length === 1 ? matchingKnowledge[0] : null;
    return (
      <>
        {p.photo_url && (
          <img
            src={p.photo_url.startsWith("http") ? p.photo_url : `${API}${p.photo_url}`}
            alt={`Foto ${p.name}`}
            style={{
              width: "100%",
              maxHeight: "260px",
              objectFit: "contain",
              background: "#f5f5f5",
              borderRadius: "6px",
            }}
          />
        )}
        <p><b>Nama:</b> {p.name}</p>
        <p><b>Pengrajin:</b> {p.artisan}</p>
        <p><b>Asal:</b> {p.origin}</p>
        <p><b>Teknik:</b> {p.technique}</p>
        <p><b>Motif:</b> {p.motif}</p>
        {knowledge && (
          <section style={{ padding: "14px", margin: "14px 0", background: "#f0f5f0", borderRadius: "8px" }}>
            <h4>Informasi Motif Batik</h4>
            <p><b>Wilayah:</b> {knowledge.region}</p>
            <p><b>Teknik:</b> {knowledge.technique || "Belum tersedia"}</p>
            <p><b>Karakteristik:</b> {knowledge.characteristics || "Belum tersedia"}</p>
            <p><b>Filosofi:</b> {knowledge.philosophy || "Belum tersedia"}</p>
            <p><b>Status referensi:</b> {knowledge.verification_status}</p>
            {knowledge.source && <p><b>Sumber:</b> {knowledge.source}</p>}
          </section>
        )}
        <p><b>ID produk:</b> {p.id}</p>
        <p><b>Status:</b> {p.status}</p>
        {p.ai_class && (
          <div style={{
            padding: "12px",
            margin: "12px 0",
            background: "#f0f5f0",
            borderRadius: "6px",
          }}>
            <p><b>Hasil Analisis AI:</b> {p.ai_class}</p>
            <p><b>Confidence:</b> {(p.ai_confidence * 100).toFixed(2)}%</p>
            <small>Confidence adalah tingkat keyakinan model, bukan bukti mutlak keaslian batik.</small>
          </div>
        )}

        {p.blockchain_id ? (
          <div style={{ overflowWrap: "anywhere" }}>
            <p><b>Hash data:</b></p>
            <code>{p.product_hash}</code>
            <p>
              <a
                href={`https://explorer.solana.com/tx/${p.blockchain_id}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Periksa transaksi Solana
              </a>
            </p>
          </div>
        ) : (
          <p>Belum tercatat di blockchain.</p>
        )}

        <hr />
        <h4>QR Code Produk</h4>
        <p style={{ fontSize: "13px", overflowWrap: "anywhere" }}>
          {productUrl(p.id)}
        </p>
        <div style={{
          background: "white",
          display: "inline-block",
          padding: "12px",
          border: "1px solid #ddd",
        }}>
          <QRCodeSVG
             id={`qr-inspection-${p.id}`}
          value={productUrl(p.id)}
            size={150}
            level="H"
            includeMargin
          />
        </div>
        <br />
        <button
          type="button"
          onClick={() => downloadQR(foundProduct.id, "inspection")}
          style={{ ...buttonStyle, marginTop: "10px" }}
        >
          Unduh QR Code
        </button>
      </>
    );
  }

  const inputStyle = {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    boxSizing: "border-box",
    border: "1px solid #ccc",
    borderRadius: "6px",
  };

  const buttonStyle = {
    padding: "10px 14px",
    border: 0,
    borderRadius: "6px",
    background: "#176b45",
    color: "white",
    cursor: "pointer",
  };

  return (
    <>
    <Navbar />

    <main className="app-container batik-app">
      <Dashboard products={products} />

      {message && (
        <div className="app-message">
          {message}
        </div>
      )}

      <DetectionAi
        aiPhoto={aiPhoto}
        aiPreview={aiPreview}
        aiLoading={aiLoading}
        aiMessage={aiMessage}
        aiResult={aiResult}
        selectAiPhoto={selectAiPhoto}
        detectBatik={detectBatik}
        findAiKnowledge={findAiKnowledge}
      />

      {/* 3. PEMERIKSAAN CEPAT */}
      <section className="batik-section inspection-section" id="cek-keaslian">
        <div className="batik-section-header inspection-header">
          <div>
            <h2 className="batik-section-title">
              <span className="section-title-icon">⌕</span>
              Pemeriksaan Cepat & Detail Produk
            </h2>
            <p className="batik-section-subtitle">
              Periksa status produk berdasarkan nomor registrasi batik.
            </p>
          </div>

          <form
            className="inspection-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearched(true);
            }}
          >
            <label htmlFor="searchId">ID Produk:</label>
            <input
              id="searchId"
              type="number"
              min="1"
              required
              value={searchId}
              onChange={(e) => {
                setSearchId(e.target.value);
                setSearched(false);
              }}
              placeholder="Masukkan ID"
            />
            <button type="submit" className="batik-button">
              Periksa Produk
            </button>
          </form>
        </div>

        {searched && (
          <div className="inspection-result">
            {foundProduct ? (
              <div className="inspection-result-content">
                <div className="inspection-product-image">
                  {foundProduct.photo_url ? (
                    <img
                      src={
                        foundProduct.photo_url.startsWith("http")
                          ? foundProduct.photo_url
                          : `${API}${foundProduct.photo_url}`
                      }
                      alt={`Foto ${foundProduct.name}`}
                    />
                  ) : (
                    <div className="no-product-image">
                      <span>▧</span>
                      <p>Foto batik belum tersedia</p>
                    </div>
                  )}
                  <span className="image-caption">
                    Foto Dokumentasi Batik
                  </span>
                </div>

                <div className="inspection-product-info">
                  <div className="product-status-row">
                    <span className="product-id-badge">
                      ID #{foundProduct.id}
                    </span>
                    <span className={
                      foundProduct.blockchain_id
                        ? "status-badge status-verified"
                        : "status-badge status-pending"
                    }>
                      {foundProduct.blockchain_id
                        ? "Tercatat di Solana Devnet"
                        : "Belum tercatat di Blockchain"}
                    </span>
                  </div>

                  <h3>{foundProduct.name}</h3>
                  <p className="inspection-motif">
                    Motif: {foundProduct.motif}
                  </p>

                  <div className="inspection-metadata">
                    <div>
                      <span>Pengrajin</span>
                      <strong>{foundProduct.artisan}</strong>
                    </div>
                    <div>
                      <span>Asal Daerah</span>
                      <strong>{foundProduct.origin}</strong>
                    </div>
                    <div>
                      <span>Teknik Pembuatan</span>
                      <strong>{foundProduct.technique}</strong>
                    </div>
                    <div>
                      <span>Status Produk</span>
                      <strong>{foundProduct.status || "Terdaftar"}</strong>
                    </div>
                  </div>

                  {foundProduct.ai_class && (
                    <div className="inspection-ai-info">
                      <strong>Hasil Analisis AI</strong>
                      <p>{foundProduct.ai_class}</p>
                      <small>
                        Confidence: {(foundProduct.ai_confidence * 100).toFixed(2)}%
                      </small>
                      <small>
                        Confidence bukan bukti mutlak keaslian batik.
                      </small>
                    </div>
                  )}

                  {foundProduct.blockchain_id ? (
                    <div className="hash-container">
                      <label>Solana Signature / Ledger Hash</label>
                      <div className="hash-value">
                        <code>{foundProduct.product_hash}</code>
                        <button
                          type="button"
                          onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(foundProduct.product_hash || "");
                    setMessage("Hash berhasil disalin.");
                  } catch {
                    setMessage("Gagal menyalin hash.");
                  }
                }}
                          title="Salin hash"
                        >
                          Salin
                        </button>
                      </div>
                      <a
                        href={`https://explorer.solana.com/tx/${foundProduct.blockchain_id}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="explorer-link"
                      >
                        Periksa Transaksi Solana Explorer ↗
                      </a>
                    </div>
                  ) : (
                    <p className="pending-blockchain">
                      Produk ini belum memiliki catatan transaksi Solana.
                    </p>
                  )}

                
                </div>

                <div className="inspection-qr-panel">
                  <span className="qr-panel-title">
                    QR Fisik Sertifikat
                  </span>
                  <div className="qr-preview">
                    <QRCodeSVG
                      id={`qr-inspection-${foundProduct.id}`}
                  value={productUrl(foundProduct.id)}
                  size={150}
                  level="H"
                  includeMargin
                    />
                  </div>
                  <button
                    type="button"
                    className="batik-button qr-download-button"
                    onClick={() => downloadQR(p.id, "inspection")}
                  >
                    Unduh QR Code
                  </button>
                  <small>
                    Siap dicetak sebagai label atau sertifikat batik.
                  </small>
                </div>
              </div>
            ) : (
              <div className="empty-search-result">
                ID produk tidak ditemukan di database.
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. FORM REGISTRASI */}
      <section className="batik-section registration-section" id="admin-panel">
        <div className="batik-section-heading">
          <div>
            <h2 className="batik-section-title">
              Tambah Produk Batik & Verifikasi Solana
            </h2>
            <p className="batik-section-subtitle">
              Daftarkan metadata produk batik ke dalam sistem.
            </p>
          </div>
          <span className="curator-label">
            Formulir Digital Kurator
          </span>
        </div>

        <form className="registration-form" onSubmit={createProduct}>
          <div className="registration-fields">
            {[
              ["name", "Nama Batik", "Contoh: Batik Parang Barong"],
              ["artisan", "Nama Pengrajin / Sanggar", "Nama pengrajin"],
              ["origin", "Asal Daerah", "Contoh: Yogyakarta"],
              ["technique", "Teknik Pembuatan", "Contoh: Batik Tulis"],
              ["motif", "Motif Batik", "Contoh: Parang Rusak"],
            ].map(([key, label, placeholder]) => (
              <label
                key={key}
                className={`registration-field field-${key}`}
              >
                <span>{label} <b>*</b></span>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={form[key]}
                  required
                  maxLength={150}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]: e.target.value,
                    })
                  }
                />
              </label>
            ))}

            <div className="registration-actions">
              <button
                type="submit"
                className="batik-button"
                disabled={loading}
              >
                {loading ? "Menyimpan..." : "+ Tambah Produk"}
              </button>

              <button
                type="button"
                className="batik-button button-secondary"
                onClick={() => setForm(emptyForm)}
                disabled={loading}
              >
                Reset Isian
              </button>
            </div>
          </div>

          <aside className="registration-side-panel">
            <div className="upload-info-card">
              <div className="side-panel-icon">▧</div>
              <h3>Dokumentasi Foto Batik</h3>
              <p>
                Setelah produk berhasil didaftarkan, unggah foto batik
                melalui kartu produk pada bagian katalog.
              </p>
              <div className="upload-format">
                JPG · PNG · WEBP
              </div>
            </div>

            <div className="solana-info-card">
              <div className="solana-card-heading">
                <strong>Verifikasi Solana Devnet</strong>
                <span>Blockchain</span>
              </div>
              <p>
                Setelah foto produk diunggah, proses verifikasi dapat
                dijalankan dari katalog untuk mencatat hash produk
                ke Solana Devnet.
              </p>
              <div className="solana-indicator">
                <span className="solana-dot"></span>
                Solana Devnet
              </div>
            </div>

            <div className="registration-note">
              <strong>Alur Registrasi</strong>
              <ol>
                <li>Isi metadata batik.</li>
                <li>Tambahkan produk.</li>
                <li>Unggah foto melalui katalog.</li>
                <li>Verifikasi dan catat ke Solana.</li>
              </ol>
            </div>
          </aside>
        </form>
      </section>

            {/* 4b. ANTREAN VERIFIKASI */}
      <VerificationQueue
        products={products}
        busyId={busyId}
        apiBase={API}
        onVerify={verifyProduct}
        onDetail={(id) => {
          setSearchId(String(id));
          setSearched(true);
          document
            .getElementById("cek-keaslian")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      {/* 5. KATALOG BATIK */}
      <section className="catalog-section" id="koleksi-batik">
        <div className="catalog-header">
          <div>
            <div className="catalog-title-row">
              <h2 className="batik-section-title">
                Daftar Produk Batik
              </h2>
              <span className="catalog-count">
                {products.length} Karya
              </span>
            </div>
            <p className="batik-section-subtitle">
              Koleksi batik yang telah terdaftar dalam sistem.
            </p>
          </div>

          <div className="catalog-filters">
            <input
              type="search"
              placeholder="Cari nama batik / pengrajin..."
              value={catalogSearch}
              onChange={(e) => {
                setCatalogSearch(e.target.value);
                setCatalogPage(1);
              }}
            />

            <select
              value={catalogOrigin}
              onChange={(e) => {
                setCatalogOrigin(e.target.value);
                setCatalogPage(1);
              }}
            >
              <option value="Semua Asal">Semua Asal</option>
              {catalogOrigins.map((origin) => (
                <option key={origin} value={origin}>
                  {origin}
                </option>
              ))}
            </select>
          </div>
        </div>

        {paginatedProducts.length > 0 ? (
          <div className="catalog-grid">
            {paginatedProducts.map((p) => (
              <article className="batik-product-card" key={p.id}>
                <div className="product-card-content">
                  <div className="product-card-top">
                    <span className="product-id-badge">
                      ID #{p.id}
                    </span>
                    <span className={
                      p.blockchain_id
                        ? "status-badge status-verified"
                        : "status-badge status-pending"
                    }>
                      {p.blockchain_id ? "Solana Verified" : "Belum Verified"}
                    </span>
                  </div>

                  <div className="catalog-product-image">
                    {p.photo_url ? (
                      <img
                        src={
                          p.photo_url.startsWith("http")
                            ? p.photo_url
                            : `${API}${p.photo_url}`
                        }
                        alt={`Foto ${p.name}`}
                      />
                    ) : (
                      <div className="no-product-image">
                        <span>▧</span>
                        <p>Foto belum tersedia</p>
                      </div>
                    )}
                  </div>

                  <div className="catalog-product-heading">
                    <h3>{p.name}</h3>
                    <p>Motif: {p.motif || "Belum tersedia"}</p>
                  </div>

                  <div className="catalog-metadata">
                    <div>
                      <span>Pengrajin</span>
                      <strong>{p.artisan}</strong>
                    </div>
                    <div>
                      <span>Asal</span>
                      <strong>{p.origin}</strong>
                    </div>
                    <div>
                      <span>Teknik</span>
                      <strong>{p.technique}</strong>
                    </div>
                  </div>

                  <div className="catalog-hash">
                    <span>Hash Solana Tx</span>
                    <p>
                      {p.product_hash || "Belum tersedia"}
                    </p>
                  </div>

                  <div className="catalog-upload">
                    <label>
                      Unggah foto batik
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busyId === p.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadPhoto(p.id, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <QRCodeSVG
                 
              id={`qr-catalog-${p.id}`}
              value={productUrl(p.id)}
              size={150}
              level="H"
              includeMargin
              className="catalog-hidden-qr"
            />
                  
                </div>

                <div className="product-card-actions">
                  <button
                    type="button"
                    className="batik-button"
                    onClick={() => downloadQR(p.id, "catalog")}
                  >
                    Unduh QR
                  </button>

                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setSearchId(String(p.id));
                      setSearched(true);
                      document
                        .getElementById("cek-keaslian")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                  
                    Detail
                    </button>
                </div>

                <button
                  type="button"
                  className="verify-product-button"
                  disabled={!p.photo_url || busyId === p.id}
                  onClick={() => verifyProduct(p.id)}
                >
                  {busyId === p.id
                    ? "Memproses..."
                    : p.blockchain_id
                      ? "Verifikasi Ulang ke Solana"
                      : "Verifikasi & Catat ke Solana"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-catalog">
            Tidak ada produk yang cocok dengan pencarian.
          </div>
        )}

        <div className="catalog-pagination">
          <span>
            Menampilkan {paginatedProducts.length} dari {filteredProducts.length} produk
          </span>

          <div className="pagination-buttons">
            <button
              type="button"
              disabled={catalogPage <= 1}
              onClick={() => setCatalogPage((page) => page - 1)}
            >
              Sebelumnya
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (page) => (
                <button
                  type="button"
                  key={page}
                  className={catalogPage === page ? "active" : ""}
                  onClick={() => setCatalogPage(page)}
                >
                  {page}
                </button>
              )
            )}

            <button
              type="button"
              disabled={catalogPage >= totalPages}
              onClick={() => setCatalogPage((page) => page + 1)}
            >
              Selanjutnya
              </button>
          </div>
        
        </div>
      </section>
    </main>
    </>
  );
}









