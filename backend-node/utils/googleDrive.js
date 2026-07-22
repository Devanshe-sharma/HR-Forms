const { google } = require('googleapis');
const stream = require('stream');

const FOLDER_ID = process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID;

function getDriveClient() {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

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
//
// supportsAllDrives: true is required on every call here — the resume
// folder ("Candidate Resumes") lives inside a Shared Drive (a Google
// Workspace Team Drive), not a regular personal Drive folder. Without
// this flag, the Drive API treats Shared Drive resources as if they
// don't exist at all — files.create() fails with "File not found" for
// a perfectly real, correctly-shared folder, and files.list() silently
// returns an empty result instead of erroring, which is exactly what
// made this look like it was "working" (0 files found) when it was
// actually never seeing into the Shared Drive at all.
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
    supportsAllDrives: true,
  });

  await drive.permissions.create({
    fileId: file.id,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  return file.webViewLink;
}

module.exports = { uploadResumeToDrive };