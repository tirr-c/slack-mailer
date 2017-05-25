const {WebClient} = require('@slack/client');
const {Html5Entities} = require('html-entities');
const {fs, slackEscape, MailgunVerifier} = require('./util');
const {DataManager} = require('./data');
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

const data = new DataManager(`${__dirname}/data`);

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

  console.log('Filtering USN');
  const id = subjectRegex[1];
  const title = subjectRegex[2];

  const text = fields.get('body-plain').replace(/\r\n/g, '\n');
  const summary = text.substr(text.indexOf('Summary:\n\n')).split('\n\n')[1].replace(/\n/g, ' ');

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

const entities = new Html5Entities();
function composeEmailResponse(emailData) {
  const lines = ['<!DOCTYPE html>', '<html>', '<head>', '<meta charset="utf-8">'];
  lines.push(`<title>${entities.encode(emailData.subject)}</title>`);
  lines.push('</head>');
  lines.push('<body>');
  lines.push(`<h1>${entities.encode(emailData.subject)}</h1>`);
  lines.push(`<p>From: ${entities.encode(emailData.from)}</p>`);
  lines.push('<hr>');
  lines.push('<pre>');
  lines.push(entities.encode(emailData.body));
  lines.push('</pre>');
  lines.push('</body>');
  lines.push('</html>');
  return lines.join('');
}

const app = new Koa();

app.use(async (ctx, next) => {
  const path = require('path').dirname(ctx.path);
  if (path !== '/logs') return await next();
  const bn = require('path').basename(ctx.path);

  try {
    const emailData = await data.readJson(`${bn}.json`);
    ctx.type = 'text/html';
    ctx.body = composeEmailResponse(emailData);
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

  const subject = fields.get('subject');
  const fromRaw = fields.get('from');
  const body = fields.get('body-plain');
  const emailData = {
    subject,
    from: fromRaw,
    body
  };
  data.writeJson(`${emailId}.json`, emailData).catch(console.error);

  console.log('Received a mail:');
  console.log(`From: ${fromRaw}`);
  console.log(`Subject: ${subject}`);

  if (web !== null) {
    let filtered = false;
    const usn = filterUSN(fields, files);
    if (usn.filtered) {
      filtered = true;
      const v = usn.versions.map(s => slackEscape('\u2022 ' + s)).join('\n');
      const message =
        `*<https://bacchus.erika.vbchunguk.me/logs/${emailId}|${usn.id}: ${slackEscape(usn.title)}.>* ` +
        `${slackEscape(usn.summary)}\n\n영향을 받는 버전은 다음과 같습니다:\n${v}`;
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
      const fromRegexMatch = fromRegex.exec(fromRaw);
      const from = fromRegexMatch === null ? fromRaw : fromRegexMatch[1];
      web.chat.postMessage(
        '#random',
        `<https://bacchus.erika.vbchunguk.me/logs/${emailId}|${slackEscape(from)}님의 메일이 도착>했습니다.`,
        {
          link_names: false,
          as_user: true
        }
      );
    }
  }
  ctx.status = 200;
});

app.listen(3000);
