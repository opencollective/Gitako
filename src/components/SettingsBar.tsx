import * as React from 'react'
import Icon from 'components/Icon'
import configHelper, { configKeys } from 'utils/configHelper'
import keyHelper from 'utils/keyHelper'
import { friendlyFormatShortcut, parseURLSearch, JSONRequest } from 'utils/general'
import { version } from '../../package.json'

const wikiLinks = {
  compressSingletonFolder: 'https://github.com/EnixCoda/Gitako/wiki/Compress-Singleton-Folder',
  changeLog: 'https://github.com/EnixCoda/Gitako/wiki/Change-Log',
  copyFileButton: 'https://github.com/EnixCoda/Gitako/wiki/Copy-file-and-snippet',
  copySnippet: 'https://github.com/EnixCoda/Gitako/wiki/Copy-file-and-snippet',
  createAccessToken:
    'https://github.com/EnixCoda/Gitako/wiki/How-to-create-access-token-for-Gitako%3F',
}

const oauth = {
  clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
  clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
}

const ACCESS_TOKEN_REGEXP = /^[0-9a-f]{40}$/

type Props = {
  accessToken?: string
  activated: boolean
  onAccessTokenChange: (accessToken: string) => void
  onShortcutChange: (shortcut: string) => void
  compressSingletonFolder: boolean
  copyFileButton: boolean
  copySnippetButton: boolean
  setCopyFile: (copyFileButton: Props['copyFileButton']) => void
  setCopySnippet: (copySnippetButton: Props['copySnippetButton']) => void
  setCompressSingleton: (compressSingletonFolder: Props['compressSingletonFolder']) => void
  toggleShowSettings: () => void
  toggleShowSideBarShortcut?: string
}

type State = {
  accessToken?: string
  accessTokenHint: React.ReactNode
  shortcutHint: string
  toggleShowSideBarShortcut?: string
  reloadHint: React.ReactNode
  varyOptions: {
    key: string
    label: string
    onChange: (e: React.FormEvent<HTMLInputElement>) => Promise<void> | void
    getValue: () => boolean
    wikiLink: string
  }[]
}

export default class SettingsBar extends React.PureComponent<Props, State> {
  state = {
    accessToken: '',
    accessTokenHint: '',
    shortcutHint: '',
    toggleShowSideBarShortcut: this.props.toggleShowSideBarShortcut,
    reloadHint: '',
    varyOptions: [
      {
        key: 'compress-singleton',
        label: 'Compress singleton folder',
        onChange: this.createOnToggleChecked(
          configKeys.compressSingletonFolder,
          this.props.setCompressSingleton,
        ),
        getValue: () => this.props.compressSingletonFolder,
        wikiLink: wikiLinks.compressSingletonFolder,
      },
      {
        key: 'copy-file',
        label: 'Copy File',
        onChange: this.createOnToggleChecked(configKeys.copyFileButton, this.props.setCopyFile),
        getValue: () => this.props.copyFileButton,
        wikiLink: wikiLinks.copyFileButton,
      },
      {
        key: 'copy-snippet',
        label: 'Copy Snippet',
        onChange: this.createOnToggleChecked(
          configKeys.copySnippetButton,
          this.props.setCopySnippet,
        ),
        getValue: () => this.props.copySnippetButton,
        wikiLink: wikiLinks.copySnippet,
      },
    ],
  }

  componentDidMount() {
    if (!this.props.accessToken) this.trySetUpAccessTokenWithCode()
  }

  componentWillReceiveProps({ toggleShowSideBarShortcut }: Props) {
    if (toggleShowSideBarShortcut !== this.props.toggleShowSideBarShortcut) {
      this.setState({ toggleShowSideBarShortcut })
    }
  }

