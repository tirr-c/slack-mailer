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

module.exports = {
  promisify,
  fs: {
    statAsync,
    mkdirAsync,
    readFileAsync,
    writeFileAsync
  },
  setTimeoutAsync
};
