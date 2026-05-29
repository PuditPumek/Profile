const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'pumek';
const ADMIN_PASS = process.env.ADMIN_PASS || 'pudit@2010';
const DATA_FILE = path.join(__dirname, 'profile.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// สร้าง uploads folder ถ้ายังไม่มี
if (!fsSync.existsSync(UPLOAD_DIR)) fsSync.mkdirSync(UPLOAD_DIR);

// multer: เก็บไฟล์ใน uploads/ ตั้งชื่อเป็น avatar.xxx
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'avatar' + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('อัปโหลดได้เฉพาะไฟล์รูปภาพเท่านั้น'));
  }
});

app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin area"');
    return res.status(401).send('Unauthorized');
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1] || '', 'base64').toString().split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin area"');
  return res.status(401).send('Unauthorized');
}

async function readProfile() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function writeProfile(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.use(express.static(path.join(__dirname)));
app.use('/admin', basicAuth, express.static(path.join(__dirname, 'admin'), { index: 'index.html' }));

// GET profile
app.get('/api/profile', async (req, res) => {
  const profile = await readProfile();
  if (!profile) return res.status(500).json({ error: 'ไม่สามารถอ่านข้อมูลโปรไฟล์ได้' });
  res.json(profile);
});

// POST profile (update data)
app.post('/api/profile', basicAuth, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'Payload ต้องเป็น JSON' });
  try {
    await writeProfile(payload);
    res.json({ success: true, message: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
});

// POST avatar upload
app.post('/api/upload-avatar', basicAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูป' });
  try {
    // บันทึก avatarUrl ลงใน profile.json ด้วย
    const profile = (await readProfile()) || {};
    profile.avatarUrl = '/uploads/' + req.file.filename;
    await writeProfile(profile);
    res.json({ success: true, avatarUrl: profile.avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'อัปโหลดไม่สำเร็จ' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin page    at http://localhost:${PORT}/admin`);
});