  private async trySetUpAccessTokenWithCode() {
    const search = parseURLSearch()
    if ('code' in search) {
      const res = await JSONRequest('https://github.com/login/oauth/access_token', {
        code: search.code,
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
      })
      const { access_token: accessToken, scope } = res
      if (scope !== 'repo' || !accessToken) {
        throw new Error(`Cannot resolve token response: '${JSON.stringify(res)}'`)
      }
      window.history.pushState({}, 'removed code', window.location.pathname.replace(/#.*$/, ''))
      this.setState({ accessToken }, () => this.saveToken(''))
    }
  }

  onInputAccessToken = (event: React.FormEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget
    this.setState({
      accessToken: value,
      accessTokenHint: ACCESS_TOKEN_REGEXP.test(value) ? '' : 'This token is in unknown format.',
    })
  }

  onPressAccessToken = (event: React.KeyboardEvent) => {
    const { key } = event
    if (key === 'Enter') {
      this.saveToken()
    }
  }

  saveToken = async (
    hint: State['accessTokenHint'] = (
      <span>
        <a href="#" onClick={() => window.location.reload()}>
          Reload
        </a>{' '}
        to activate!
      </span>
    ),
  ) => {
    const { onAccessTokenChange } = this.props
    const { accessToken } = this.state
    if (accessToken) {
      await configHelper.setOne(configKeys.accessToken, accessToken)
      onAccessTokenChange(accessToken)
      this.setState({
        accessToken: '',
        accessTokenHint: hint,
      })
    }
  }

  clearToken = async () => {
    const { onAccessTokenChange } = this.props
    await configHelper.setOne(configKeys.accessToken, '')
    onAccessTokenChange('')
    this.setState({ accessToken: '' })
  }

  saveShortcut = async () => {
    const { onShortcutChange } = this.props
    const { toggleShowSideBarShortcut } = this.state
    await configHelper.setOne(configKeys.shortcut, toggleShowSideBarShortcut)
    if (typeof toggleShowSideBarShortcut === 'string') {
      onShortcutChange(toggleShowSideBarShortcut)
      this.setState({
        shortcutHint: 'Shortcut is saved!',
      })
    }
  }

  onShortCutInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    // Clear shortcut with backspace
    const shortcut = e.key === 'Backspace' ? '' : keyHelper.parseEvent(e)
    this.setState({ toggleShowSideBarShortcut: shortcut })
  }

  showReloadHint = () => {
    this.setState({
      reloadHint: (
        <span>
          Saved,{' '}
          <a href="#" onClick={() => window.location.reload()}>
            reload
          </a>{' '}
          to apply.
        </span>
      ),
    })
  }

  createOnToggleChecked(
    configKey: configKeys,
    set: (value: boolean) => void,
  ): (e: React.FormEvent<HTMLInputElement>) => Promise<void> {
    return async e => {
      const enabled = e.currentTarget.checked
      await configHelper.setOne(configKey, enabled)
      set(enabled)
      this.showReloadHint()
    }
  }

  render() {
    const {
      accessTokenHint,
      toggleShowSideBarShortcut,
      shortcutHint,
      accessToken,
      reloadHint,
      varyOptions,
    } = this.state
    const { toggleShowSettings, activated } = this.props
    const hasAccessToken = Boolean(this.props.accessToken)
    return (
      <div className={'gitako-settings-bar'}>
        {activated && (
          <React.Fragment>
            <h3 className={'gitako-settings-bar-title'}>Settings</h3>
            <div className={'gitako-settings-bar-content'}>
              <div className={'shadow-shelter'} />
              <div className={'gitako-settings-bar-content-section access-token'}>
                <h4>
                  Access Token
                  <a href={wikiLinks.createAccessToken} target="_blank">
                    &nbsp;(?)
                  </a>
                </h4>
                {!hasAccessToken && (
                  <a
                    href={`https://github.com/login/oauth/authorize?client_id=${
                      oauth.clientId
                    }&scope=repo&redirect_uri=${encodeURIComponent(window.location.href)}`}
                  >
                    Create with OAuth
                  </a>
                )}
                <div className={'access-token-input-control'}>
                  <input
                    className={'access-token-input form-control'}
                    disabled={hasAccessToken}
                    placeholder={hasAccessToken ? 'Your token is saved' : 'Input your token here'}
                    value={accessToken}
                    onChange={this.onInputAccessToken}
                    onKeyPress={this.onPressAccessToken}
                  />
                  {hasAccessToken && !accessToken ? (
                    <button className={'btn'} onClick={this.clearToken}>
                      Clear
                    </button>
                  ) : (
                    <button className={'btn'} onClick={this.saveToken} disabled={!accessToken}>
                      Save
                    </button>
                  )}
                </div>
                {accessTokenHint && <span className={'hint'}>{accessTokenHint}</span>}
              </div>
              <div className={'gitako-settings-bar-content-section toggle-shortcut'}>
                <h4>Toggle Shortcut</h4>
                <span>Set a combination of keys for toggling Gitako sidebar.</span>
                <br />
                <div className={'toggle-shortcut-input-control'}>
                  <input
                    className={'toggle-shortcut-input form-control'}
                    placeholder={'focus here and press the shortcut keys'}
                    value={friendlyFormatShortcut(toggleShowSideBarShortcut)}
                    onKeyDown={this.onShortCutInputKeyDown}
                    readOnly
                  />
                  <button className={'btn'} onClick={this.saveShortcut}>
                    Save
                  </button>
                </div>
                {shortcutHint && <span className={'hint'}>{shortcutHint}</span>}
              </div>
              <div className={'gitako-settings-bar-content-section others'}>
                <h4>More Options</h4>
                {varyOptions.map(option => (
                  <React.Fragment key={option.key}>
                    <label htmlFor={option.key}>
                      <input
                        id={option.key}
                        name={option.key}
                        type={'checkbox'}
                        onChange={option.onChange}
                        checked={option.getValue()}
                      />
                      &nbsp;{option.label}&nbsp;
                      <a href={option.wikiLink} target={'_blank'}>
                        (?)
                      </a>
                    </label>
                    <br />
                  </React.Fragment>
                ))}
                {reloadHint && <div className={'hint'}>{reloadHint}</div>}
              </div>
              <div className={'gitako-settings-bar-content-section issue'}>
                <h4>Contact</h4>
                <a href="https://github.com/EnixCoda/Gitako/issues" target="_blank">
                  Bug report / feature request.
                </a>
              </div>
            </div>
          </React.Fragment>
        )}
        <div className={'placeholder-row'}>
          <a
            className={'version'}
            href={wikiLinks.changeLog}
            target={'_blank'}
            title={'Check out new features!'}
          >
            v{version}
          </a>
          {activated ? (
            <Icon
              type={'chevron-down'}
              className={'hide-settings-icon'}
              onClick={toggleShowSettings}
            />
          ) : (
            <Icon type={'gear'} className={'show-settings-icon'} onClick={toggleShowSettings} />
          )}
        </div>
      </div>
    )
  }
}
