const Busboy = require('busboy');

function parse(req) {
  return new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: req.headers });
    const files = new Map();
    const fields = new Map();
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      files.set(fieldname, { filename, mimetype });
      file.resume();
    });
    busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
      fields.set(fieldname, val);
    });
    busboy.on('finish', () => {
      resolve({fields, files});
    });
    busboy.on('error', reject);

    req.pipe(busboy);
  });
}

module.exports = {
  parse
};
