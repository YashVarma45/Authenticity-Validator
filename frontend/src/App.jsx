import React, { useState } from "react";
import { motion } from "framer-motion";

// ---------- i18n (plain strings, no translate: wrappers) ----------
const dict = {
  en: {
    brand: "Smart Certificate Verification Platform",
    nav: ["Home","Verify","Institution","Admin"],
    heroLine1: "Verify Certificates",
    heroWith: "with",
    heroTT: "Trust & Technology",
    heroDesc: "AI-powered OCR meets registry cross-checking for instant authenticity validation.",
    cta: "Start Verification",
    verifyTitle: "Upload & Verify Certificate",
    verifySub: "AI-assisted OCR with registry cross-check for a clear Verified/Suspect verdict.",
    chooseFile: "Choose file",
    noFile: "No file chosen",
    verifying: "Verifying...",
    verifyNow: "Verify Now",
    reportTitle: "Verification Report",
    reportNote: "AI-assisted OCR with registry cross-check.",
    score: "Score",
    status: "Status",
    verdict: "Verdict",
    issues: "Issues",
    extractedText: "Extracted Text",
    institutionTitle: "Institution",
    institutionDesc: "Demo-only: publish issued certificates to the mock registry for verification.",
    adminTitle: "Admin",
    adminDesc: "Recent verifications (last 10). This is a demo-only, in-memory log.",
    roadmap: "Roadmap: Tamper detection (seals/signatures), Blockchain issuance, Role-based access.",
    registrySize: "Registry Size",
    publish: "Publish",
    required: "Required",
    issuedOn: "Issued On (YYYY-MM-DD)",
    marksLabel: "Marks (0–100 or %)",
    certId: "Certificate ID",
    rollNo: "Roll No.",
    name: "Name",
    course: "Course",
    time: "Time",
    statusField: "Status",
    downloadCSV: "Download CSV",
    recordPublished: "Record published."
  },
  hi: {
    brand: "स्मार्ट प्रमाणपत्र सत्यापन प्लेटफ़ॉर्म",
    nav: ["होम","सत्यापित करें","संस्था","एडमिन"],
    heroLine1: "प्रमाणपत्र सत्यापित करें",
    heroWith: "के साथ",
    heroTT: "ट्रस्ट और टेक्नोलॉजी",
    heroDesc: "एआई संचालित OCR और रजिस्ट्री क्रॉस-चेक के साथ त्वरित प्रामाणिकता सत्यापन।",
    cta: "सत्यापन शुरू करें",
    verifyTitle: "अपलोड करें और प्रमाणपत्र सत्यापित करें",
    verifySub: "एआई-सहायता प्राप्त OCR और रजिस्ट्री क्रॉस-चेक से स्पष्ट Verified/Suspect परिणाम।",
    chooseFile: "फ़ाइल चुनें",
    noFile: "कोई फ़ाइल चयनित नहीं",
    verifying: "सत्यापन हो रहा है...",
    verifyNow: "अभी सत्यापित करें",
    reportTitle: "सत्यापन रिपोर्ट",
    reportNote: "एआई-सहायता प्राप्त OCR और रजिस्ट्री क्रॉस-चेक।",
    score: "स्कोर",
    status: "स्थिति",
    verdict: "निर्णय",
    issues: "समस्याएँ",
    extractedText: "निकाला गया पाठ",
    institutionTitle: "संस्था",
    institutionDesc: "डेमो हेतु: जारी प्रमाणपत्रों को मॉक रजिस्ट्री में प्रकाशित करें।",
    adminTitle: "एडमिन",
    adminDesc: "हाल के सत्यापन (अंतिम 10)। यह डेमो-ओनली, इन-मेमोरी लॉग है।",
    roadmap: "रोडमैप: टैम्पर डिटेक्शन, ब्लॉकचेन इश्यूअन्स, रोल-आधारित एक्सेस।",
    registrySize: "रजिस्ट्री आकार",
    publish: "प्रकाशित करें",
    required: "आवश्यक",
    issuedOn: "जारी तिथि (YYYY-MM-DD)",
    marksLabel: "अंक (0–100 या %)",
    certId: "प्रमाणपत्र आईडी",
    rollNo: "रोल नंबर",
    name: "नाम",
    course: "पाठ्यक्रम",
    time: "समय",
    statusField: "स्थिति",
    downloadCSV: "CSV डाउनलोड करें",
    recordPublished: "रिकॉर्ड प्रकाशित हो गया।"
  }
};

// Validation helpers
const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMarks = (s) => {
  const m = String(s).trim().match(/^(\d{1,3})(?:\.(\d{1,2}))?%?$/);
  if (!m) return false;
  const n = parseFloat(m[1] + (m[2] ? "." + m[2] : ""));
  return n >= 0 && n <= 100;
};

