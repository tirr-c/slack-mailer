const crypto = require('crypto');

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

module.exports = {
  MailgunVerifier
};
