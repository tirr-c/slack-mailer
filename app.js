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

const fromRegex = /^\s*([^<]+?)\s*(?:<.+?>)?\s*$/;
const usnRegex = /^\s*\[(USN-\d+-\d+)\] (.*?)\s*$/;

function filterUSN(fields, files) {
  const subject = fields.get('subject');
  const subjectRegex = usnRegex.exec(subject);
  if (subjectRegex === null) {
    return {
      filtered: false
    };
  }
  const id = subjectRegex[1];
  const title = subjectRegex[2];

  const text = fields.get('body-plain');
  const summary = text.substr(text.indexOf('Summary:\n\n')).split('\n\n')[1].replace('\n', ' ');

  const versions = text.substr(text.indexOf('and its derivatives:\n\n')).split('\n\n')[1].split('\n').map(s => {
    return s.substr(2);
  });

  return {
    filtered: true,
    id,
    title,
    summary,
    versions
  };
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

  console.log('Received a mail:');
  console.log(`From: ${fields.get('from')}`);
  console.log(`Subject: ${fields.get('subject')}`);

  if (web !== null) {
    let filtered = false;
    const usn = filterUSN(fields, files);
    if (usn.filtered) {
      filtered = true;
      const v = usn.versions.map(s => '\u2022 ' + s).join('\n');
      const message = `*${usn.id}: ${usn.title}.* ${usn.summary}\n\n영향을 받는 버전은 다음과 같습니다:\n${v}`;
      web.chat.postMessage(
        '#security',
        slackEscape(message),
        {
          link_names: false,
          as_user: true
        }
      );
    }
    if (!filtered) {
      const subject = fields.get('subject');
      const text = slackEscape(fields.get('stripped-text'));
      const fromRaw = fields.get('from');
      const fromRegexMatch = fromRegex.exec(fromRaw);
      const from = fromRegexMatch === null ? fromRaw : fromRegexMatch[1];
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
  }
  ctx.status = 200;
});

app.listen(3000);
