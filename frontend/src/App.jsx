import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

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
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function loadProducts() {
    try {
      const res = await fetch(`${API}/api/products`);
      const data = await res.json();
      if (!res.ok) throw new Error("Gagal memuat produk");
      setProducts(data.products || []);
    } catch (err) {
      setMessage(`Gagal menghubungi backend: ${err.message}`);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

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
      if (!res.ok) {
        throw new Error(data.detail || "Gagal menambahkan produk");
      }

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
      if (!res.ok) {
        throw new Error(data.detail || "Gagal mengunggah foto");
      }

      setMessage("Foto berhasil diunggah. Produk siap diverifikasi.");
      await loadProducts();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function verifyProduct(id) {
    if (!window.confirm(
      "Catat hash produk ini ke Solana Devnet?"
    )) return;

    setBusyId(id);
    setMessage("Sedang memverifikasi dan mencatat ke blockchain...");

    try {
      const res = await fetch(`${API}/api/products/${id}/verify`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Verifikasi gagal");
      }

      setMessage(
        `Berhasil! Produk ID ${id} tercatat di Solana Devnet.`
      );
      await loadProducts();
    } catch (err) {
      setMessage(`Verifikasi gagal: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px",
    marginTop: "5px",
    boxSizing: "border-box",
    border: "1px solid #ccc",
    borderRadius: "6px",
  };

  const buttonStyle = {
    padding: "10px 14px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    color: "white",
    background: "#176b45",
  };

  return (
    <main style={{
      maxWidth: "1000px",
      margin: "30px auto",
      padding: "0 18px",
      fontFamily: "Arial, sans-serif",
      color: "#222",
    }}>
      <h1>Verifikasi Keaslian Batik</h1>
      <p>
        Pencatatan hash data dan foto produk ke Solana Devnet.
      </p>

      {message && (
        <div style={{
          padding: "12px",
          margin: "16px 0",
          borderRadius: "6px",
          background: "#f0f5f0",
          overflowWrap: "anywhere",
        }}>
          {message}
        </div>
      )}

      <section style={{
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "10px",
        marginBottom: "28px",
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

          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? "Menyimpan..." : "Tambah Produk"}
          </button>
        </form>
      </section>

      <h2>Daftar Produk ({products.length})</h2>

      {products.length === 0 && (
        <p>Belum ada produk batik.</p>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "18px",
      }}>
        {products.map((p) => (
          <article key={p.id} style={{
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "16px",
            minWidth: 0,
          }}>
            <h3>{p.name}</h3>
            <p><b>ID:</b> {p.id}</p>
            <p><b>Pengrajin:</b> {p.artisan}</p>
            <p><b>Asal:</b> {p.origin}</p>
            <p><b>Teknik:</b> {p.technique}</p>
            <p><b>Motif:</b> {p.motif}</p>

            {p.photo_url ? (
              <img
                src={`${API}${p.photo_url}`}
                alt={`Foto ${p.name}`}
                style={{
                  width: "100%",
                  maxHeight: "260px",
                  objectFit: "contain",
                  borderRadius: "6px",
                  background: "#f5f5f5",
                }}
              />
            ) : (
              <p>Foto belum diunggah.</p>
            )}

            <label style={{
              display: "block",
              margin: "12px 0",
            }}>
              Unggah foto (JPG, PNG, WEBP)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busyId === p.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadPhoto(p.id, file);
                  e.target.value = "";
                }}
                style={{ display: "block", marginTop: "8px" }}
              />
            </label>

            <p>
              <b>Status:</b> {p.status}
            </p>

            <button
              type="button"
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

            {p.blockchain_id && (
              <div style={{
                marginTop: "14px",
                overflowWrap: "anywhere",
              }}>
                <p><b>Hash produk:</b></p>
                <code style={{ fontSize: "12px" }}>
                  {p.product_hash || "Tidak tersedia"}
                </code>

                <p><b>Signature transaksi:</b></p>
                <code style={{ fontSize: "12px" }}>
                  {p.blockchain_id}
                </code>

                <p>
                  <a
                    href={`https://explorer.solana.com/tx/${p.blockchain_id}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lihat transaksi di Solana Explorer
                  </a>
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
