/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const electron = require('electron')
const app = electron.app
const fs = require('fs')
const moment = require('moment')
const path = require('path')
const underscore = require('underscore')
const messages = require('../js/constants/messages')
const request = require('../js/lib/request')

// ledger alpha file goes here
const alphaPath = path.join(app.getPath('userData'), 'ledger-alpha.json')

// TBD: remove this post beta
// ledger logging information goes here
const logPath = path.join(app.getPath('userData'), 'ledger-log.json')

// TBD: move this into appStore.getState().get(‘ledger.client’)
const statePath = path.join(app.getPath('userData'), 'ledger-state.json')

// TBD: move this into appStore.getState().get(‘publishers.synopsis’)
const synopsisPath = path.join(app.getPath('userData'), 'ledger-synopsis.json')

var msecs = { day: 24 * 60 * 60 * 1000,
              hour: 60 * 60 * 1000,
              minute: 60 * 1000,
              second: 1000
          }

var client
var topPublishersN = 25

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
        console.log('\nstarting up ledger client integration')
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

        returnValue._internal.reconcileStamp = state.reconcileStamp
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

var returnValue = {
  enabled: false,
  synopsis: null,
  publishers: null,
  statusText: null,
  buttonLabel: null,
  buttonURL: null,

  _internal: {}
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

var logs = []
var callback = (err, result, delayTime) => {
  var i, then
  var entries = client.report()
  var now = underscore.now()

  console.log('\nledger client callback: errP=' + (!!err) + ' resultP=' + (!!result) + ' delayTime=' + delayTime)

  if (err) return console.log('ledger client error: ' + err.toString() + '\n' + err.stack)

  returnValue.enabled = true

  if (entries) {
    then = now - (7 * msecs.day)
    logs = logs.concat(entries)

    for (i = 0; i < logs.length; i++) if (logs[i].when > then) break
    if ((i !== 0) && (i !== logs.length)) logs = logs.slice(i)
    if (result) entries.push({ who: 'callback', what: result, when: underscore.now() })

    syncWriter(logPath, entries, { flag: 'a' }, () => {})
  }

  if (!result) return run(delayTime)

  delete returnValue.buttonLabel
  delete returnValue.buttonURL
  returnValue._internal.reconcileStamp = result.reconcileStamp
  if (result.wallet) {
    console.log('\n\n\ndiff=' + (now - result.reconcileStamp))
    if (result.thisPayment) {
      returnValue.buttonLabel = 'Reconcile'
      returnValue.buttonURL = result.thisPayment.paymentURL
    }
  } else if (result.persona) {
    if (result.properties) {
      returnValue.statusText = 'Anonymously ' + (result.options.wallet ? 'registered' : 'created') + ' wallet'
    } else {
      returnValue.statusText = 'Preparing to anonymously ' + (result.options.wallet ? 'register' : 'create') + ' wallet'
    }
  } else {
    returnValue.statusText = 'Initializing'
  }

  syncWriter(statePath, result, () => { run(delayTime) })
}

var run = (delayTime) => {
  console.log('\nledger client run: delayTime=' + delayTime)

  if (delayTime > 0) return setTimeout(() => { if (client.sync(callback)) return run(0) }, delayTime)

  if (client.isReadyToReconcile()) client.reconcile(synopsis.topN(topPublishersN), callback)
}

var locations = {}
var publishers = {}

// a 24x24 transparent PNG
const faviconPNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA0xpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTExIDc5LjE1ODMyNSwgMjAxNS8wOS8xMC0wMToxMDoyMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MUNFNTM2NTcxQzQyMTFFNjhEODk5OTY1MzJCOUU0QjEiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MUNFNTM2NTYxQzQyMTFFNjhEODk5OTY1MzJCOUU0QjEiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTUgKE1hY2ludG9zaCkiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjUxZDUzZDBmLTYzOWMtMTE3OS04Yjk3LTg3Y2M5YTUyOWRmMSIgc3RSZWY6ZG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjUxZDUzZDBmLTYzOWMtMTE3OS04Yjk3LTg3Y2M5YTUyOWRmMSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PmF3+n4AAAAoSURBVHja7M1BAQAABAQw9O98SvDbCqyT1KepZwKBQCAQCAQ3VoABAAu6Ay00hnjWAAAAAElFTkSuQmCC'

var synopsisNormalizer = () => {
  var i, duration, n, pct, publisher, results, total
  var data = []

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
  if (total === 0) return data

  pct = []
  for (i = 0; i < n; i++) {
    publisher = synopsis.publishers[results[i].publisher]
    duration = results[i].duration

    data[i] = { rank: i + 1,
                 site: results[i].publisher, views: results[i].visits, duration: duration,
                 daysSpent: 0, hoursSpent: 0, minutesSpent: 0, secondsSpent: 0,
                 faviconURL: publisher.faviconURL || faviconPNG
               }
    if (results[i].method) data[i].publisherURL = results[i].method + '://' + results[i].publisher
    pct[i] = Math.round((results[i].score * 100) / total)

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
  for (i = 0; i < n; i++) {
    if (pct[i] === 0) {
      data = data.slice(0, i)
      break
    }

    data[i].percentage = pct[i]
  }

  return data
}

var publisherNormalizer = () => {
  var data = []
  var then = underscore.now() - (7 * msecs.day)

  underscore.keys(publishers).sort().forEach((publisher) => {
    var entries = publishers[publisher]
    var i

    for (i = 0; i < entries.length; i++) if (entries[i].when > then) break
    if ((i !== 0) && (i !== entries.length)) entries = entries.slice(i)

    data.push({ publisher: publisher, locations: underscore.map(entries, (entry) => { return entry.location }) })
  })

  if (data.length === 0) {
    data = [
      {
        'publisher': 'facebook.com',
        'locations': [
          'http://facebook.com/',
          'https://www.facebook.com/',
          'https://www.facebook.com/?sk=h_chr'
        ]
      },
      {
        'publisher': 'whatwg.org',
        'locations': [
          'https://whatwg.org/'
        ]
      },
      {
        'publisher': 'wsj.com',
        'locations': [
          'http://wsj.com/',
          'http://www.wsj.com/',
          'http://www.wsj.com/articles/gawker-declaring-bankruptcy-will-be-put-up-for-auction-1465578030',
          'http://www.wsj.com/articles/tesla-defends-car-suspension-systems-nondisclosure-statements-1465558823',
          'http://www.wsj.com/articles/muhammad-alis-memorial-draws-thousands-of-fans-1465570220',
          'http://www.wsj.com/articles/the-unimprovable-awards-celebrating-6-perfect-things-1465568511',
          'http://www.wsj.com/news/us',
          'http://www.wsj.com/articles/white-house-asks-colleges-to-reconsider-weighing-criminal-history-in-applications-1465571388'
        ]
      }
    ]
  }

  return data
}

// courtesy of https://stackoverflow.com/questions/13483430/how-to-make-rounded-percentages-add-up-to-100#13485888
var foo = (l, target) => {
  var off = target - underscore.reduce(l, (acc, x) => { return acc + Math.round(x) }, 0)

  return underscore.chain(l)
                   .sortBy((x) => { return Math.round(x) - x })
                   .map((x, i) => { return Math.round(x) + (off > i) - (i >= (l.length + off)) })
                   .value()
}

module.exports.handleLedgerVisit = (e, location) => {
  var i, publisher

  if ((!synopsis) || (!location)) return

  if (!locations[location]) {
    locations[location] = true

    try {
      publisher = LedgerPublisher.getPublisher(location)
      if (publisher) {
        if (!publishers[publisher]) publishers[publisher] = []
        publishers[publisher].push({ when: underscore.now(), location: location })

        delete returnValue.publishers
      }
    } catch (ex) {
      console.log('getPublisher error: ' + ex.toString())
    }
  }

  // If the location has changed and we have a previous timestamp
  if (location !== currentLocation && !(currentLocation || '').match(/^about/) && currentTS) {
    console.log('addVisit ' + currentLocation + ' for ' + moment.duration((new Date()).getTime() - currentTS).humanize())

// TBD: may need to have markup available...
    publisher = synopsis.addVisit(currentLocation, (new Date()).getTime() - currentTS)
    if (publisher) {
      i = location.indexOf(':/')
      if ((i > 0) && (!synopsis.publishers[publisher].method)) synopsis.publishers[publisher].method = location.substr(0, i)
/* TBD: should look for:

        <link rel='icon' href='...' />
        <link rel='shortcut icon' href='...' />
 */
      if ((publisher.indexOf('/') === -1) && (typeof synopsis.publishers[publisher].faviconURL === 'undefined') &&
          (synopsis.publishers[publisher].method)) {
        console.log('request: ' + synopsis.publishers[publisher].method + '://' + publisher + '/favicon.ico')
        synopsis.publishers[publisher].faviconURL = null
        request.request({ url: synopsis.publishers[publisher].method + '://' + publisher + '/favicon.ico',
                          responseType: 'blob' }, (err, response, blob) => {
          console.log('\nresponse: ' + synopsis.publishers[publisher].method + '://' + publisher + '/favicon.ico' +
                      ' errP=' + (!!err) + ' blob=' + (blob || '').substr(0, 40) + '\n' + JSON.stringify(response, null, 2))
          if (err) return console.log('response error: ' + err.toString())
          if ((response.statusCode !== 200) || (blob.indexOf('data:image/') !== 0)) return

          synopsis.publishers[publisher].faviconURL = blob
          syncWriter(synopsisPath, synopsis, () => {})
        })
      }

      syncWriter(synopsisPath, synopsis, () => {})

      delete returnValue.synopsis
    }
  }
  // record the new current location and timestamp
  currentLocation = location
  currentTS = (new Date()).getTime()
}

var handleGeneralCommunication = (event) => {
  var now, timestamp

  if (!returnValue.synopsis) returnValue.synopsis = synopsisNormalizer()

  if (!returnValue.publishers) returnValue.publishers = publisherNormalizer()

  if (returnValue._internal.reconcileStamp) {
    now = underscore.now()

    timestamp = now
    underscore.keys(synopsis.publishers).forEach((publisher) => {
      var then = underscore.last(synopsis.publishers[publisher].window).timestamp

      if (timestamp > then) timestamp = then
    })

    returnValue.statusText = 'Publisher history as of ' + moment(timestamp).fromNow()
    if (!returnValue.buttonURL) {
      returnValue.statusText +=
        ', reconcilation ' +
        moment(returnValue._internal.reconcileStamp)[now < returnValue._internal.reconcileStamp ? 'toNow' : 'fromNow']()
    }
    console.log(returnValue.statusText)
  }

  event.returnValue = returnValue
}

// If we are in the main process
const ipc = require('electron').ipcMain

if (ipc) {
  ipc.on(messages.LEDGER_VISIT, module.exports.handleLedgerVisit)
  ipc.on(messages.LEDGER_GENERAL_COMMUNICATION, handleGeneralCommunication)
}
