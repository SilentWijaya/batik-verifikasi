
export default function DetectionAI({
  aiPhoto,
  aiPreview,
  aiLoading,
  aiMessage,
  aiResult,
  selectAiPhoto,
  detectBatik,
  findAiKnowledge,
}) {
  return (
    <section className="feature-section" id="deteksi-ai">
      {/* JUDUL SECTION */}
      <div className="section-heading">
        <div>
          <h2>Deteksi Jenis Batik dengan AI</h2>
          <p>
            Unggah foto kain atau pola batik untuk mengenali
            jenis batik menggunakan model AI Roboflow.
          </p>
        </div>
      </div>

      {/* FORM DETEKSI */}
      <form onSubmit={detectBatik}>
        
<div className="ai-workspace">
  <div className="ai-upload-area">
    
<div className="upload-box">
  <input
    id="batik-file-input"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={(e) =>
      selectAiPhoto(e.target.files?.[0])
    }
  />

  <div className="preview-header">
    <div>
      <span className="preview-eyebrow">
        VISUAL ANALYSIS
      </span>
      <h3>Pratinjau Foto</h3>
    </div>

    <span className={`preview-status ${aiPreview ? "is-ready" : ""}`}>
      {aiPreview ? "Image Ready" : "Waiting Image"}
    </span>
  </div>

  {aiPreview ? (
    <div className="preview-image-card">
      <img
        src={aiPreview}
        alt="Preview batik"
        className="ai-preview-image"
      />
    </div>
  ) : (
    <div className="empty-preview">
      <div className="empty-preview-icon">↑</div>
      <strong>Belum Ada Foto</strong>
      <p>Unggah foto batik untuk memulai deteksi.</p>
    </div>
  )}

  <strong>
    {aiPhoto ? aiPhoto.name : "Pilih Foto Batik"}
  </strong>

  <small>JPG, PNG, WEBP • Maksimal 10 MB</small>

  <label
    htmlFor="batik-file-input"
    className="upload-button"
  >
    Unggah Foto
  </label>
</div>


    <button
      type="submit"
      className="primary-button detect-button"
      disabled={!aiPhoto || aiLoading}
    >
      {aiLoading
        ? "Sedang Menganalisis..."
        : "Deteksi Jenis Batik"}
    </button>
  </div>
</div>

   

        {/* PESAN STATUS / ERROR */}
        {aiMessage && (
          <div className="ai-message">
            {aiMessage}
          </div>
        )}
      </form>

      {/* HASIL ANALISIS AI */}
      {aiResult.length > 0 && (
        <div className="ai-results">
          <h3>Hasil Analisis Model</h3>

          {aiResult.map((prediction, index) => {
            const knowledge = findAiKnowledge(
              prediction.class
            );

            const confidence = Math.min(
              100,
              Math.max(
                0,
                prediction.confidence * 100
              )
            );

            return (
              <article
                className="analysis-card"
                key={prediction.detection_id || index}
              >
                {/* HEADER HASIL */}
                <div className="analysis-header">
                  <h3>
                    <span className="analysis-icon">
                      ✣
                    </span>
                    Hasil Analisis Model
                  </h3>

                  <span className="analysis-status">
                    <span className="status-dot"></span>
                    Inference Ready
                  </span>
                </div>

                {/* FOTO BATIK */}
                {aiPreview && (
                  <div className="analysis-image">
                    <img
                      src={aiPreview}
                      alt="Foto batik yang dianalisis"
                    />

                    <div className="analysis-image-overlay">
                      <span>POLA TERDETEKSI</span>
                      <strong>{prediction.class}</strong>
                    </div>
                  </div>
                )}

                {/* TINGKAT KEYAKINAN */}
                <div className="analysis-confidence">
                  <div className="confidence-heading">
                    <span>
                      Tingkat Keyakinan (Confidence)
                    </span>

                    <strong>
                      {confidence.toFixed(1)}% Akurat
                    </strong>
                  </div>

                  <div className="analysis-progress">
                    <div
                      className="analysis-progress-value"
                      style={{
                        width: `${confidence}%`,
                      }}
                    />
                  </div>
                </div>

                {/* PENGETAHUAN LOKAL */}
                <div className="analysis-information">
                  {knowledge ? (
                    <>
                      <div className="information-grid">
                        <div className="information-item">
                          <span>Kelas Batik</span>

                          <strong>
                            {knowledge.class_name}
                          </strong>
                        </div>

                        <div className="information-item">
                          <span>Proses Produksi</span>

                          <strong>
                            {knowledge.production_process ||
                              "Belum tersedia"}
                          </strong>
                        </div>
                      </div>

                      <div className="motif-description">
                        <h4>
                          <span>▤</span>
                          Pengetahuan Lokal
                        </h4>

                        <p>{knowledge.definition}</p>
                      </div>

                      {knowledge.visual_characteristics && (
                        <div className="motif-detail">
                          <strong>
                            Karakteristik Visual
                          </strong>

                          <p>
                            {knowledge.visual_characteristics}
                          </p>
                        </div>
                      )}

                      {knowledge.classification_note && (
                        <div className="motif-detail">
                          <strong>
                            Catatan Klasifikasi
                          </strong>

                          <p>
                            {knowledge.classification_note}
                          </p>
                        </div>
                      )}

                      {knowledge.source && (
                        <div className="motif-source">
                          Sumber: {knowledge.source}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="motif-description">
                      <h4>Pengetahuan Lokal</h4>

                      <p>
                        Pengetahuan lokal untuk kelas{" "}
                        {prediction.class} belum tersedia.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {/* CATATAN CONFIDENCE */}
          <small className="confidence-note">
            Confidence merupakan tingkat keyakinan model,
            bukan bukti mutlak keaslian batik.
          </small>
        </div>
      )}
    </section>
  );
}
