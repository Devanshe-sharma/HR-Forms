const { google } = require('googleapis');
const mammoth = require('mammoth');

// Extracts the document/file ID from a Google Docs or Drive URL — works
// for both "/document/d/{ID}/..." (native Google Docs) and
// "/file/d/{ID}/..." (uploaded files like .docx, viewed via Drive's
// generic file viewer) — the ID is the only part that actually
// identifies the file either way.
function extractDocId(url) {
  if (!url) return null;
  const docMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch) return docMatch[1];
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  return null;
}

function getAuth() {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  // Same service account as googleDrive.js, with both the Docs
  // read-only scope (for native Google Docs) and the Drive read-only
  // scope (for downloading uploaded Office files that aren't native
  // Google Docs at all) — a single JWT can carry both scopes at once.
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/documents.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

// The Docs API returns a deeply nested structure (body.content is an
// array of StructuralElements, each optionally containing a paragraph
// with an elements array of textRun objects) rather than plain text —
// this flattens all of that down to a single string.
function extractPlainText(document) {
  const content = document?.body?.content || [];
  let text = '';

  for (const element of content) {
    if (!element.paragraph) continue;
    for (const el of element.paragraph.elements || []) {
      if (el.textRun?.content) {
        text += el.textRun.content;
      }
    }
  }

  return text.trim();
}

// Fallback for JDs that were uploaded as actual Word/.docx files into
// Drive rather than created as native Google Docs — the Docs API's
// documents.get() flatly refuses these ("This operation is not
// supported for this document. The document must not be an Office
// file."), so this downloads the raw file bytes via the Drive API
// instead and extracts text directly from the .docx itself.
async function fetchOfficeFileText(docId, auth) {
  const drive = google.drive({ version: 'v3', auth });

  const meta = await drive.files.get({
    fileId: docId,
    fields: 'mimeType, name',
    supportsAllDrives: true,
  });
  const mimeType = meta.data.mimeType;

  if (mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    console.error(`[googleDocs] Unsupported file type for JD text extraction: ${mimeType} (file: ${meta.data.name})`);
    return null;
  }

  const res = await drive.files.get(
    { fileId: docId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );

  const buffer = Buffer.from(res.data);
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

// Fetches a JD's plain text content given its share URL — handles both
// native Google Docs (via the Docs API) and uploaded .docx files (via
// downloading and extracting the raw file through the Drive API
// instead). Returns null (rather than throwing) if the URL isn't
// recognizable, the document isn't accessible, or the file type isn't
// supported — the caller decides whether that's a hard failure or
// something to proceed without.
async function fetchJdText(jdLink) {
  const docId = extractDocId(jdLink);
  if (!docId) return null;

  const auth = getAuth();

  try {
    const docs = google.docs({ version: 'v1', auth });
    const res = await docs.documents.get({ documentId: docId });
    return extractPlainText(res.data);
  } catch (err) {
    const isOfficeFileError = err.message?.includes('must not be an Office file');

    if (isOfficeFileError) {
      try {
        return await fetchOfficeFileText(docId, auth);
      } catch (fallbackErr) {
        console.error('[googleDocs] Failed to fetch JD text from Office file fallback:', fallbackErr.message);
        return null;
      }
    }

    console.error('[googleDocs] Failed to fetch JD text:', err.message);
    return null;
  }
}

module.exports = { fetchJdText, extractDocId };