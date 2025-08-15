const axios = require('axios');
const puppeteer = require('puppeteer-core');

async function updateProxy(profileId, proxyConfig, host = 'localhost', port = 36912) {
  const url = `http://${host}:${port}/browser/update`;
  const payload = {
    id: profileId,
    proxyEnabled: true,
    proxy: {
      mode: 'socks5', // hoặc 'socks5' tùy loại proxy
      host: proxyConfig.host,
      port: parseInt(proxyConfig.port),
      username: proxyConfig.username,
      password: proxyConfig.password
    }
  };
  await axios.put(url, payload);
}

async function connectToProfile(profileId, proxyConfig = {}, host = 'localhost', port = 36912) {
  if (proxyConfig.host && proxyConfig.port) {
    await updateProxy(profileId, proxyConfig, host, port);
  }

  const baseUrl = `http://${host}:${port}`;
  const statusUrl = `${baseUrl}/browser/status?profileId=${profileId}`;
  const startUrl = `${baseUrl}/browser/start?profileId=${profileId}`;
  const wsUrl = `${baseUrl}/browser/wsEndpoint?profileId=${profileId}`;

  const { data: statusData } = await axios.get(statusUrl);
  const wsEndpoint = statusData.status === 'Running'
    ? (await axios.get(wsUrl)).data.wsEndpoint
    : (await axios.get(startUrl)).data.wsEndpoint;

  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  return browser;
}

module.exports = { connectToProfile };
