const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());

const defaultProxy = {
  mode: 'socks5',
  host: '898764bc1f130b05.shg.na.pyproxy.io',
  port: 16666,
  username: 'huyvumedia1-zone-resi-region-us',
  password: 'Zxcv123123'
};

// 🧼 Đảm bảo profile có đầy đủ trường
function sanitizeProfile(profile) {
  return {
    ...profile,
    browserType: profile.browserType || 'chrome',
    os: profile.os || 'win',
    navigator: profile.navigator || {
      userAgent: 'Mozilla/5.0',
      language: 'en-US',
      resolution: '1920x1080'
    },
    proxy: profile.proxy || {}
  };
}

async function updateProxy(profileId, token, proxyConfig) {
  const { data: profile } = await axios.get(`https://api.gologin.com/browser/${profileId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  // Ép kiểu port sang số
  const port = Number(proxyConfig?.port);

  // Kiểm tra proxy hợp lệ
  const isValidProxy =
    proxyConfig &&
    typeof proxyConfig.host === 'string' &&
    !isNaN(port) &&
    typeof proxyConfig.username === 'string' &&
    typeof proxyConfig.password === 'string' &&
    typeof proxyConfig.mode === 'string';

  if (!isValidProxy) {
    console.warn('⚠️ Proxy config không hợp lệ, bỏ qua cập nhật proxy');
    console.log('🔍 Proxy nhận được:', proxyConfig);
    return;
  }

  const updatedProfile = {
    ...profile,
    proxyEnabled: true,
    proxy: {
      mode: proxyConfig.mode,
      host: proxyConfig.host,
      port,
      username: proxyConfig.username,
      password: proxyConfig.password
    },
    browserType: profile.browserType || 'chrome',
    os: profile.os || 'win',
    navigator: profile.navigator || {
      userAgent: 'Mozilla/5.0',
      language: 'en-US',
      resolution: '1920x1080'
    }
  };

  await axios.put(`https://api.gologin.com/browser/${profileId}`, updatedProfile, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(`🌐 Proxy đã được cập nhật cho profile ${profileId}`);
}

async function getProfiles(token) {
  const decoded = jwt.decode(token);
  const accountId = decoded?.sub;

  const res = await axios.get('https://api.gologin.com/browser/v2', {
    headers: { Authorization: `Bearer ${token}` }
  });

  const rawProfiles = Array.isArray(res.data) ? res.data : res.data.profiles;

  return {
    accountId,
    profiles: rawProfiles.map(p => ({ id: p.id, name: p.name }))
  };
}

async function createCloneProfile(originalId, token, cloneName) {
  const { data: originalProfile } = await axios.get(`https://api.gologin.com/browser/${originalId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const sanitized = sanitizeProfile(originalProfile);

  const clonePayload = {
    ...sanitized,
    name: cloneName,
    notes: 'Cloned via API'
  };

  delete clonePayload.id;
  delete clonePayload.uuid;
  delete clonePayload.createdAt;
  delete clonePayload.updatedAt;

  const res = await axios.post('https://api.gologin.com/browser', clonePayload, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(`✅ Profile clone thành công: ${res.data.name}`);
  return res.data.id;
}

// 🍪 Lấy cookie từ profile clone
app.post('/cookies', async (req, res) => {
  const { token, profileId: originalProfileId, proxy, cloneName = 'TextNow_Clone' } = req.body;

  if (!token || !originalProfileId) {
    return res.status(400).json({ error: 'Missing token or originalProfileId' });
  }

  try {
    const { profiles } = await getProfiles(token);
    let cloneProfile = profiles.find(p => p.name === cloneName);

    let cloneId;

    if (!cloneProfile) {
      cloneId = await createCloneProfile(originalProfileId, token, cloneName);
    } else {
      cloneId = cloneProfile.id;
      console.log(`🔁 Profile clone đã tồn tại: ${cloneName}`);
    }

    const proxyConfig = proxy || defaultProxy;
    await updateProxy(cloneId, token, proxyConfig);

    const wsEndpoint = `wss://cloudbrowser.gologin.com/connect?token=${token}&profile=${cloneId}`;

    let browser;
    try {
      browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    } catch (err) {
      throw new Error('Không thể kết nối tới GoLogin browser. Đảm bảo profile đã được khởi chạy.');
    }

    const pages = await browser.pages();
    const page = pages.length ? pages[0] : await browser.newPage();

    await page.goto('https://www.textnow.com/login', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const cookies = await page.cookies();
    const xsrfToken = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || null;
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    await browser.disconnect();

    const output = {
      cloneId,
      cloneName,
      xsrfToken,
      cookieHeader,
      cookies
    };

    const dir = path.join(__dirname, 'cookies');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, `${cloneName}.json`), JSON.stringify(output, null, 2));

    console.log(`✅ Cookie đã lưu: cookies/${cloneName}.json`);
    res.json(output);
  } catch (err) {
    console.error('❌ Error:', err.response?.status, err.response?.data || err.message);
    res.status(500).json({
      error: 'Cannot get cookie',
      details: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 GoLogin Cookie Service running at http://localhost:${PORT}`);
});
