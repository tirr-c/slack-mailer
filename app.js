const {WebClient} = require('@slack/client');
const {fs} = require('./util');
const Koa = require('koa');
const concat = require('concat-stream');

fs.writeFileAsync('pid', process.pid.toString()).catch(err => {
  console.error(err);
  process.exit(1);
});

const botToken = process.env.SLACK_BOT_TOKEN || '';
const web = new WebClient(botToken);

const app = new Koa();

app.use(async ctx => {
  ctx.assert(ctx.method.toLowerCase === 'post', 406);
  ctx.assert(ctx.path === '/notify', 404);

  const buffer = await new Promise((resolve, reject) => {
    const concatStream = concat(resolve);
    ctx.request.on('error', reject);
    ctx.request.pipe(concatStream);
  });

  console.log(buffer.toString());
});
