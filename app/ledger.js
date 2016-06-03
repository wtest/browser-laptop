/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const electron = require('electron')
const app = electron.app
const fs = require('fs')
const path = require('path')
const messages = require('../js/constants/messages')

// publisher mapping information for debugging goes to this file
const publishersPath = path.join(app.getPath('userData'), 'ledger-publishers.json')

// ledger alpha file goes here
const alphaPath = path.join(app.getPath('userData'), 'ledger-alpha.json')

// ledger client state information goes here
const statePath = path.join(app.getPath('userData'), 'ledger-state.json')

// publisher synopsis state information goes here
const synopsisPath = path.join(app.getPath('userData'), 'ledger-synopsis.json')

// var LedgerClient
// var client

var LedgerPublisher
var synopsis

var currentLocation
var currentTS

module.exports.init = () => {
  console.log('Starting up ledger integration')

  // determine whether we should be using the ledger client
  // LedgerClient = require('ledger-client')
  fs.access(statePath, fs.FF_OK, (err) => {
    if (!err) {
      // client = ...
      return
    }

    fs.access(alphaPath, fs.FF_OK, (err) => {
      if (err) return

      // client = ...
    })
  })

  LedgerPublisher = require('ledger-publisher')
  synopsis = new (LedgerPublisher.Synopsis)()
  fs.readFile(synopsisPath, (err, data) => {
    if (err) {
      if (err.code !== 'ENOENT') console.log('synopsisPath read error: ' + err.toString())
      return
    }

    try {
      synopsis = new (LedgerPublisher.Synopsis)(data)
    } catch (ex) {
      console.log('synopsisPath parse error: ' + ex.toString())
    }
  })
}

module.exports.topPublishers = (n) => {
  console.log('topPublishers')
  return synopsis.topN(n)
}

// This is a debug method and will NOT be used in product (hence the sync file save)
var persistPublishers = () => {
  fs.writeFileSync(publishersPath, JSON.stringify(publishers, null, 2), 'utf-8')
}

var busyP = false
var persistSynopsis = () => {
  if (busyP) return

  fs.writeFile(synopsisPath, JSON.stringify(synopsis, null, 2), (err) => {
    busyP = false

    if (err) return console.log('synopsisPath write error: ' + err.toString())
  })
}

// Messages are sent from the renderer process here for processing
const ipc = require('electron').ipcMain
var locations = {}
var publishers = {}
if (ipc) {
  ipc.on(messages.LEDGER_VISIT, (e, location) => {
    var publisher

    if (!location) return

    if (!locations[location]) {
      locations[location] = true

      try {
        publisher = LedgerPublisher.getPublisher(location)
        if (publisher) {
          if (!publishers[publisher]) publishers[publisher] = []
          publishers[publisher].push(location)
          persistPublishers()
        }
      } catch (ex) {
        console.log('getPublisher error: ' + ex.toString())
      }
    }

    if (location !== currentLocation && currentTS) {
      console.log('addVisit ' + currentLocation)
      if (synopsis.addVisit(currentLocation, (new Date()).getTime() - currentTS)) persistSynopsis()

      console.log('top 10 publishers')
      console.log(synopsis.topN(10))
    }
    currentLocation = location
    currentTS = (new Date()).getTime()
  })
}
