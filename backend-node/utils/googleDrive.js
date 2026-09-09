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
// makePublic defaults to true to preserve existing behavior for every
// current caller (resumes, referrals) — pass { makePublic: false } for
// anything sensitive (see candidate document uploads in
// routes/applicantRecords.js), which skips the "anyone with the link"
// grant entirely and leaves the file visible only to this Shared Drive's
// members (still enough for HR to open webViewLink while logged in).
async function uploadFileToDrive(fileBuffer, originalName, mimeType, folderId, { makePublic = true } = {}) {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Drive credentials are not configured — check GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in .env');
  }
  if (!folderId) {
    throw new Error('No Google Drive folder ID configured for this upload');
  }

  const drive = getDriveClient();

  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileBuffer);

  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${originalName}`;

  const { data: file } = await drive.files.create({
    requestBody: {
      name: uniqueName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: bufferStream,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  if (makePublic) {
    await drive.permissions.create({
      fileId: file.id,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  }

  return file.webViewLink;
}

// Thin wrapper kept for existing callers (referrals, candidate applications)
// that upload specifically into the shared "Candidate Resumes" folder.
async function uploadResumeToDrive(fileBuffer, originalName, mimeType) {
  return uploadFileToDrive(fileBuffer, originalName, mimeType, FOLDER_ID);
}

// Creates a new folder (used to give each offered candidate their own
// documents folder — see routes/applicantRecords.js's send-offer-letter).
// Same supportsAllDrives requirement as uploadFileToDrive — the parent
// lives in a Shared Drive. Deliberately does NOT grant "anyone with the
// link" access (unlike uploadFileToDrive's default) — this folder holds
// candidate PII (Aadhar, PAN, bank details), and this org's Drive policy
// rejects public link-sharing for it anyway (403: "user does not have
// sufficient permissions"). Shared Drive members (HR) can still open
// webViewLink while logged in without any explicit grant.
async function createDriveFolder(name, parentFolderId) {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Drive credentials are not configured — check GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in .env');
  }
  if (!parentFolderId) {
    throw new Error('No Google Drive parent folder ID configured for folder creation');
  }

  const drive = getDriveClient();

  const { data: folder } = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  return folder;
}

module.exports = { uploadResumeToDrive, uploadFileToDrive, createDriveFolder };
