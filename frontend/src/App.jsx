import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const emptyForm = {
  name: "",
  artisan: "",
  origin: "",
  technique: "",
  motif: "",
};

export default function App() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [searchId, setSearchId] = useState("");
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function loadProducts() {
    const res = await fetch(`${API}/api/products`);
    const data = await res.json();
    if (!res.ok) throw new Error("Gagal memuat produk");
    setProducts(data.products || []);
  }

  useEffect(() => {
    loadProducts().catch((err) => setMessage(err.message));
  }, []);

  const foundProduct = searched
    ? products.find((p) => String(p.id) === searchId.trim())
    : null;

  function productUrl(id) {
    return `${window.location.origin}/?product=${id}`;
  }

  function downloadQR(id) {
    const svg = document.getElementById(`qr-${id}`);
    if (!svg) return;

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

  function productDetails(p) {
    return (
      <>
        {p.photo_url && (
          <img
            src={`${API}${p.photo_url}`}
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
        <p><b>ID produk:</b> {p.id}</p>
        <p><b>Status:</b> {p.status}</p>

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
            id={`qr-${p.id}`}
            value={productUrl(p.id)}
            size={180}
            level="H"
            includeMargin
          />
        </div>
        <br />
        <button
          type="button"
          onClick={() => downloadQR(p.id)}
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
    <main style={{
      maxWidth: "1000px",
      margin: "30px auto",
      padding: "0 18px",
      fontFamily: "Arial, sans-serif",
      color: "#222",
    }}>
      <h1>Sistem Verifikasi Batik</h1>
      <p>Cek identitas batik dan pencatatan hash di blockchain.</p>

      {message && (
        <p style={{
          padding: "12px",
          background: "#f0f5f0",
          borderRadius: "6px",
          overflowWrap: "anywhere",
        }}>
          {message}
        </p>
      )}

      <section style={{
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "10px",
        marginBottom: "28px",
      }}>
        <h2>Cek Keaslian Batik</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          setSearched(true);
        }}>
          <label htmlFor="searchId">ID produk</label>
          <input
            id="searchId"
            style={inputStyle}
            type="number"
            min="1"
            required
            value={searchId}
            onChange={(e) => {
              setSearchId(e.target.value);
              setSearched(false);
            }}
            placeholder="Contoh: 1"
          />
          <button type="submit" style={{ ...buttonStyle, marginTop: "12px" }}>
            Periksa Produk
          </button>
        </form>

        {searched && (
          <div style={{ marginTop: "20px" }}>
            {foundProduct ? (
              productDetails(foundProduct)
            ) : (
              <p>ID produk tidak ditemukan di database.</p>
            )}
          </div>
        )}
      </section>

      <details>
        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
          Panel Admin — Kelola Produk
        </summary>

        <section style={{
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "10px",
          marginTop: "16px",
        }}>
          <h2>Tambah Produk Batik</h2>
          <form onSubmit={createProduct}>
            {[
              ["name", "Nama batik"],
              ["artisan", "Nama pengrajin"],
              ["origin", "Asal daerah"],
              ["technique", "Teknik pembuatan"],
              ["motif", "Motif batik"],
            ].map(([key, label]) => (
              <label key={key} style={{
                display: "block",
                marginBottom: "12px",
              }}>
                {label}
                <input
                  style={inputStyle}
                  value={form[key]}
                  required
                  maxLength={150}
                  onChange={(e) => setForm({
                    ...form,
                    [key]: e.target.value,
                  })}
                />
              </label>
            ))}
            <button disabled={loading} style={buttonStyle}>
              {loading ? "Menyimpan..." : "Tambah Produk"}
            </button>
          </form>
        </section>

        <h2>Daftar Produk ({products.length})</h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px",
        }}>
          {products.map((p) => (
            <article key={p.id} style={{
              padding: "16px",
              border: "1px solid #ddd",
              borderRadius: "10px",
              minWidth: 0,
            }}>
              <h3>{p.name}</h3>
              {productDetails(p)}

              <label style={{ display: "block", margin: "12px 0" }}>
                Unggah foto batik
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busyId === p.id}
                  style={{ display: "block", marginTop: "8px" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPhoto(p.id, file);
                    e.target.value = "";
                  }}
                />
              </label>

              <button
                disabled={!p.photo_url || busyId === p.id}
                onClick={() => verifyProduct(p.id)}
                style={{
                  ...buttonStyle,
                  width: "100%",
                  opacity: (!p.photo_url || busyId === p.id) ? 0.5 : 1,
                }}
              >
                {busyId === p.id
                  ? "Memproses..."
                  : "Verifikasi & Catat ke Solana"}
              </button>
            </article>
          ))}
        </div>
      </details>
    </main>
  );
}

