import { startTransition, useMemo, useState } from "react";

import "./App.css";

const API_PATH = "/api/generate";

type GenerateState = "idle" | "uploading" | "done" | "error";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [desiredRole, setDesiredRole] = useState("Full-Stack Developer");
  const [status, setStatus] = useState<GenerateState>("idle");
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadName, setDownloadName] = useState("tailored-cv.pdf");

  const canGenerate = useMemo(
    () => Boolean(file && desiredRole.trim() && status !== "uploading"),
    [file, desiredRole, status],
  );

  async function handleGenerate() {
    if (!file || !desiredRole.trim()) {
      return;
    }

    setStatus("uploading");
    setError("");

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl("");
    }

    try {
      const formData = new FormData();
      formData.append("cvFile", file);
      formData.append("desiredRole", desiredRole.trim());

      const response = await fetch(API_PATH, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to generate the tailored CV.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const matchedName = contentDisposition?.match(/filename="(.+)"/)?.[1];
      const objectUrl = URL.createObjectURL(blob);

      startTransition(() => {
        setDownloadUrl(objectUrl);
        setDownloadName(matchedName ?? "tailored-cv.pdf");
        setStatus("done");
      });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unexpected generation failure.");
    }
  }

  return (
    <main className="shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Role-targeted resume generation</p>
          <h1>Upload a CV. Name the role. Download the sharper version.</h1>
          <p className="lede">
            cvMaker turns an existing resume into a cleaner, tighter one-page PDF
            aimed at the exact development role the candidate wants.
          </p>

          <div className="proof-strip">
            <span>One-page PDF output</span>
            <span>Developer-role focused</span>
            <span>Outcome-oriented rewriting</span>
          </div>
        </div>

        <aside className="glass-card">
          <div className="card-head">
            <p className="card-kicker">Generate tailored CV</p>
            <h2>Premium output, simple flow</h2>
          </div>

          <label className="field">
            <span>Current CV PDF</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
              }}
            />
            <small>
              {file ? `${file.name} selected` : "Upload the candidate’s current PDF CV"}
            </small>
          </label>

          <label className="field">
            <span>Desired role</span>
            <input
              type="text"
              value={desiredRole}
              onChange={(event) => setDesiredRole(event.target.value)}
              placeholder="Backend Engineer"
            />
            <small>
              Example: Frontend Developer, Backend Engineer, Full-Stack Developer
            </small>
          </label>

          <button
            type="button"
            className="primary-button"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {status === "uploading" ? "Generating..." : "Generate tailored CV"}
          </button>

          {status === "done" && downloadUrl ? (
            <a className="download-button" href={downloadUrl} download={downloadName}>
              Download generated PDF
            </a>
          ) : null}

          {status === "error" && error ? (
            <p className="status error">{error}</p>
          ) : null}

          {status === "uploading" ? (
            <p className="status">Analyzing content, rewriting for the role, and rendering PDF.</p>
          ) : null}
        </aside>
      </section>

      <section className="feature-grid">
        <article className="feature-card">
          <p className="feature-index">01</p>
          <h3>Role alignment</h3>
          <p>
            Prioritizes the experience, technologies, and projects that actually match
            the requested development role.
          </p>
        </article>

        <article className="feature-card">
          <p className="feature-index">02</p>
          <h3>Stronger bullets</h3>
          <p>
            Rewrites weak resume phrasing into clearer achievement statements built
            around action, impact, and implementation.
          </p>
        </article>

        <article className="feature-card">
          <p className="feature-index">03</p>
          <h3>Instant delivery</h3>
          <p>
            Keeps the workflow minimal: upload, generate, download. No multi-step
            form, no user dialogue, no editing wall.
          </p>
        </article>
      </section>
    </main>
  );
}

export default App;
