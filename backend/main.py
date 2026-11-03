
    
  
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

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
    if (!res.ok) throw new Error(data.detail || "Gagal memuat pengetahuan AI");
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

