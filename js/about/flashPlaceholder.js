/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const React = require('react')
const ImmutableComponent = require('../components/immutableComponent')

require('../../less/about/flash.less')

class FlashPlaceholder extends ImmutableComponent {
  constructor () {
    super()
    this.state = {
      siteOrigin: 'foo',
      sourceOrigin: 'bar'
    }
  }

  render () {
    // TODO: Localization doesn't work due to CORS error from inside iframe
    const flashRightClick = 'Right-click to run Adobe Flash'
    const flashSubtext = `from ${this.state.sourceOrigin} on ${this.state.siteOrigin}.`
    const flashExpirationText = 'Approvals expire 7 days after last site visit.'
    return <div>
      <div className='flashMainContent'>
        <img src='img/bravePluginAlert.png' />
        <div id='flashRightClick'>{flashRightClick}</div>
        <div className='flashSubtext' data-l10n-args={JSON.stringify({
          source: this.state.sourceOrigin,
          site: this.state.siteOrigin
        })}>{flashSubtext}</div>
      </div>
      <div className='flashFooter'>
        {flashExpirationText}
      </div>
    </div>
  }
}

module.exports = <FlashPlaceholder />
