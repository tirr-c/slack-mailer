const path = require('path');
const {fs} = require('./util');

class DataManager {
  constructor(base = './data') {
    this._base = '';
    this.changeDataDir(base);
  }

  changeDataDir(dir) {
    return fs.statAsync(dir).then(stats => {
      if (stats.isDirectory()) {
        return false;
      }
      return true;
    }).catch(err => {
      if (err.code === 'ENOENT') {
        return true;
      }
      throw err;
    }).then(shouldMake => {
      if (shouldMake) {
        return fs.mkdirAsync(dir);
      }
    }).then(() => {
      this._base = dir;
    });
  }

  getDataPath(p) {
    return path.join(this._base, p);
  }

  readBuffer(p) {
    return fs.readFileAsync(this.getDataPath(p));
  }
  readString(p) {
    return fs.readFileAsync(this.getDataPath(p), {encoding: 'utf8'});
  }
  readJson(p) {
    return this.readString(p).then(JSON.parse);
  }
  writeBuffer(p, buf) {
    return fs.writeFileAsync(this.getDataPath(p), buf);
  }
  writeString(p, str) {
    return fs.writeFileAsync(this.getDataPath(p), str);
  }
  writeJson(p, obj) {
    return this.writeString(p, JSON.stringify(obj));
  }
}

module.exports = {
  DataManager
};
