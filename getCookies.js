const axios = require('axios');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODlmZmYwNDMzYjBiYjVlY2IzMzhkMDMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2ODlmZmY5ZTViNzA2YmI0ODFiNTc4NjYifQ.eNaOMEFPNWG33sGrP1PK_saWLoSLZ39JucMBgvAy87g';
const profileId = '689fff199f505762a7d59598';
const targetDomain = 'textnow.com';

// 👉 Khởi động profile qua Cloud API
async function startProfile() {
  const res = await axios.post(
  'https://api.gologin.com/browser/start',
    { profileId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data.wsEndpoint;
}

// 👉 Dừng profile
async function stopProfile() {
  await axios.post(
    `https://api.gologin.com/browser/${profileId}/stop`,
    { profileId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

(async () => {
  try {
    console.log('🚀 Khởi động profile...');
    const wsEndpoint = await startProfile();

    console.log('🔗 Kết nối Puppeteer...');
    const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    const page = (await browser.pages())[0];

    console.log('🌐 Truy cập TextNow...');
    await page.goto('https://www.textnow.com', { waitUntil: 'networkidle2' });

    console.log(`🍪 Lấy cookie của domain: ${targetDomain}`);
    const allCookies = await page.cookies();
    const filteredCookies = allCookies.filter(cookie =>
      cookie.domain.includes(targetDomain)
    );

    console.log(`🔍 Tìm thấy ${filteredCookies.length} cookie từ ${targetDomain}`);

    const authToken = filteredCookies.find(c => c.name.toLowerCase().includes('auth'));
    const sessionToken = filteredCookies.find(c => c.name.toLowerCase().includes('session'));

    console.log('🔐 Auth Token:', authToken?.value || 'Không tìm thấy');
    console.log('🔐 Session:', sessionToken?.value || 'Không tìm thấy');

    fs.writeFileSync(
      `cookies_${targetDomain}.json`,
      JSON.stringify(filteredCookies, null, 2)
    );
    console.log(`✅ Đã lưu cookies_${targetDomain}.json`);

    await browser.disconnect();
    await stopProfile();
    console.log('🛑 Đã dừng profile.');
  } catch (err) {
    console.error('❌ Lỗi:', err.response?.data || err.message);
  }
})();
