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
  getDialogContent () {
    var title = !this.props.emptyDialog ? <div className='settingsListTitle' data-l10n-id={this.props.title} /> : null
    var content = this.props.content
    var button = !this.props.emptyDialog ? <button type='button' className='pull-right alt' onClick={this.props.onHide} data-l10n-id='done' /> : null
    return <div className='dialog'>
      <button type='button' className='close pull-right' onClick={this.props.onHide}>
        <span>&times;</span>
      </button>
      {title}
      {content}
      {button}
    </div>
  }
  render () {
    return <div className={classnames('modal fade', { hidden: !this.props.shouldShow })} role='alert'>
      {this.getDialogContent()}
    </div>
  }
}

ModalOverlay.propTypes = {
  title: React.PropTypes.string.isRequired,
  onShow: React.PropTypes.func.isRequired,
  onHide: React.PropTypes.func.isRequired
}

module.exports = ModalOverlay
