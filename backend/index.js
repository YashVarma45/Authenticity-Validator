// Core deps
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const Tesseract = require("tesseract.js");
const pdfParse = require("pdf-parse");

// MongoDB
const { MongoClient } = require("mongodb");
const MONGO_URI = process.env.MONGODB_URI;

// App
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// uploads/
const upload = multer({ dest: path.join(__dirname, "uploads") });

// ---------------- In-memory fallback (kept for safety) ----------------
const memLogs = [];
function addMemLog(entry) {
  memLogs.unshift(entry);
  if (memLogs.length > 100) memLogs.pop();
}

// Registry file fallback
let registry = loadRegistry();
function loadRegistry() {
  const p = path.join(__dirname, "registry.json");
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return []; }
}
function saveRegistry(next) {
  const p = path.join(__dirname, "registry.json");
  fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf8");
  registry = next;
}

// ---------------- Mongo connection (persistence) ----------------
let db, logsCol, registryCol;

async function initMongo() {
  if (!MONGO_URI) {
    console.warn("MONGODB_URI not set; running with in-memory fallback only");
    return;
  }
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const dbNameFromUri = (MONGO_URI.split(".net/")[1] || "app").split("?")[0] || "app";
  db = client.db(dbNameFromUri);
  logsCol = db.collection("logs");
  registryCol = db.collection("registry");
  console.log("MongoDB connected:", db.databaseName);
}
initMongo().catch(err => console.error("Mongo connect failed:", err));

// ---------------- Utilities ----------------
function norm(s = "") { return String(s).toLowerCase().replace(/\s+/g, " ").trim(); }
function normRoll(s = "") { return String(s).toUpperCase().replace(/[^A-Z0-9/]/g, "").trim(); }
function toISODateLike(s = "") {
  const t = String(s).trim();
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(t)) return t.replace(/\//g, "-");
  const m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const mon = m[2].toLowerCase().slice(0, 3);
    const map = { jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", sept:"09", oct:"10", nov:"11", dec:"12" };
    const month = map[mon];
    if (month) return `${m[3]}-${month}-${day}`;
  }
  return t;
}
function normMarks(s = "") {
  const m = String(s).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Number.parseFloat(m[1]).toFixed(1);
}

