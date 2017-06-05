const {WebClient} = require('@slack/client');
const {Html5Entities} = require('html-entities');
const Koa = require('koa');
const {fs, slackEscape, MailgunVerifier} = require('./util');
const {DataManager} = require('./data');
const parseBody = require('./parser').parse;
const filter = require('./filter');

fs.writeFileAsync('pid', process.pid.toString()).catch(err => {
  console.error(err);
  process.exit(1);
});

const botToken = process.env.SLACK_BOT_TOKEN || null
const apiKey = process.env.MAILGUN_API_KEY || null;
const verifier = apiKey ? new MailgunVerifier(apiKey) : null;
const web = botToken ? new WebClient(botToken) : null;

if (web === null) {
  console.log('SLACK_BOT_TOKEN not given, not relaying to Slack');
}
if (verifier === null) {
  console.log('MAILGUN_API_KEY not given, not verifying webhooks');
}

const data = new DataManager(`${__dirname}/data`);

const entities = new Html5Entities();
function composeEmailPage(emailData) {
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<title>${entities.encode(emailData.subject)}</title></head><body>` +
    `<h1>${entities.encode(emailData.subject)}</h1>` +
    `<p>From: ${entities.encode(emailData.from)}</p><hr><pre>` +
    entities.encode(emailData.body) +
    '</pre></body></html>'
  );
}

const app = new Koa();

app.use(async (ctx, next) => {
  const path = require('path').dirname(ctx.path);
  if (path !== '/logs') return await next();
  const bn = require('path').basename(ctx.path);

  try {
    const emailData = await data.readJson(`${bn}.json`);
    ctx.type = 'text/html';
    ctx.body = composeEmailPage(emailData);
    ctx.status = 200;
  } catch (err) {
    if (err.code === 'ENOENT') {
      ctx.throw(404, '존재하지 않는 이메일 ID입니다.');
    }
    ctx.throw(500);
  }
});

app.use(async (ctx, next) => {
  if (ctx.path !== '/notify') return await next();
  ctx.assert(ctx.method.toLowerCase() === 'post', 406);

  const {fields, files} = await parseBody(ctx.req);

  const timestamp = fields.get('timestamp');
  const token = fields.get('token');
  const signature = fields.get('signature');
  const emailId = `${timestamp}-${token}`;
  if (verifier !== null) {
    const valid = verifier.verify(timestamp, token, signature);
    ctx.assert(valid, 400);
  }

  const emailData = {
    subject: fields.get('subject'),
    from: fields.get('from'),
    body: fields.get('body-plain')
  };
  data.writeJson(`${emailId}.json`, emailData).catch(console.error);
  console.log(`Received a mail: ${emailId}`);

  if (web !== null) {
    const slack = await filter(emailId, fields, files);
    web.chat.postMessage(
      slack.channel,
      slack.message,
      {
        link_names: false,
        as_user: true
      }
    );
  }
  ctx.status = 200;
});

app.listen(3000);
