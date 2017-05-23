const {WebClient} = require('@slack/client');
const {fs} = require('./util');
const {MailgunVerifier} = require('./verifier');
const Koa = require('koa');
const concat = require('concat-stream');
const {Form} = require('multiparty');

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

  if (verifier !== null) {
    const [timestamp] = fields.timestamp;
    const [token] = fields.token;
    const [signature] = fields.signature;
    const valid = verifier.verify(timestamp, token, signature);
    ctx.assert(valid, 400);
  }

  console.log(fields['body-plain'][0]);
  console.log();
  console.log('Files:');
  for (const [file] of Object.values(files)) {
    console.log(`  ${file.fieldName}: ${file.originalFilename} (${file.size} bytes)`);
  }
  console.log();
  ctx.status = 200;
});

app.listen(3000);
