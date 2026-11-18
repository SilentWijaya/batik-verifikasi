import { useEffect, useRef, useState } from "react";
import "./PusakaBot.css";

/*
 * PusakaBot.jsx
 * Chatbot melayang untuk halaman User. Pakai CSS biasa (PusakaBot.css),
 * tanpa Tailwind dan tanpa font ikon.
 *
 * Mengirim pesan ke backend kamu (POST {apiUrl}), BUKAN langsung ke Groq,
 * jadi API key tetap aman di server.
 */

const MAX_HISTORY = 12;

const QUICK_QUESTIONS = [
  { emoji: "🔍", label: "Cara kerja verifikasi batik" },
  { emoji: "🍯", label: "Ciri lilin malam alami" },
  { emoji: "🏛️", label: "Makna motif Parang" },
];

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

function FormattedText({ text }) {
  const blocks = [];
  let items = [];

  const flush = () => {
    if (!items.length) return;
    blocks.push(
      <ul key={"ul" + blocks.length}>
        {items.map((it, i) => (
          <li key={i}>{renderInline(it)}</li>
        ))}
      </ul>
    );
    items = [];
  };

  text.split("\n").forEach((line) => {
    const m = line.match(/^\s*[-*•]\s+(.*)$/);
    if (m) {
      items.push(m[1]);
    } else {
      flush();
      if (line.trim()) blocks.push(<p key={"p" + blocks.length}>{renderInline(line)}</p>);
    }
  });
  flush();

  return <>{blocks}</>;
}

function errorText(data, fallback) {
  const d = data && (data.detail || data.error);
  return typeof d === "string" ? d : fallback;
}

export default function PusakaBot({ apiUrl, userName = "Pengguna", defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState([]); // { role, content, error? }
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  async function send(raw) {
    const content = (raw || "").trim();
    if (!content || loading) return;

    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setText("");
    setLoading(true);

    const payload = next
      .filter((m) => !m.error)
      .slice(-MAX_HISTORY)
      .map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.reply) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            error: true,
            content: errorText(data, "Maaf, terjadi gangguan. Silakan coba lagi."),
          },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          error: true,
          content: "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="pb-root">
      {open && (
        <section className="pb-window" aria-label="PusakaBot AI">
          <header className="pb-header">
            <div className="pb-header-main">
              <div className="pb-logo">
                <span>🤖</span>
                <i className="pb-dot" />
              </div>
              <div className="pb-title">
                <div className="pb-title-row">
                  <strong>PusakaBot AI</strong>
                  <span className="pb-badge">Online</span>
                </div>
                <small>Asisten Ahli Pakem Batik</small>
              </div>
            </div>
            <button
              type="button"
              className="pb-icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Tutup chat"
              title="Tutup chat"
            >
              ⌄
            </button>
          </header>

          <div className="pb-messages" ref={listRef}>
            <div className="pb-bot-row">
              <div className="pb-avatar">✥</div>
              <div className="pb-col">
                <div className="pb-bubble">
                  <p className="pb-greet">Rahayu, {userName}!</p>
                  <p>
                    Saya dapat membantu menjelaskan ciri batik tulis dan cap, makna motif, serta cara
                    kerja pencatatan produk di platform ini.
                  </p>
                </div>
                <small className="pb-meta">PusakaBot</small>
              </div>
            </div>

            {messages.length === 0 && (
              <div className="pb-chips-box">
                <small className="pb-chips-label">Pilihan cepat</small>
                <div className="pb-chips">
                  {QUICK_QUESTIONS.map((q) => (
                    <button key={q.label} type="button" className="pb-chip" onClick={() => send(q.label)}>
                      <span>{q.emoji}</span> {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div className="pb-user-row" key={i}>
                  <div className="pb-user-bubble">{m.content}</div>
                </div>
              ) : (
                <div className="pb-bot-row" key={i}>
                  <div className="pb-avatar">✥</div>
                  <div className="pb-col">
                    <div className={"pb-bubble" + (m.error ? " pb-error" : "")}>
                      <FormattedText text={m.content} />
                    </div>
                    <small className="pb-meta">PusakaBot</small>
                  </div>
                </div>
              )
            )}

            {loading && (
              <div className="pb-bot-row">
                <div className="pb-avatar">✥</div>
                <div className="pb-bubble pb-typing" aria-label="PusakaBot sedang mengetik">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </div>

          <footer className="pb-footer">
            <div className="pb-input-row">
              <input
                ref={inputRef}
                type="text"
                value={text}
                disabled={loading}
                maxLength={500}
                placeholder="Ketik pertanyaan tentang batik..."
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(text);
                  }
                }}
              />
              <button
                type="button"
                className="pb-send"
                onClick={() => send(text)}
                disabled={loading || !text.trim()}
                aria-label="Kirim pertanyaan"
                title="Kirim pertanyaan"
              >
                ➤
              </button>
            </div>
            <small className="pb-note">Jawaban AI bersifat perkiraan, bukan keputusan verifikasi resmi.</small>
          </footer>
        </section>
      )}

      <button
        type="button"
        className="pb-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "Tutup PusakaBot AI" : "Buka PusakaBot AI"}
      >
        <span className="pb-fab-icon">
          🤖
          <i className="pb-dot pb-dot-fab" />
        </span>
        <strong>Asisten AI</strong>
        <small>Siaga</small>
      </button>
    </div>
  );
}
