# slack-mailer

*This is developed for internal use in Bacchus. May not appropriate for general
use.*

Relay email webhooks from [Mailgun][mailgun] to Slack.

This app does not open any standalone SMTP servers for now; instead, this opens
an HTTP server for webhooks, and is configured to accept ones from Mailgun.

[mailgun]: https://www.mailgun.com/


## Requirements

Node.js that supports ES6 features listed below, and npm(^5 is preferred). Used
ES6 features are:

* Arrow functions
* Classes
* Object destructive assignments
* `async`/`await`


## Configuration

### Setup Mailgun account

Configure your domain to accept incoming emails at [Mailgun][mailgun].

Then, create a route as following:

* **Expression Type**: Match Recipient
* **Recipient**: Email address which emails will be sent to.
* **Actions**:
  - Check **Forward**, and write down the webhook address.
    slack-mailer's webhook endpoint is `/notify`. You can use reverse proxy like
    nginx; if you've mount slack-mailer on `https://mailer.example.com/`, write
    `https://mailer.example.com/notify`.
  - Check **Stop**.

### Create a Slack bot

Create a new bot [here][slack-create-bot]. Set the username as you want. After
creating a bot, you can acquire the API token of the bot. **Make sure this is
not published.**

### Setup webhook server

Set `SLACK_BOT_TOKEN` environment variable with the API token you acquired in
the previous step.

#### With reverse proxy server
**`X-Forwarded-Host` and `X-Forwarded-Proto` headers should be set appropriately
if you're using reverse proxy!**

Set up reverse proxy for the webhook server using your favorite application such
as nginx. Port number can be set with `SERVER_PORT` environment variable;
default is 3000. Make sure the two HTTP headers listed above are set. You can
use the `proxy_set_header` directive if you use nginx.

```
proxy_set_header X-Forwarded-Host $http_host;
proxy_set_header X-Forwarded-Proto $scheme;
# more settings...

proxy_pass http://127.0.0.1:3000;
```

#### Without reverse proxy server
If you're not using any reverse proxy server, you should set `WITHOUT_PROXY`
environment variable to `1`, or any truthy value. If you set this variable, the
server will try to open on port 80. Set `SERVER_PORT` environment variable to
override.

### Test the webhook

After you finish your configuration, run the server.

```sh
npm install
npm start
```

Visit webhook URL directly in browser. It will response with "Not Acceptable."
This is normal, because the webhook won't accept HTTP GET request.

Now, test the webhook with Mailgun by sending a sample POST request. Open
Routes, and enter your webhook URL into "Send A Sample POST" endpoint textbox.
Press "Post." You should see "Re: Sample POST request" notification from the bot
in Slack channel `#random`.

### Securing the webhook

Check your Mailgun API key from Domains section. Then, set `MAILGUN_API_KEY`
environment variable with that key. By doing this, the server will check
whether incoming webhooks are really from Mailgun.

---

AGPL-3.0+
