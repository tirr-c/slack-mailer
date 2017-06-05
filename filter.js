const {slackEscape} = require('./util');

const baseUrl = process.env.BASE_URL || 'https://bacchus.erika.vbchunguk.me';
const fromRegex = /^\s*([^<]+?)\s*(?:<.+?>)?\s*$/;
const usnRegex = /^\s*\[(USN-\d+-\d+)\] (.*?)\s*$/;

async function filterUSN(fields, files) {
  const subject = fields.get('subject');
  const subjectRegex = usnRegex.exec(subject);
  if (subjectRegex === null) {
    throw undefined;
  }

  const id = subjectRegex[1];
  const title = subjectRegex[2];

  const text = fields.get('body-plain').replace(/\r\n/g, '\n');
  const summary = text.substr(text.indexOf('Summary:\n\n')).split('\n\n')[1].replace(/\n/g, ' ');

  const versions = text.substr(text.indexOf('and its derivatives:\n\n')).split('\n\n')[1].split('\n').map(s => {
    return s.substr(2);
  });

  return {
    id,
    title,
    summary,
    versions
  };
}

function USN2Slack(emailId, resp) {
  const v = resp.versions.map(s => slackEscape('\u2022 ' + s)).join('\n');
  const message =
    `*<${baseUrl}/logs/${emailId}|${resp.id}: ${slackEscape(resp.title)}.>* ` +
    `${slackEscape(resp.summary)}\n` +
    `영향을 받는 버전은 다음과 같습니다:\n${v}`;
  const channel = '#security';
  return {
    channel,
    message
  };
}

async function filterDefault(fields, files) {
  const fromRaw = fields.get('from');
  const fromRegexMatch = fromRegex.exec(fromRaw);
  const from = fromRegexMatch === null ? fromRaw : fromRegexMatch[1];
  const subject = fields.get('subject');
  return {
    from,
    subject
  };
}

function default2Slack(emailId, resp) {
  const message =
    `${slackEscape(resp.from)}님의 메일이 도착했습니다: ` +
    `*<${baseUrl}/logs/${emailId}|${slackEscape(resp.subject)}>*`;
  const channel = '#random';
  return {
    channel,
    message
  };
}

const filters = [
  {
    name: 'usn',
    filter: filterUSN,
    convert: USN2Slack
  },
  {
    name: 'default',
    filter: filterDefault,
    convert: default2Slack
  }
];

async function filter(emailId, fields, files) {
  for (const f of filters) {
    try {
      const resp = await f.filter(fields, files);
      console.log(`Email ${emailId} matched with ${f.name}`);
      const slack = f.convert(emailId, resp);
      return slack;
    } catch(e) {
      if (e != null) console.error(e);
    }
  }
}

module.exports = filter;
