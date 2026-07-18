// functions/src/index.ts
// Authenticated Gemini API proxy (Cloud Functions 1st gen).
// Verifies a Firebase Auth ID token, then forwards the request to the
// Generative Language API with the server-side API key.
//
// Uses 1st gen to avoid Cloud Run IAM restrictions that prevent
// Firebase Hosting rewrites from reaching 2nd gen functions in orgs
// that block allUsers/allAuthenticatedUsers invoker bindings.

import * as functions from "firebase-functions/v1";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp();

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

export const geminiProxy = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
    memory: "256MB",
  })
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    // CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

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
    const apiKey = process.env.GEMINI_API_KEY;
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
  });
