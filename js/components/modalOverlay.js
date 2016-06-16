/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const React = require('react')
const ImmutableComponent = require('./immutableComponent')
const classnames = require('classnames')

/**
 * Represents a modal overlay
 */

class ModalOverlay extends ImmutableComponent {
  render () {
    return <div className={classnames('modal fade', { hidden: !this.props.shouldShow })} role='alert'>
      <div className='dialog'>
        <button type='button' className='close pull-right' onClick={this.props.onHide}>
          <span>&times;</span>
        </button>
        <div className='settingsListTitle' data-l10n-id={this.props.title} />
        {this.props.content}
        <button type='button' className='pull-right' onClick={this.props.onHide}>Done</button>
      </div>
    </div>
  }
}

ModalOverlay.propTypes = {
  title: React.PropTypes.string.isRequired,
  onShow: React.PropTypes.func.isRequired,
  onHide: React.PropTypes.func.isRequired
}

module.exports = ModalOverlay
