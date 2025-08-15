const express = require('express');
const { GoLogin } = require('gologin');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

app.use(express.json());

// Route kiểm tra server
app.get('/', (req, res) => {
  res.send('✅ GoLogin server is running!');
});

// Route chính để lấy cookie từ TextNow
app.post('/cookies', async (req, res) => {
  const { profileId, proxy } = req.body;

  console.log('📥 Received request:');
  console.log('Profile ID:', profileId);
  console.log('Proxy:', proxy);

  if (!profileId || !proxy) {
    return res.status(400).json({ error: 'Missing profileId or proxy' });
  }

  const GL = new GoLogin({
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODlkYjZjYTJmYzgzMmY3NTczYzgxN2IiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2ODlkYjZmNDJmYzgzMmY3NTczY2I0YmUifQ.sM_s23wKDFlx36bXIh9WT3N_vC_cywogOJnLvIy-iSk',
    profile_id: profileId,
    extra_params: {
      proxy: {
        mode: 'gologin',
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
      }
    }
  });

  try {
    let wsEndpoint;

    const startResult = await GL.start();
    console.log('✅ GoLogin started, startResult:', startResult);

    if (typeof startResult === 'string') {
        wsEndpoint = startResult;
    } 
    else if (startResult && typeof startResult.wsUrl === 'string') {
        wsEndpoint = startResult.wsUrl;
    } 
    else {
        console.error('❌ wsEndpoint not found in startResult:', startResult);
        return res.status(500).json({
            error: 'Invalid wsEndpoint from GoLogin',
            details: startResult
        });
    }

    const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    const pages = await browser.pages();
    const page = pages[0];

    await page.goto('https://www.textnow.com/login', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);

    const cookies = await page.cookies();
    const xsrfToken = cookies.find(c => c.name === 'XSRF-TOKEN')?.value;
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // ✅ Chỉ đóng sau khi lấy xong
    await browser.disconnect(); // 👈 dùng disconnect thay vì close
    await GL.stop();

    res.json({
      xsrfToken,
      cookieHeader,
      cookies,
    });
  } catch (err) {
    console.error('❌ Error getting cookies:', err);
    res.status(500).json({ error: 'Failed to get cookies', details: err.message });
  }
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 GoLogin service running at http://localhost:${PORT}`);
});
