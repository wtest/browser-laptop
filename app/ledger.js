/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const electron = require('electron')
const app = electron.app
const fs = require('fs')
const path = require('path')
const messages = require('../js/constants/messages')

const storagePath = path.join(app.getPath('userData'), 'publisher-top-n.json')

var LedgerPublisher
// var LedgerClient
var synopsis
var currentLocation
var currentTS

module.exports.init = () => {
  console.log('Starting up ledger integration')
  // LedgerClient = require('ledger-client')
  LedgerPublisher = require('ledger-publisher')
  synopsis = new (LedgerPublisher.Synopsis)()
}

module.exports.topPublishers = (n) => {
  console.log('topPublishers')
  return synopsis.topN(n)
}

// This is a debug method and will NOT be used in product (hence the sync file save)
module.exports.persistTopN = (n) => {
  var topN = synopsis.topN(n)
  console.log(topN)
  fs.writeFileSync(storagePath, JSON.stringify(topN, null, 2), 'utf-8')
}

// Messages are sent from the renderer process here for processing
const ipc = require('electron').ipcMain
if (ipc) {
  ipc.on(messages.LEDGER_VISIT, (e, location) => {
    if (location !== currentLocation && currentTS) {
      synopsis.addVisit(currentLocation, (new Date()).getTime() - currentTS)
      module.exports.persistTopN(10)
    }
    currentLocation = location
    currentTS = (new Date()).getTime()
  })
}
