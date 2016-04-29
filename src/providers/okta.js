'use strict';

const Nightmare = require('nightmare');
const clui = require('clui');
const coinquirer = require('coinquirer');
const pkg = require('../../package.json');
const path = require('path');

const Okta = {
  name: 'Okta',

  login: function *(idpEntryUrl, username, password) {
    let spinner = new clui.Spinner('Logging in...');

    let ci = new coinquirer();
    username = username ? username : yield ci.prompt({
      type: 'input',
      message: 'Okta username (ex. user@domain.com):'
    });
    password = password ? password : yield ci.prompt({
      type: 'password',
      message: 'Okta password:'
    });

    spinner.start();

    let nightmare = Nightmare({show: false});
    let hasError = yield nightmare
      .useragent(pkg.description + ' v.' + pkg.version)
      .goto(idpEntryUrl)
      .type('input[name="username"]', username)
      .type('input[name="password"]', password)
      .click('input[name="login"]')
      .wait('body')
      .exists('#signin-feedback');
    spinner.stop();

    if (hasError) {
      let errMsg = yield nightmare.evaluate(function () {
        return document.querySelector('#signin-feedback').innerText;
      });
      yield fail(nightmare, errMsg);
    }

    // Provide verify code
    let totp = yield ci.prompt({
      type: 'input',
      message: 'Okta verify code:'
    });

    spinner = new clui.Spinner('Verifying...');
    spinner.start();

    yield nightmare
      .type('input[name="passcode"]', totp)
      .click('#verify_factor')
      .wait('#oktaSoftTokenAttempt\\.passcode\\.error:not(:empty), input[name="SAMLResponse"]');

    hasError = yield nightmare
      .exists('#oktaSoftTokenAttempt\\.passcode\\.error:not(:empty)');

    if (hasError) {
      let errMsg = yield nightmare.evaluate(function () {
        return document.querySelector('#oktaSoftTokenAttempt\\.edit\\.errors').innerText;
      });
      yield fail(nightmare, errMsg);
    }

    let samlAssertion = yield nightmare
      .wait('input[name="SAMLResponse"]')
      .evaluate(function () {
        return document.querySelector('input[name="SAMLResponse"]').value;
      });

    yield nightmare.end();
    spinner.stop();

    return samlAssertion;
  }
};

function *fail(nightmare, errMsg) {
  if (!process.env.DEBUG) { return; }

  yield nightmare
    .screenshot(path.join(process.cwd(), '.debug', 'error.png'))
    .html(path.join(process.cwd(), '.debug', 'error.html'), 'HTMLComplete');

  throw new Error(errMsg);
}

module.exports = Okta;
