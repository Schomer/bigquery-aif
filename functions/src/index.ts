// functions/src/index.ts
// Authenticated Gemini API proxy.
// Verifies a Firebase Auth ID token, then forwards the request to the
// Generative Language API with the server-side API key.

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp();

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

export const geminiProxy = onRequest(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKey],
    invoker: "private",
    // Allow larger payloads (schemas can be big)
    timeoutSeconds: 120,
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify Firebase Auth ID token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      await getAuth().verifyIdToken(idToken);
    } catch (err) {
      res.status(401).json({ error: "Invalid or expired Firebase ID token" });
      return;
    }

    // Forward the request body to Gemini
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      res.status(500).json({ error: "GEMINI_API_KEY secret is not configured" });
      return;
    }

    const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

    try {
      const geminiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      const data = await geminiRes.text();

      // Forward Gemini's response verbatim (status + body)
      res.status(geminiRes.status).set("Content-Type", "application/json").send(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `Gemini proxy error: ${msg}` });
    }
  }
);
