/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const electron = require('electron')
const app = electron.app
const fs = require('fs')
const path = require('path')
// const underscore = require('underscore')
const messages = require('../js/constants/messages')

// publisher mapping information for debugging goes to this file
const publishersPath = path.join(app.getPath('userData'), 'ledger-publishers.json')

// ledger alpha file goes here
const alphaPath = path.join(app.getPath('userData'), 'ledger-alpha.json')

// ledger client state information goes here
const statePath = path.join(app.getPath('userData'), 'ledger-state.json')

// publisher synopsis state information goes here
const synopsisPath = path.join(app.getPath('userData'), 'ledger-synopsis.json')

var enabledP

// var LedgerClient
// var client

var LedgerPublisher
var synopsis

var currentLocation
var currentTS

module.exports.init = () => {
  console.log('Starting up ledger integration')

  // VERY temporary...
  enabledP = true

  // determine whether we should be using the ledger client
  // LedgerClient = require('ledger-client')
  fs.access(statePath, fs.FF_OK, (err) => {
    if (!err) {
      enabledP = true
      console.log('found ' + statePath)
      return
    }
    if (err.code !== 'ENOENT') console.log('statePath read error: ' + err.toString())

    fs.access(alphaPath, fs.FF_OK, (err) => {
      if (err) {
        if (err.code !== 'ENOENT') console.log('accessPath read error: ' + err.toString())
        return
      }

      enabledP = true
      console.log('found ' + alphaPath)
      // client = ...
    })
  })

  LedgerPublisher = require('ledger-publisher')
  fs.readFile(synopsisPath, (err, data) => {
    synopsis = new (LedgerPublisher.Synopsis)()

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

var syncP = {}
var syncWriter = (path, data, callback) => {
  if (syncP[path]) return
  syncP[path] = true

  fs.writeFile(path, data, (err) => {
    syncP[path] = false

    if (err) console.log('write error: ' + err.toString())

    callback(err)
  })
}

var persistPublishers = () => {
  syncWriter(publishersPath, JSON.stringify(publishers, null, 2), () => {
/* TBD: write HTML file

    var mappings = {}

    underscore.keys(publishers).sort().forEach((publisher) => { mappings[publisher] = publishers[publisher] })
 */
  })
}

var persistSynopsis = () => {
  syncWriter(synopsisPath, JSON.stringify(synopsis, null, 2), () => {
/* TBD: write HTML file

 */
  })
}

// Messages are sent from the renderer process here for processing
const ipc = require('electron').ipcMain
var locations = {}
var publishers = {}
if (ipc) {
  ipc.on(messages.LEDGER_VISIT, (e, location) => {
    var publisher

    if ((!enabledP) || (!synopsis) || (!location)) return

    console.log('\n' + location + ': new=' + (!locations[location]))
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
