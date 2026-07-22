const { google } = require('googleapis');
const stream = require('stream');

const FOLDER_ID = process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID;

function getDriveClient() {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  // Modern google-auth-library (v8+, which current googleapis versions
  // depend on) expects a single options object here — { email, key,
  // scopes } — not the old positional-argument signature
  // (email, keyFile, key, scopes) this used before. With the old
  // signature, the constructor never actually assigned our key string
  // to its internal "key" property at all, which is exactly why gtoken
  // reported "No key or keyFile set" even with a perfectly
  // correctly-formatted PEM key being passed in.
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

// Uploads a file buffer (from multer's memoryStorage — no local disk
// write at all) to the shared resume folder, then makes it viewable by
// anyone with the link — matching how other Drive links elsewhere in
// this app (role docs, JDs) already work. Returns that viewable link,
// which is what gets saved as the `resume` field instead of a local
// disk path.
async function uploadResumeToDrive(fileBuffer, originalName, mimeType) {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Drive credentials are not configured — check GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in .env');
  }
  if (!FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_RESUME_FOLDER_ID is not set in .env');
  }

  const drive = getDriveClient();

  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileBuffer);

  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${originalName}`;

  const { data: file } = await drive.files.create({
    requestBody: {
      name: uniqueName,
      parents: [FOLDER_ID],
    },
    media: {
      mimeType,
      body: bufferStream,
    },
    fields: 'id, webViewLink',
  });

  await drive.permissions.create({
    fileId: file.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return file.webViewLink;
}

module.exports = { uploadResumeToDrive };