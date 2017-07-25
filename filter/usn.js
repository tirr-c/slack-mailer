const {slackEscape} = require('./filter-util');

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

function USN2Slack(emailId, origin, resp) {
  const v = resp.versions.map(s => slackEscape('\u2022 ' + s)).join('\n');
  const message =
    `*<${origin}/logs/${emailId}|${resp.id}: ${slackEscape(resp.title)}.>* ` +
    `${slackEscape(resp.summary)}\n` +
    `영향을 받는 버전은 다음과 같습니다:\n${v}`;
  const channel = '#security';
  return {
    channel,
    message
  };
}

module.exports = {
  filter: filterUSN,
  convert: USN2Slack
};
