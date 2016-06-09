/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const electron = require('electron')
const app = electron.app
const fs = require('fs')
const path = require('path')
const underscore = require('underscore')
const messages = require('../js/constants/messages')

// commented out to pass lint
// const Immutable = require('immutable')
// const appActions = require('../js/actions/appActions')

const CommonMenu = require('../js/commonMenu')

// publisher mapping information for debugging goes to this file
const publishersPath = path.join(app.getPath('userData'), 'ledger-publishers.json')

// ledger alpha file goes here
const alphaPath = path.join(app.getPath('userData'), 'ledger-alpha.json')

// ledger logging information goes here
const logPath = path.join(app.getPath('userData'), 'ledger-log.json')

// ledger client state information goes here
const statePath = path.join(app.getPath('userData'), 'ledger-state.json')

// publisher synopsis state information goes here
const synopsisPath = path.join(app.getPath('userData'), 'ledger-synopsis.json')

var msecs = { day: 24 * 60 * 60 * 1000,
             hour: 60 * 60 * 1000,
             minute: 60 * 1000,
             second: 1000
          }

var client
var topPublishersN = 10
var nextPaymentPopup = underscore.now() + (6 * msecs.minute)

var LedgerPublisher
var synopsis

var currentLocation
var currentTS

module.exports.init = () => {
  var LedgerClient

  var makeClient = (path, cb) => {
    fs.readFile(path, (err, data) => {
      var state

      if (err) return console.log('read error: ' + err.toString())

      try {
        state = JSON.parse(data)
        console.log('\nstarting up ledger-client integration')
        cb(null, state)
      } catch (ex) {
        console.log(path + (state ? ' ledger' : ' parse') + ' error: ' + ex.toString())
        cb(ex)
      }
    })
  }

  LedgerClient = require('ledger-client')
  fs.access(statePath, fs.FF_OK, (err) => {
    if (!err) {
      console.log('found ' + statePath)

      makeClient(statePath, (err, state) => {
        if (err) return

        client = LedgerClient(state.personaId, state.options, state)
        client.sync(callback)
      })
      return
    }
    if (err.code !== 'ENOENT') console.log('statePath read error: ' + err.toString())

    fs.access(alphaPath, fs.FF_OK, (err) => {
      if (err) {
        if (err.code !== 'ENOENT') console.log('accessPath read error: ' + err.toString())
        return
      }

      console.log('found ' + alphaPath)
      makeClient(alphaPath, (err, alpha) => {
        if (err) return

        client = LedgerClient(alpha.client.personaId, alpha.client.options, null)
        client.sync(callback)
      })
    })
  })

  LedgerPublisher = require('ledger-publisher')
  fs.readFile(synopsisPath, (err, data) => {
    console.log('\nstarting up ledger publisher integration')
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
var syncWriter = (path, obj, options, cb) => {
  if (syncP[path]) return
  syncP[path] = true

  if (typeof options === 'function') {
    cb = options
    options = null
  }
  options = underscore.defaults(options || {}, { encoding: 'utf8', mode: parseInt('644', 8) })

  fs.writeFile(path, JSON.stringify(obj, null, 2), options, (err) => {
    syncP[path] = false

    if (err) console.log('write error: ' + err.toString())

    cb(err)
  })
}

var callback = (err, result, delayTime) => {
  var now
  var entries = client.report()

  console.log('\nledger-client callback: errP=' + (!!err) + ' resultP=' + (!!result) + ' delayTime=' + delayTime)

  if (err) return console.log('ledger-client error: ' + err.toString() + '\n' + err.stack)

  if (entries) syncWriter(logPath, entries, { flag: 'a' }, () => {})

  if (!result) return run(delayTime)

  if (result.thisPayment) {
    console.log(JSON.stringify(result.thisPayment, null, 2))

    now = underscore.now()
    if (nextPaymentPopup <= now) {
      nextPaymentPopup = now + (6 * msecs.hour)

      CommonMenu.sendToFocusedWindow(electron.BrowserWindow.getFocusedWindow(), [messages.SHORTCUT_NEW_FRAME, result.thisPayment.paymentURL])
    }
  }

  syncWriter(statePath, result, () => { run(delayTime) })
}

var run = (delayTime) => {
  console.log('\nledger-client run: delayTime=' + delayTime)

  if (delayTime > 0) return setTimeout(() => { if (client.sync(callback)) return run(0) }, delayTime)

  if (client.isReadyToReconcile()) client.reconcile(synopsis.topN(topPublishersN), callback)
}

var persistPublishers = () => {
  syncWriter(publishersPath, publishers, () => {
/* TBD: write HTML file

    var mappings = {}

    underscore.keys(publishers).sort().forEach((publisher) => { mappings[publisher] = publishers[publisher] })
 */
  })
}

var persistSynopsis = () => {
  syncWriter(synopsisPath, synopsis, () => {})
}

// Messages are sent from the renderer process here for processing
const ipc = require('electron').ipcMain
var locations = {}
var publishers = {}

module.exports.handleLedgerVisit = (e, location) => {
  var publisher

  if ((!synopsis) || (!location)) return

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

  // If the location has changed and we have a previous timestamp
  if (location !== currentLocation && !(currentLocation || '').match(/^about/) && currentTS) {
    console.log('addVisit ' + currentLocation)
    if (synopsis.addVisit(currentLocation, (new Date()).getTime() - currentTS)) persistSynopsis()
    console.log(synopsis.topN(topPublishersN))
  }
  // record the new current location and timestamp
  currentLocation = location
  currentTS = (new Date()).getTime()
}

// courtesy of https://stackoverflow.com/questions/13483430/how-to-make-rounded-percentages-add-up-to-100#13485888
var foo = (l, target) => {
  var off = target - underscore.reduce(l, (acc, x) => { return acc + Math.round(x) }, 0)

  return underscore.chain(l)
                   .sortBy((x) => { return Math.round(x) - x })
                   .map((x, i) => { return Math.round(x) + (off > i) - (i >= (l.length + off)) })
                   .value()
}

module.exports.handleGeneralCommunication = (event) => {
  var i, data, duration, n, pct, results, total

  results = []
  underscore.keys(synopsis.publishers).forEach((publisher) => {
    results.push(underscore.extend({ publisher: publisher }, underscore.omit(synopsis.publishers[publisher], 'window')))
  }, synopsis)
  results = underscore.sortBy(results, (entry) => { return -entry.score })

  n = topPublishersN
  if ((n > 0) && (results.length > n)) results = results.slice(0, n)
  n = results.length

  total = 0
  for (i = 0; i < n; i++) { total += results[i].score }
  if (total === 0) return

  data = []
  pct = []
  for (i = 0; i < n; i++) {
    data[i] = { rank: i + 1,
                   site: results[i].publisher, views: results[i].visits,
                   daysSpent: 0, hoursSpent: 0, minutesSpent: 0, secondsSpent: 0
                 }
    pct[i] = Math.round((results[i].score * 100) / total)

    duration = results[i].duration
    if (duration >= msecs.day) {
      data[i].daysSpent = Math.max(Math.round(duration / msecs.day), 1)
    } else if (duration >= msecs.hour) {
      data[i].hoursSpent = Math.max(Math.floor(duration / msecs.hour), 1)
      data[i].minutesSpent = Math.round((duration % msecs.hour) / msecs.minute)
    } else if (duration >= msecs.minute) {
      data[i].minutesSpent = Math.max(Math.round(duration / msecs.minute), 1)
      data[i].secondsSpent = Math.round((duration % msecs.minute) / msecs.second)
    } else {
      data[i].secondsSpent = Math.max(Math.round(duration / msecs.second), 1)
    }
  }

  pct = foo(pct, 100)
  for (i = 0; i < n; i++) { data[i].percentage = pct[i] }

  // TODO fill in required info
  event.returnValue = {
    publishers: data,
    enabled: false,
    synopsis: null,
    logs: null
  }
}

// If we are in the main process
if (ipc) {
  ipc.on(messages.LEDGER_VISIT, module.exports.handleLedgerVisit)
  ipc.on(messages.LEDGER_GENERAL_COMMUNICATION, module.exports.handleGeneralCommunication)
}
