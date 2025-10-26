"use client";
import { useState } from "react";

export default function Home() {
  const [scale, setScale] = useState("");
  const [urlsText, setUrlsText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedImages, setUsedImages] = useState<string[]>([]);

  // --- Client-side compression to ~2–3 MB per image
  async function compressImage(file: File, targetMB = 2.5): Promise<File> {
    if (file.size <= targetMB * 1024 * 1024) return file; // already small
    const bmp = await createImageBitmap(file);
    // compute scale by area (rough)
    const scale = Math.min(1, Math.sqrt((targetMB * 1024 * 1024) / file.size));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.85);
    });
  }

  async function uploadFilesIfAny(): Promise<string[]> {
    if (!files || files.length === 0) return [];
    const body = new FormData();
    for (const f of Array.from(files)) {
      const compressed = await compressImage(f, 2.5);
      body.append('file', compressed);
    }
    const r = await fetch('/api/upload', { method: 'POST', body });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    return data.urls as string[];
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    try {
      const uploaded = await uploadFilesIfAny();
      const typedUrls = urlsText.split(/\s+/).filter(Boolean);
      const image_urls = [...uploaded, ...typedUrls];
      if (image_urls.length === 0) throw new Error('Please add at least one image (upload or paste URLs).');
      const scale_meters = scale ? parseFloat(scale) : null;

      const resp = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_urls, scale_meters })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Quote failed');
      setUsedImages(image_urls);
      setResult(json);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Patio Pressure-Wash Quote</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>Upload 1–5 photos and (optionally) one real dimension for better accuracy. Your estimate appears below instantly.</p>

      <form onSubmit={onSubmit} style={{ display:'grid', gap:12, background:'#121833', padding:16, borderRadius:12, boxShadow:'0 6px 24px rgba(0,0,0,0.3)'}}>
        <label>Upload images (JPG/PNG, up to 5)
          <input type="file" accept="image/*" multiple onChange={e=>setFiles(e.target.files)} />
        </label>

        <label>…or paste image URLs (one per line)
          <textarea value={urlsText} onChange={e=>setUrlsText(e.target.value)} rows={4} placeholder="https://…/patio1.jpg\nhttps://…/patio2.jpg" style={{ width:'100%', padding:10, borderRadius:8 }} />
        </label>

        <label>Known dimension (meters) — optional
          <input type="number" step="0.01" value={scale} onChange={e=>setScale(e.target.value)} placeholder="e.g., 3.2" style={{ width:'100%', padding:10, borderRadius:8 }} />
        </label>

        <button disabled={busy} style={{ padding:'10px 14px', borderRadius:10, background:'#4f7cff', color:'#fff', fontWeight:700 }}>
          {busy? 'Processing…' : 'Get Instant Estimate'}
        </button>
      </form>

      {error && <p style={{ color:'#ff9494', marginTop:12 }}>{error}</p>}

      {result && (
        <div style={{ marginTop:16, background:'#0f1530', padding:16, borderRadius:12 }}>
          <h3 style={{ marginTop:0 }}>Your Estimate</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:28, fontWeight:800 }}>{result.price} {result.currency}</div>
              <div style={{ opacity:.8, marginTop:6 }}>Based on {Math.round(result.model.areaGuess_m2)} m² ({result.model.areaLow_m2.toFixed(1)}–{result.model.areaHigh_m2.toFixed(1)} m²)</div>
              <div style={{ marginTop:6 }}><strong>Cleanliness:</strong> {result.model.cleanliness}</div>
              <div style={{ opacity:.8 }}>Confidence: {(result.model.confidence*100).toFixed(0)}%</div>
              <div style={{ marginTop:10, fontSize:12, opacity:.7 }}>Automated estimate from photos. On-site confirmation may adjust.</div>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {usedImages.map((u, i) => (
                <img key={i} src={u} alt={`uploaded-${i}`} style={{ width:120, height:90, objectFit:'cover', borderRadius:8, border:'1px solid #1f2a56' }} />
              ))}
            </div>
          </div>
          {result.model.notes && (
            <pre style={{ whiteSpace:'pre-wrap', marginTop:12, opacity:.8 }}>{result.model.notes}</pre>
          )}
        </div>
      )}

      <footer style={{ opacity:0.6, marginTop:28, fontSize:12 }}>
        This demo shows results on-page. Add email later if needed.
      </footer>
    </main>
  );
}