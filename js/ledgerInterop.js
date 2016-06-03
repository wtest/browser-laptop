/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const ipc = global.require('electron').ipcRenderer
const messages = require('./constants/messages')

module.exports.visit = (location) => {
  ipc.send(messages.LEDGER_VISIT, location)
}
