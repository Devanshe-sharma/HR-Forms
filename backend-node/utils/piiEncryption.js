// utils/piiEncryption.js
// ─────────────────────────────────────────────────────────────────────────────
// Field-level encryption for sensitive personal fields (bank details, PAN,
// Aadhaar, UAN) stored on Employee / Onboarding records. Encrypted at rest
// with AES-256-GCM using a server-held key (PII_ENCRYPTION_KEY) — this
// protects the data from anyone with only database/backup access (a DB dump,
// a compromised read replica, a careless export), which is the real-world
// exposure this closes. It does NOT protect against someone who has both the
// database AND this server's environment variables, same trust boundary as
// this app's JWT secret or mail credentials — the app itself must be able to
// decrypt these fields to show an employee/HR their own bank details.
//
// Generate a key once with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// and set it as PII_ENCRYPTION_KEY in backend-node/.env. Losing this key
// makes every previously-encrypted value permanently unrecoverable — back it
// up somewhere safe, outside of git.
// ─────────────────────────────────────────────────────────────────────────────
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const ENC_PREFIX = 'enc:v1:';

function getKey() {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('PII_ENCRYPTION_KEY is not set — cannot encrypt/decrypt sensitive fields. See utils/piiEncryption.js for how to generate one.');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('PII_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return key;
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

// Idempotent — encrypting an already-encrypted value returns it unchanged,
// so this is always safe to call on a field whether or not it's been
// migrated yet.
function encryptPII(plainText) {
  if (plainText === undefined || plainText === null || plainText === '') return plainText;
  if (isEncrypted(plainText)) return plainText;

  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return ENC_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

// Returns legacy plaintext as-is (so records not yet migrated don't break),
// and a placeholder string if decryption fails (wrong/rotated key, corrupt
// data) instead of throwing and taking down the whole response.
function decryptPII(value) {
  if (value === undefined || value === null || value === '') return value;
  if (!isEncrypted(value)) return value;

  try {
    const key = getKey();
    const raw = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (e) {
    console.error('[piiEncryption] Failed to decrypt value:', e.message);
    return '[decryption failed]';
  }
}

// Every field covered by this pass — bank details plus the adjacent
// government-ID fields that sit right next to them in both schemas.
const PII_FIELDS = ['bankName', 'bankAccountNo', 'ifscCode', 'panCard', 'aadhaarNo', 'uanNo'];

function encryptPIIFields(obj) {
  if (!obj) return obj;
  for (const field of PII_FIELDS) {
    if (obj[field] !== undefined) obj[field] = encryptPII(obj[field]);
  }
  return obj;
}

function decryptPIIFields(obj) {
  if (!obj) return obj;
  for (const field of PII_FIELDS) {
    if (obj[field] !== undefined) obj[field] = decryptPII(obj[field]);
  }
  return obj;
}

// Attaches the standard encrypt-on-write / decrypt-on-serialize behaviour to
// a Mongoose schema. Covers: .save(), findOneAndUpdate/findByIdAndUpdate
// (encrypt), and res.json(doc) / doc.toJSON() / doc.toObject() (decrypt).
// Does NOT cover .lean() reads, which bypass schema machinery entirely —
// any route that fetches these fields via .lean() must call
// decryptPIIFields() on the plain object itself.
function applyPIIEncryption(schema) {
  // No `next` param on purpose — Mongoose 9 only supports callback-style
  // middleware when the function's declared arity says it wants one, and
  // got stricter about this: a hook that takes `next` but is registered on
  // a query (findOneAndUpdate/updateOne/updateMany) throws "next is not a
  // function" here instead of just running synchronously. A plain
  // zero-argument function runs synchronously and advances on its own,
  // which is all either hook needs — neither does anything async.
  schema.pre('save', function () {
    PII_FIELDS.forEach((field) => {
      if (this.isModified(field) && this[field]) {
        this[field] = encryptPII(this[field]);
      }
    });
  });

  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function () {
    const update = this.getUpdate();
    if (!update) return;
    if (update.$set) encryptPIIFields(update.$set);
    encryptPIIFields(update);
  });

  const transform = (_doc, ret) => {
    decryptPIIFields(ret);
    return ret;
  };
  schema.set('toJSON', { transform });
  schema.set('toObject', { transform });
}

module.exports = {
  encryptPII, decryptPII, isEncrypted,
  PII_FIELDS, encryptPIIFields, decryptPIIFields,
  applyPIIEncryption,
};
