require('dotenv').config();
const { google } = require('googleapis');

async function testDriveAuth() {
  console.log('Client email set:', !!process.env.GOOGLE_CLIENT_EMAIL);
  console.log('Private key length:', (process.env.GOOGLE_PRIVATE_KEY || '').length);
  console.log('Folder ID set:', !!process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID);

  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  console.log('Private key starts with BEGIN marker:', privateKey.startsWith('-----BEGIN PRIVATE KEY-----'));
  console.log('Private key ends with END marker:', privateKey.trim().endsWith('-----END PRIVATE KEY-----'));

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  try {
    console.log('\nAttempting to authorize...');
    const tokens = await auth.authorize();
    console.log('✅ Authorization succeeded. Token type:', tokens.token_type);
  } catch (err) {
    console.error('\n❌ Authorization failed. Full error below:\n');
    console.error(err);
    return;
  }

  const drive = google.drive({ version: 'v3', auth });

  try {
    console.log('\nAttempting to list files in the target folder (with supportsAllDrives, since this is a Shared Drive folder)...');
    const res = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID}' in parents`,
      fields: 'files(id, name)',
      pageSize: 5,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    console.log('✅ Folder access succeeded. Files found:', res.data.files.length);
    console.log(res.data.files);
  } catch (err) {
    console.error('\n❌ Folder access failed. Full error below:\n');
    console.error(err);
    return;
  }

  try {
    console.log('\nAttempting an actual test upload (this is the real end-to-end check)...');
    const stream = require('stream');
    const testBuffer = Buffer.from('This is a test file from testDriveAuth.js');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(testBuffer);

    const { data: file } = await drive.files.create({
      requestBody: {
        name: `test-upload-${Date.now()}.txt`,
        parents: [process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID],
      },
      media: { mimeType: 'text/plain', body: bufferStream },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    console.log('✅ Test upload succeeded!');
    console.log('File ID:', file.id);
    console.log('View link:', file.webViewLink);
  } catch (err) {
    console.error('\n❌ Test upload failed. Full error below:\n');
    console.error(err);
  }
}

testDriveAuth();