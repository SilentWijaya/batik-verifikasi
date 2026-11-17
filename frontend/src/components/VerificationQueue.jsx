import { useState } from "react";

const PER_PAGE = 5;

function getState(p) {
  if (p.blockchain_id) return "verified";
  if (!p.photo_url) return "nophoto";
  return "ready";
}

const STATE_LABEL = {
  ready: "Siap Diverifikasi",
  nophoto: "Menunggu Foto",
  verified: "Tercatat di Solana",
};

const FILTERS = [
  ["all", "Semua"],
  ["ready", "Siap Diverifikasi"],
  ["nophoto", "Menunggu Foto"],
  ["verified", "Terverifikasi"],
];

export default function VerificationQueue({
  products,
  busyId,
  apiBase,
  onVerify,
  onDetail,
}) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const order = { ready: 0, nophoto: 1, verified: 2 };
  const sorted = [...products].sort(
    (a, b) => order[getState(a)] - order[getState(b)] || b.id - a.id
  );

  const counts = {
    all: products.length,
    ready: products.filter((p) => getState(p) === "ready").length,
    nophoto: products.filter((p) => getState(p) === "nophoto").length,
    verified: products.filter((p) => getState(p) === "verified").length,
  };

  const filtered =
    filter === "all" ? sorted : sorted.filter((p) => getState(p) === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const imgSrc = (url) => (url.startsWith("http") ? url : `${apiBase}${url}`);

  return (
    <section className="vq-section" id="antrean-verifikasi">
      <div className="vq-header">
        <div className="vq-header-left">
          <span className="vq-bar" />
          <div>
            <h2 className="vq-title">Antrean Verifikasi Batik</h2>
            <p className="vq-subtitle">
              Produk yang membutuhkan verifikasi dan pencatatan hash ke Solana
              Devnet.
            </p>
          </div>
        </div>
        <span className="vq-pill">{counts.ready} Siap Diverifikasi</span>
      </div>

      <div className="vq-tabs">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={filter === key ? "active" : ""}
            onClick={() => {
              setFilter(key);
              setPage(1);
            }}
          >
            {label} <b>{counts[key]}</b>
          </button>
        ))}
      </div>

      <div className="vq-table-wrap">
        <table className="vq-table">
          <thead>
            <tr>
              <th>ID & Foto</th>
              <th>Motif & Asal</th>
              <th>Pengrajin</th>
              <th>Analisis AI</th>
              <th>Status</th>
              <th className="vq-right">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="vq-empty">
                  Tidak ada produk pada kategori ini.
                </td>
              </tr>
            )}

            {rows.map((p) => {
              const state = getState(p);
              const busy = busyId === p.id;
              const conf =
                p.ai_confidence != null
                  ? (p.ai_confidence * 100).toFixed(1)
                  : null;

              return (
                <tr key={p.id}>
                  <td>
                    <div className="vq-idcell">
                      <div className="vq-thumb">
                        {p.photo_url ? (
                          <img src={imgSrc(p.photo_url)} alt={`Foto ${p.name}`} />
                        ) : (
                          <span>▧</span>
                        )}
                      </div>
                      <strong className="vq-mono">#{p.id}</strong>
                    </div>
                  </td>

                  <td>
                    <strong>{p.name}</strong>
                    <span className="vq-gold">{p.origin}</span>
                    <small>Motif: {p.motif || "-"}</small>
                  </td>

                  <td>
                    <strong>{p.artisan}</strong>
                    <small>{p.technique}</small>
                  </td>

                  <td>
                    {p.ai_class ? (
                      <>
                        <strong className="vq-conf">
                          {conf}% <i className="vq-dot" />
                        </strong>
                        <small>{p.ai_class}</small>
                      </>
                    ) : (
                      <small>Belum dianalisis</small>
                    )}
                  </td>

                  <td>
                    <span className={`vq-status vq-${state}`}>
                      {STATE_LABEL[state]}
                    </span>
                  </td>

                  <td className="vq-right">
                    <div className="vq-actions">
                      {state !== "verified" ? (
                        <button
                          type="button"
                          className="vq-btn-primary"
                          disabled={state === "nophoto" || busy}
                          onClick={() => onVerify(p.id)}
                          title={
                            state === "nophoto"
                              ? "Unggah foto dulu di katalog"
                              : ""
                          }
                        >
                          {busy ? "Memproses..." : "Verifikasi & Catat"}
                        </button>
                      ) : (
                        <a
                          className="vq-btn-primary vq-link"
                          href={`https://explorer.solana.com/tx/${p.blockchain_id}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Lihat Transaksi ↗
                        </a>
                      )}
                      <button
                        type="button"
                        className="vq-btn-ghost"
                        onClick={() => onDetail(p.id)}
                      >
                        Detail
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="vq-footer">
        <span>
          Menampilkan {rows.length} dari {filtered.length} produk
        </span>
        <div className="vq-pages">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((n) => n - 1)}
          >
            Sebelumnya
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              type="button"
              key={n}
              className={page === n ? "active" : ""}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((n) => n + 1)}
          >
            Selanjutnya
          </button>
        </div>
      </div>
    </section>
  );
}