// ---------------- Parsing ----------------
function parseFieldsFromText(text = "") {
  const raw = text.replace(/\r/g, "");
  const clean = raw.replace(/[·•]+/g, ".").replace(/[–—−]/g, "-");
  const pick = (re) => { const m = clean.match(re); return m ? m[1].trim() : null; };

  const name = pick(/(?:^|\n)\s*(?:Name|Student\s*Name|Candidate\s*Name)\s*[:\-]\s*(.+)/i);
  const certId = pick(/(?:^|\n)\s*(?:Certificate(?:\s*ID)?|Cert(?:ificate)?\s*(?:No|#)|Cert\.?\s*No\.?)\s*[:\-]\s*([A-Z0-9\-]+)/i);
  const course = pick(/(?:^|\n)\s*(?:Course|Program|Programme|Degree)\s*[:\-]\s*(.+)/i);
  const marks = pick(/(?:^|\n)\s*(?:Marks|Percentage|CGPA|Score)\s*[:\-]\s*([0-9]+(?:\.[0-9]+)?%?)/i);

  let roll = null;
  const rollLine = pick(/(?:^|\n)\s*(?:Roll\s*No\.?|Enrollment\s*No\.?|Enroll(?:ment)?|Reg(?:istration)?\s*No\.?|Reg\.?\s*No\.?)\s*[:\-]\s*(.+)/i);
  if (rollLine) {
    const m = rollLine.match(/[A-Z]{1,5}\/\d{2,4}\/\d{3,6}/i);
    if (m) roll = m[0];
  }

  let date = pick(/(?:^|\n)\s*(?:Issued\s*On|Issue\s*Date|Date\s*of\s*Issue|Date)\s*[:\-]\s*([0-9]{4}[-\/][0-9]{2}[-\/][0-9]{2}|[0-9]{2}[-\/][0-9]{2}[-\/][0-9]{4})/i);
  if (!date) {
    const m2 = clean.match(/(\b[0-3]?\d\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b)/i);
    if (m2) date = m2[1].trim();
  }

  const lines = clean.split(/\n+/).map(s => s.trim()).filter(Boolean);

  let certId2 = certId;
  if (!certId2) {
    const hit = lines.map(l => l.match(/\b[A-Z]{3,5}-\d{4}-\d{3,5}\b/)).find(Boolean);
    if (hit && hit[0]) certId2 = hit[0];
  }

  let roll2 = roll;
  if (!roll2) {
    const hit = lines.map(l => l.match(/[A-Z]{1,5}\/\d{2,4}\/\d{3,6}/i)).find(Boolean);
    if (hit && hit[0]) roll2 = hit[0];
  }

  return {
    Name: name,
    "Roll No.": roll2 || roll,
    "Certificate ID": certId2 || certId,
    Course: course,
    Marks: marks,
    "Issued On": date,
  };
}

function scoreExtracted(extracted) {
  const keys = ["Name", "Roll No.", "Certificate ID", "Course", "Marks", "Issued On"];
  const found = keys.filter(k => extracted?.[k]);
  return Math.round((found.length / keys.length) * 100);
}

function matchAgainstRegistry(extracted) {
  const id = extracted["Certificate ID"];
  const roll = extracted["Roll No."];

  const candidate = registry.find(r =>
    (id && norm(r.certificateId) === norm(id)) ||
    (roll && normRoll(r.rollNo) === normRoll(roll))
  );

  if (!candidate) {
    return { verdict: "Unverifiable", issues: ["No matching record in registry"], matchScore: 0, hadMismatch: true };
  }

  const checks = [
    { key: "certificateId", label: "Certificate ID", weight: 0.32, cmp: (e,g)=>norm(e)===norm(g) },
    { key: "rollNo",       label: "Roll No.",       weight: 0.28, cmp: (e,g)=>normRoll(e)===normRoll(g) },
    { key: "name",         label: "Name",           weight: 0.18, cmp: (e,g)=>norm(e)===norm(g) },
    { key: "issuedOn",     label: "Issued On",      weight: 0.12, cmp: (e,g)=>norm(toISODateLike(e))===norm(toISODateLike(g)) },
    { key: "course",       label: "Course",         weight: 0.05, cmp: (e,g)=>norm(e)===norm(g) },
    { key: "marks",        label: "Marks",          weight: 0.05, cmp: (e,g)=>normMarks(e)===normMarks(g) }
  ];

  let score = 0;
  const issues = [];
  let hadMismatch = false;

  for (const c of checks) {
    const expected = candidate[c.key];
    const got = extracted[c.label];
    const ok = expected && got && c.cmp(expected, got);
    if (ok) score += c.weight;
    else {
      hadMismatch = true;
      issues.push(expected ? `${c.label} mismatch (expected "${expected}")` : `${c.label} missing`);
    }
  }

  const matchScore = Math.round(score * 100);
  const verdict = hadMismatch ? (matchScore >= 50 ? "Suspect" : "Unverifiable") : "Verified";
  return { verdict, issues: issues.slice(0, 3), matchScore, hadMismatch };
}

// ---------------- Routes ----------------
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Logs (Mongo preferred, fallback to memory)
app.get("/logs", async (req, res) => {
  try {
    if (logsCol) {
      const items = await logsCol.find({}, { projection: { _id: 0 } })
        .sort({ ts: -1 }).limit(10).toArray();
      return res.json({ items });
    }
    return res.json({ items: memLogs.slice(0, 10) });
  } catch (e) {
    return res.status(500).json({ error: "logs read failed" });
  }
});

app.get("/registry-count", async (req, res) => {
  try {
    if (registryCol) {
      const count = await registryCol.estimatedDocumentCount();
      return res.json({ count });
    }
    return res.json({ count: registry.length });
  } catch (e) {
    return res.status(500).json({ error: "count failed" });
  }
});

// CSV export of logs
app.get("/export-logs.csv", async (req, res) => {
  try {
    const items = logsCol
      ? await logsCol.find({}, { projection: { _id: 0 } }).sort({ ts: -1 }).limit(1000).toArray()
      : memLogs;
    const header = "ts,verdict,score,certificateId,rollNo,status\n";
    const rows = items.map(l =>
      [l.ts, l.verdict, l.score, l.certificateId || "", l.rollNo || "", l.status || ""]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=\"verification-logs.csv\"");
    return res.send(header + rows + "\n");
  } catch (e) {
    return res.status(500).send("csv export failed");
  }
});

// Publish record -> registry (Mongo preferred)
app.post("/publish-record", async (req, res) => {
  const rec = req.body || {};
  const required = ["certificateId","rollNo","name","course","issuedOn","marks"];
  const missing = required.filter(k => !rec[k]);
  if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });

  try {
    if (registryCol) {
      await registryCol.updateOne(
        { $or: [{ certificateId: rec.certificateId }, { rollNo: rec.rollNo }] },
        { $set: { ...rec, ts: new Date() } },
        { upsert: true }
      );
      const count = await registryCol.estimatedDocumentCount();
      return res.json({ ok: true, count });
    }
    // fallback to file
    const dup = registry.find(r => r.certificateId === rec.certificateId || r.rollNo === rec.rollNo);
    if (dup) return res.status(409).json({ error: "Record with same certificateId or rollNo already exists" });
    const next = [rec, ...registry];
    saveRegistry(next);
    return res.json({ ok: true, count: registry.length });
  } catch (e) {
    return res.status(500).json({ error: "publish failed" });
  }
});

// Verify route
app.post("/verify", upload.single("certificate"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const mimetype = (file.mimetype || "").toLowerCase();
  const isImage = mimetype.startsWith("image/");
  const isPdf = mimetype.includes("pdf");

  try {
    let text = "";
    if (isImage) {
      const out = await Tesseract.recognize(file.path, "eng");
      text = out?.data?.text || "";
    } else if (isPdf) {
      const data = await pdfParse(fs.readFileSync(file.path));
      text = (data?.text || "").trim();
    } else {
      return res.status(415).json({ error: `Unsupported file type: ${mimetype}` });
    }

    const extracted = parseFieldsFromText(text);
    const completeness = scoreExtracted(extracted);
    const match = matchAgainstRegistry(extracted);
    const score = Math.round((0.5 * completeness) + (0.5 * match.matchScore));

    const payload = {
      status: isImage ? "OCR complete" : "PDF parsed",
      verdict: match.verdict,
      score,
      issues: match.issues,
      text,
      extracted
    };

    // persist log (Mongo preferred)
    const logDoc = {
      ts: new Date(),
      verdict: payload.verdict,
      score: payload.score,
      certificateId: extracted["Certificate ID"] || null,
      rollNo: extracted["Roll No."] || null,
      status: payload.status
    };
    try {
      if (logsCol) await logsCol.insertOne(logDoc);
      else addMemLog({ ...logDoc, ts: logDoc.ts.toISOString() });
    } catch (e) {
      console.warn("log insert failed:", e.message);
      addMemLog({ ...logDoc, ts: logDoc.ts.toISOString() });
    }

    return res.json(payload);
  } catch (err) {
    console.error("Verify error:", err?.stack || err);
    return res.status(500).json({ error: "Verification failed" });
  }
});

// Start
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
