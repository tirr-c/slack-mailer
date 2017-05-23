const {WebClient} = require('@slack/client');
const {fs} = require('./util');
const Koa = require('koa');
const concat = require('concat-stream');
const {Form} = require('multiparty');

fs.writeFileAsync('pid', process.pid.toString()).catch(err => {
  console.error(err);
  process.exit(1);
});

const botToken = process.env.SLACK_BOT_TOKEN || '';
// const web = new WebClient(botToken);

const app = new Koa();

app.use(async ctx => {
  ctx.assert(ctx.method.toLowerCase() === 'post', 406);
  ctx.assert(ctx.path === '/notify', 404);

  const {fields, files} = await new Promise((resolve, reject) => {
    const form = new Form();
    form.parse(ctx.req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({fields, files});
    });
  });

  console.log('Fields:');
  console.log(fields);
  console.log('Files:');
  console.log(files);
  ctx.status = 200;
});

app.listen(3000);