// Admin logs component
function AdminLogs({ t }) {
  const [items, setItems] = React.useState([]);
  const load = async () => {
    try {
      const res = await fetch("http://localhost:5000/logs");
      const data = await res.json();
      setItems(data.items || []);
    } catch {}
  };
  React.useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="max-w-3xl">
      {items.length === 0 && <p className="text-white/60">No entries yet.</p>}
      {items.map((it, i) => (
        <div key={i} className="mb-3 p-4 rounded bg-black/40">
          <p><strong>{t.time}:</strong> {new Date(it.ts).toLocaleString()}</p>
          <p><strong>Verdict:</strong> {it.verdict} | <strong>{t.score}:</strong> {it.score}%</p>
          <p><strong>{t.certId}:</strong> {it.certificateId ?? "—"} | <strong>{t.rollNo}:</strong> {it.rollNo ?? "—"}</p>
          <p><strong>{t.statusField}:</strong> {it.status}</p>
        </div>
      ))}
    </div>
  );
}

// Institution form with validation
function InstitutionForm({ t }) {
  const [form, setForm] = React.useState({
    certificateId: "",
    rollNo: "",
    name: "",
    course: "",
    issuedOn: "",
    marks: ""
  });
  const [msg, setMsg] = React.useState("");
  const [count, setCount] = React.useState(0);
  const [errors, setErrors] = React.useState({});

  const loadCount = async () => {
    try {
      const r = await fetch("http://localhost:5000/registry-count");
      const j = await r.json();
      setCount(j.count ?? 0);
    } catch {}
  };
  React.useEffect(() => { loadCount(); }, []);

  const validate = (f) => {
    const er = {};
    if (!f.certificateId.trim()) er.certificateId = t.required;
    if (!f.rollNo.trim()) er.rollNo = t.required;
    if (!f.name.trim()) er.name = t.required;
    if (!f.course.trim()) er.course = t.required;
    if (!f.issuedOn.trim()) er.issuedOn = t.required;
    else if (!isISODate(f.issuedOn)) er.issuedOn = "Use YYYY-MM-DD";
    if (!f.marks.trim()) er.marks = t.required;
    else if (!isMarks(f.marks)) er.marks = "0–100 or %";
    return er;
  };

  const onChange = (e) => {
    const next = { ...form, [e.target.name]: e.target.value };
    setForm(next);
    setErrors(validate(next));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const er = validate(form);
    setErrors(er);
    if (Object.keys(er).length) return;
    setMsg("");
    try {
      const r = await fetch("http://localhost:5000/publish-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Publish failed");
      setMsg(t.recordPublished);
      setForm({ certificateId:"", rollNo:"", name:"", course:"", issuedOn:"", marks:"" });
      setErrors({});
      loadCount();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const Input = ({name,label,placeholder=""}) => (
    <div className="flex flex-col">
      <label className="text-sm text-white/70 mb-1">{label}</label>
      <input
        name={name}
        value={form[name]}
        onChange={onChange}
        placeholder={placeholder}
        className={`px-3 py-2 rounded bg-black/50 border ${errors[name] ? "border-red-400" : "border-white/10"}`}
        required
      />
      {errors[name] && <span className="text-sm text-red-300 mt-1">{errors[name]}</span>}
    </div>
  );

  const valid = Object.keys(validate(form)).length === 0;

  return (
    <div className="max-w-3xl">
      <p className="mb-3 text-white/70"><strong>{t.registrySize}:</strong> {count}</p>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/40 p-6 rounded">
        <Input name="certificateId" label={t.certId} placeholder="CERT-2020-3344" />
        <Input name="rollNo" label={t.rollNo} placeholder="JH/2019/0456" />
        <Input name="name" label={t.name} placeholder="Ramesh Kumar" />
        <Input name="course" label={t.course} placeholder="B.Tech (CSE)" />
        <Input name="issuedOn" label={t.issuedOn} placeholder="2020-07-15" />
        <Input name="marks" label={t.marksLabel} placeholder="78.2%" />
        <div className="md:col-span-2">
          <button className={`px-6 py-3 rounded font-semibold ${valid ? "bg-yellow-400 text-black" : "bg-gray-500 text-white cursor-not-allowed"}`} disabled={!valid}>
            {t.publish}
          </button>
          {msg && <span className="ml-3 text-white/80">{msg}</span>}
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState("en");
  const t = dict[lang];

  const [file, setFile] = useState(null);
  const [fileLabel, setFileLabel] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Please choose a file first.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("certificate", file);
      const res = await fetch("http://localhost:5000/verify", { method: "POST", body: formData, mode: "cors" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Request failed: ${res.status} ${res.statusText} ${text}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, value }) => (
    <p className="text-lg">
      <strong>{label}:</strong> {value ?? "—"}
    </p>
  );

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
    setFileLabel(f ? f.name : null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-900 text-white font-sans overflow-x-hidden">
      {/* Navbar */}
      <header className="fixed w-full top-0 left-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-yellow-400 to-pink-400 text-transparent bg-clip-text">
            {t.brand}
          </motion.h1>
          <div className="flex items-center gap-6">
            <nav className="space-x-8 hidden md:flex text-lg">
              {t.nav.map((item, i) => (
                <motion.a key={i} href={`#${dict.en.nav[i].toLowerCase()}`} whileHover={{ scale: 1.1, color: "#facc15" }} transition={{ type: "spring", stiffness: 300 }} className="cursor-pointer font-medium">
                  {item}
                </motion.a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <button onClick={()=>setLang("en")} className={`px-2 py-1 rounded ${lang==="en"?"bg-yellow-400 text-black":"bg-white/10"}`}>EN</button>
              <button onClick={()=>setLang("hi")} className={`px-2 py-1 rounded ${lang==="hi"?"bg-yellow-400 text-black":"bg-white/10"}`}>HI</button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="h-screen flex flex-col items-center justify-center text-center px-6">
        <motion.h2 initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="text-6xl font-extrabold leading-tight">
          {t.heroLine1} <br /> {t.heroWith}{" "}
          <span className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
            {t.heroTT}
          </span>
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 1 }} className="mt-6 text-xl max-w-3xl text-white/80">
          {t.heroDesc}
        </motion.p>
        <motion.a href="#verify" whileHover={{ scale: 1.1 }} className="mt-10 inline-block px-10 py-4 bg-yellow-400 text-black font-semibold rounded-full shadow-lg hover:shadow-yellow-500/50 transition">
          {t.cta}
        </motion.a>
      </section>

      {/* Verify */}
      <section id="verify" className="min-h-screen px-6 py-20 bg-black/40 backdrop-blur-xl rounded-t-3xl">
        <h3 className="text-4xl font-bold text-center mb-2">{t.verifyTitle}</h3>
        <p className="text-center text-white/70 mb-10">{t.verifySub}</p>
        <motion.form onSubmit={handleUpload} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-2xl mx-auto glass p-10">
          <label className="block w-full mb-2 text-sm text-white">{t.chooseFile}</label>
          <input type="file" accept="image/*,.pdf" onChange={onFileChange} className="block w-full mb-2 text-sm text-white file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-yellow-400 file:to-pink-500 file:text-black hover:file:opacity-90" />
          <p className="text-white/70 mb-6 text-sm">{fileLabel || t.noFile}</p>
          <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-bold rounded-xl hover:scale-[1.02] transition disabled:opacity-60">
            {loading ? t.verifying : t.verifyNow}
          </button>
          {error && <p className="mt-4 text-red-300 text-sm">{error}</p>}
        </motion.form>

        {result && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mt-14 max-w-3xl mx-auto glass p-10">
            <h4 className="text-3xl font-bold mb-2">{t.reportTitle}</h4>
            <p className="text-white/60 mb-6">{t.reportNote}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-lg"><strong>{t.score}:</strong> {result.score ?? "N/A"}%</p>
                <p className="text-lg"><strong>{t.status}:</strong> {result.status ?? "Unknown"}</p>
                {result.verdict && <p className="text-lg"><strong>{t.verdict}:</strong> {result.verdict}</p>}
                {Array.isArray(result.issues) && result.issues.length > 0 && (
                  <p className="text-lg"><strong>{t.issues}:</strong> {result.issues.slice(0, 2).join(" • ")}</p>
                )}
              </div>
              <div>
                {result.extracted && Object.entries(result.extracted).map(([k, v]) => (
                  <Field key={k} label={k} value={v} />
                ))}
              </div>
            </div>

            {result.text && (
              <div className="mt-6">
                <strong>{t.extractedText}:</strong>
                <p className="mt-2 p-4 bg-black/40 rounded">{result.text}</p>
              </div>
            )}
          </motion.div>
        )}
      </section>

      {/* Institution */}
      <section id="institution" className="px-6 py-20">
        <h3 className="text-3xl font-bold mb-4">{t.institutionTitle}</h3>
        <p className="text-white/80 mb-4">{t.institutionDesc}</p>
        <InstitutionForm t={t} />
      </section>

      {/* Admin */}
      <section id="admin" className="px-6 py-20">
        <h3 className="text-3xl font-bold mb-2">{t.adminTitle}</h3>
        <p className="text-white/80 mb-4">{t.adminDesc}</p>
        <div className="mb-4">
          <a href="http://localhost:5000/export-logs.csv" className="px-4 py-2 bg-yellow-400 text-black rounded font-semibold">
            {t.downloadCSV}
          </a>
        </div>
        <AdminLogs t={t} />
        <p className="text-white/50 mt-6 text-sm">{t.roadmap}</p>
      </section>

      {/* Footer */}
      <footer className="bg-black/40 backdrop-blur-md text-center py-8 mt-20 border-t border-white/10">
        <p className="text-white/70">
          © {new Date().getFullYear()} Jharkhand Higher Education · Built with ❤️ and Trust
        </p>
      </footer>
    </div>
  );
}
