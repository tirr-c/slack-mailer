const {WebClient} = require('@slack/client');
const {fs, slackEscape, MailgunVerifier} = require('./util');
const parseBody = require('./parser').parse;
const Koa = require('koa');
const concat = require('concat-stream');

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

const fromRegex = /^\s*([^<]+)(?:<.+?>)?\s*$/;

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

  console.log('Received a mail:');
  console.log(`From: ${fields.get('from')}`);
  console.log(`Subject: ${fields.get('subject')}`);

  if (web !== null) {
    const subject = fields.get('subject');
    const text = slackEscape(fields.get('stripped-text'));
    const fromRaw = fields.get('from');
    const fromRegexMatch = fromRegex.exec(fromRaw);
    const from = fromRegexMatch === null ? fromRaw : fromRegexMatch[0];
    web.chat.postMessage(
      '#random',
      '메일이 도착했습니다.',
      {
        link_names: false,
        as_user: true,
        attachments: [
          {
            fallback: subject,
            author_name: from,
            title: subject,
            text: text,
            ts: (new Date().getTime() / 1000 | 0).toString()
          }
        ]
      }
    );
  }
  ctx.status = 200;
});

app.listen(3000);
