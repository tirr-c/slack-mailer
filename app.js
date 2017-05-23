const {WebClient} = require('@slack/client');
const {fs} = require('./util');
const {MailgunVerifier} = require('./verifier');
const parseBody = require('./parser').parse;
const Koa = require('koa');
const concat = require('concat-stream');

fs.writeFileAsync('pid', process.pid.toString()).catch(err => {
  console.error(err);
  process.exit(1);
});

const botToken = process.env.SLACK_BOT_TOKEN || '';
const apiKey = process.env.MAILGUN_API_KEY || null;
const verifier = apiKey ? new MailgunVerifier(apiKey) : null;
// const web = new WebClient(botToken);
if (verifier === null) {
  console.log('MAILGUN_API_KEY not given, not verifying webhooks');
}

const app = new Koa();

app.use(async ctx => {
  ctx.assert(ctx.method.toLowerCase() === 'post', 406);
  ctx.assert(ctx.path === '/notify', 404);

  const {fields, files} = await parseBody(ctx.req);

  if (verifier !== null) {
    const timestamp = fields.get('timestamp');
    const token = fields.get('token');
    const signature = fields.get('signature');
    const valid = verifier.verify(timestamp, token, signature);
    ctx.assert(valid, 400);
  }

  console.log(fields.get('stripped-text'));
  console.log();
  ctx.status = 200;
});

app.listen(3000);
