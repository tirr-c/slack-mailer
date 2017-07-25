const {slackEscape} = require('./filter-util');

const fromRegex = /^\s*([^<]+?)\s*(?:<.+?>)?\s*$/;

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

function default2Slack(emailId, origin, resp) {
  const message =
    `${slackEscape(resp.from)}님의 메일이 도착했습니다: ` +
    `*<${origin}/logs/${emailId}|${slackEscape(resp.subject)}>*`;
  const channel = '#random';
  return {
    channel,
    message
  };
}

module.exports = {
  filter: filterDefault,
  convert: default2Slack
};
