const ledgerPublisher = require('ledger-publisher')
// const ledgerClient = require('ledger-client')

module.exports.startup = () => {
  // Check for
}

module.exports.init = () => {
  module.exports.topPublishers(5)
}

module.exports.topPublishers = (n) => {
  n = n || 10
  var synop = new ledgerPublisher.Synopsis({})
  console.log(synop)
  console.log(synop.topN(10))
}

module.exports.visit = (location) => {
  console.log(location + ' in ledger')
}
