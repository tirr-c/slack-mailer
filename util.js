const crypto = require('crypto');
const fs = require('fs');

function promisify(f) {
  return function (...args) {
    return new Promise((res, rej) => {
      f(...args, (err, ret) => {
        if (err != null) rej(err);
        else res(ret);
      });
    });
  }
}

function setTimeoutAsync(delay) {
  return new Promise(res => {
    setTimeout(res, delay);
  });
}

const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

class MailgunVerifier {
  constructor(key) {
    this._key = key;
  }

  verify(timestamp, token, signature) {
    const target = `${timestamp}${token}`;
    const hmac = crypto.createHmac('sha256', this._key);
    hmac.update(target);
    return signature === hmac.digest('hex');
  }
};

function slackEscape(text) {
  return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
}

module.exports = {
  promisify,
  fs: {
    statAsync,
    mkdirAsync,
    readFileAsync,
    writeFileAsync
  },
  setTimeoutAsync,
  slackEscape,
  MailgunVerifier
};
