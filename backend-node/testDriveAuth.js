require('dotenv').config();
const { google } = require('googleapis');

async function testDriveAuth() {
  console.log('Client email set:', !!process.env.GOOGLE_CLIENT_EMAIL);
  console.log('Private key length:', (process.env.GOOGLE_PRIVATE_KEY || '').length);
  console.log('Folder ID set:', !!process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID);

  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  console.log('Private key starts with BEGIN marker:', privateKey.startsWith('-----BEGIN PRIVATE KEY-----'));
  console.log('Private key ends with END marker:', privateKey.trim().endsWith('-----END PRIVATE KEY-----'));

  // Modern object-based constructor — see the comment in
  // utils/googleDrive.js for why the old positional-argument style
  // silently failed to set the key at all.
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

  try {
    console.log('\nAttempting to list files in the target folder...');
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID}' in parents`,
      fields: 'files(id, name)',
      pageSize: 5,
    });
    console.log('✅ Folder access succeeded. Files found:', res.data.files.length);
    console.log(res.data.files);
  } catch (err) {
    console.error('\n❌ Folder access failed. Full error below:\n');
    console.error(err);
  }
}

testDriveAuth();