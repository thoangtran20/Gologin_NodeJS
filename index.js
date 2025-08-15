const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(express.json());

// 🗂️ Ánh xạ profileId → token
const profileMap = {
  '689db6f42fc832f7573cb4be': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODlkYjZjYTJmYzgzMmY3NTczYzgxN2IiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2ODlkYjZmNDJmYzgzMmY3NTczY2I0YmUifQ.sM_s23wKDFlx36bXIh9WT3N_vC_cywogOJnLvIy-iSk',
  '689dce77a92024e3ca61fd4d': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODlkYjZjYTJmYzgzMmY3NTczYzgxN2IiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2ODlkY2U3N2E5MjAyNGUzY2E2MWZkNGQifQ.D8c24uWlpao1Tsaf2Pp9SwzUHMqRPT7YxKLLbxMJz7M',
  '689eae0e48586f9d4b688fc0': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODlkYjZjYTJmYzgzMmY3NTczYzgxN2IiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2ODllYWUwZTQ4NTg2ZjlkNGI2ODhmYzAifQ.zH4Bn0Sm0vyxlIfWaezRbleoSxklJJLemRio7yvYzmk'
};

// 🍪 Lấy cookie từ profile (dùng đúng token theo profileId)
app.post('/cookies', async (req, res) => {
  const { profileId, proxy } = req.body;

  if (!profileId || !proxy) {
    return res.status(400).json({ error: 'Missing profileId or proxy' });
  }

  const token = profileMap[profileId];
  if (!token) {
    return res.status(403).json({ error: 'Token not found for this profileId' });
  }

  try {
    // 📋 Kiểm tra profile tồn tại và token hợp lệ
    const checkProfile = await axios.get(`https://api.gologin.com/browser/${profileId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`✅ Profile "${checkProfile.data.name}" tồn tại, tiếp tục khởi động...`);

    // 🟢 Mở profile
    await axios.post(`https://api.gologin.com/browser/start/${profileId}`, null, {
      headers: { Authorization: `Bearer ${token}` }
    });

    await new Promise(resolve => setTimeout(resolve, 5000)); // ⏳ Chờ profile khởi động

    // 🔌 Lấy wsEndpoint
    const response = await axios.get(`https://api.gologin.com/browser/${profileId}/websocket`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const wsEndpoint = response.data.wsUrl;
    const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    await page.goto('https://www.textnow.com/login', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);

    const cookies = await page.cookies();
    const xsrfToken = cookies.find(c => c.name === 'XSRF-TOKEN')?.value;
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    await browser.disconnect();

    res.json({ xsrfToken, cookieHeader, cookies });
  } catch (err) {
    console.error('❌ Lỗi:', err.response?.status, err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to get cookies',
      details: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 GoLogin service running at http://localhost:${PORT}`);
});
