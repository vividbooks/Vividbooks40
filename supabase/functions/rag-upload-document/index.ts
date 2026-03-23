/**
 * rag-upload-document
 *
 * Bezpečný proxy pro Gemini Files API – klíč je v Supabase secrets (GEMINI_API_KEY_RAG).
 * Podporuje operace:
 *   action: "upload"  – nahraje textový dokument, vrátí ragDocumentId
 *   action: "delete"  – smaže soubor z Gemini
 *   action: "status"  – vrátí stav souboru
 *   action: "generate" – generuje obsah s RAG
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY_RAG not configured in Supabase secrets");
    }

    const body = await req.json();
    const { action } = body;

    // ── UPLOAD TEXT DOCUMENT ──────────────────────────────────────────────────
    if (action === "upload") {
      const { title, subject, grade, type, documentId, content } = body;

      const contentWithMetadata = `
# ${title}

Předmět: ${subject}
Ročník: ${grade}. třída
Typ: ${type}
ID: ${documentId}

---

${content}
`.trim();

      const textBytes = new TextEncoder().encode(contentWithMetadata);

      // 1. Start resumable upload
      const uploadUrlResponse = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": textBytes.length.toString(),
            "X-Goog-Upload-Header-Content-Type": "text/plain",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file: { displayName: title } }),
        }
      );

      if (!uploadUrlResponse.ok) {
        const err = await uploadUrlResponse.text();
        throw new Error(`Failed to get upload URL: ${err}`);
      }

      const uploadUrl = uploadUrlResponse.headers.get("X-Goog-Upload-URL");
      if (!uploadUrl) throw new Error("No upload URL returned");

      // 2. Upload content
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "upload, finalize",
          "X-Goog-Upload-Offset": "0",
          "Content-Type": "text/plain",
        },
        body: textBytes,
      });

      if (!uploadResponse.ok) {
        const err = await uploadResponse.text();
        throw new Error(`Failed to upload content: ${err}`);
      }

      const fileData = await uploadResponse.json();
      const fileUri = fileData.file?.uri;
      const fileName = fileData.file?.name; // 'files/...'

      if (!fileName) throw new Error("No file name returned");

      // 3. Poll for processing
      let state = fileData.file?.state;
      let attempts = 0;
      while (state === "PROCESSING" && attempts < 30) {
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;
        const checkResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`
        );
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          state = checkData.state;
          if (state === "FAILED") throw new Error("File processing failed");
        }
      }

      return new Response(
        JSON.stringify({ success: true, ragDocumentId: fileName, fileUri }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DELETE DOCUMENT ───────────────────────────────────────────────────────
    if (action === "delete") {
      const { ragDocumentId } = body;
      if (!ragDocumentId?.startsWith("files/")) {
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${ragDocumentId}?key=${GEMINI_API_KEY}`,
        { method: "DELETE" }
      );
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GET STATUS ────────────────────────────────────────────────────────────
    if (action === "status") {
      const { ragDocumentId } = body;
      const statusResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${ragDocumentId}?key=${GEMINI_API_KEY}`
      );
      const data = await statusResponse.json();
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GENERATE WITH RAG ─────────────────────────────────────────────────────
    if (action === "generate") {
      const { model, messages, ragDocumentId, systemInstruction } = body;
      const modelId = model || "gemini-3-flash-preview";

      const contents = messages.map((m: any) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      // Prepend the file if provided
      if (ragDocumentId) {
        const fileResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${ragDocumentId}?key=${GEMINI_API_KEY}`
        );
        if (fileResponse.ok) {
          const fileInfo = await fileResponse.json();
          if (fileInfo.uri) {
            // Inject file reference into first user turn
            const firstUser = contents.find((c: any) => c.role === "user");
            if (firstUser) {
              firstUser.parts.unshift({ fileData: { mimeType: "text/plain", fileUri: fileInfo.uri } });
            }
          }
        }
      }

      const generateResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
          }),
        }
      );

      const generateData = await generateResponse.json();
      return new Response(
        JSON.stringify(generateData),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[rag-upload-document] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
