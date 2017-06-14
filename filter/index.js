const {slackEscape, baseUrl} = require('./filter-util');

const filters = require('./filters.json').concat({
  name: 'default',
  module: './default'
}).map(item => {
  try {
    const mod = require(item.module);
    return {
      name: item.name,
      filter: mod.filter || null,
      action: mod.action || null,
      convert: mod.convert || null
    };
  } catch (e) {
    console.error(`Error processing filter definition ${item.name}:`, e);
    return null;
  }
}).filter(i => i !== null);

async function filter(emailId, fields, files) {
  for (const f of filters) {
    if (f.filter === null) {
      console.log(`Ignoring filter ${f.name}: no filter method`);
      continue;
    }
    try {
      const resp = await f.filter(fields, files);
      console.log(`Email ${emailId} matched with filter ${f.name}`);
      if (f.action !== null) {
        console.log(`${f.name}: Performing action for ${emailId}`);
        await f.action(emailId, resp);
      }
      const slack = f.convert === null ? null : f.convert(emailId, resp);
      return slack;
    } catch(e) {
      if (e != null) console.error(`Error processing filter ${f.name}:`, e);
    }
  }
  console.log('No matching filters: this is probably a bug. Ignoring for now.');
  return null;
}

module.exports = filter;
