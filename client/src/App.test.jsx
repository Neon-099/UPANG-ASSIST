import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  cleanup()
})

function openSignup() {
  fireEvent.click(screen.getAllByRole('button', { name: /^sign up$/i })[0])
  act(() => {
    vi.advanceTimersByTime(180)
  })
}

function scrollLegalDocumentToEnd(label) {
  const documentRegion = screen.getByRole('region', { name: `${label} document` })
  Object.defineProperties(documentRegion, {
    scrollTop: { configurable: true, value: 900 },
    clientHeight: { configurable: true, value: 300 },
    scrollHeight: { configurable: true, value: 1200 },
  })
  fireEvent.scroll(documentRegion)
}

describe('authentication flow', () => {
  it('shows the login page on first load', () => {
    render(<App />)

    expect(screen.getByText(/Welcome Back to/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /sign up/i }).length).toBeGreaterThan(0)
  })

  it('transitions between login and signup without showing the home loading screen', () => {
    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: /^sign up$/i })[0])
    expect(document.querySelector('.auth-transition-page--exiting')).toBeInTheDocument()
    expect(screen.getByText(/Welcome Back to/i)).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(180)
    })
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
    expect(document.querySelector('.auth-transition-page--entering')).toBeInTheDocument()
    expect(screen.queryByText(/preparing your workspace/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /^log in$/i })[0])
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
    expect(document.querySelector('.auth-transition-page--exiting')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(180)
    })
    expect(screen.getByText(/Welcome Back to/i)).toBeInTheDocument()
    expect(document.querySelector('.auth-transition-page--entering')).toBeInTheDocument()
  })
})

describe('signup legal confirmations', () => {
  it('requires independent reading and manual agreement for each document', () => {
    render(<App />)
    openSignup()

    const [termsCheckbox, privacyCheckbox] = screen.getAllByRole('checkbox')
    expect(termsCheckbox).toBeEnabled()
    expect(privacyCheckbox).toBeEnabled()

    fireEvent.click(termsCheckbox)
    expect(screen.getByRole('dialog', { name: 'Terms & Conditions' })).toBeInTheDocument()
    expect(termsCheckbox).not.toBeChecked()
    expect(screen.getByRole('button', { name: /i have read and agree/i })).toBeDisabled()
    scrollLegalDocumentToEnd('Terms & Conditions')
    expect(screen.getByText(/You have reached the end/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /i have read and agree/i }))
    expect(termsCheckbox).toBeChecked()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(termsCheckbox)
    expect(screen.getByRole('dialog', { name: 'Terms & Conditions' })).toBeInTheDocument()
    expect(termsCheckbox).toBeChecked()
    expect(screen.getByRole('button', { name: /i have read and agree/i })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /i have read and agree/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Terms & Conditions' }))
    expect(screen.getByText(/You have reached the end/i)).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(termsCheckbox).toBeChecked()

    fireEvent.click(privacyCheckbox)
    expect(screen.getByRole('dialog', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(privacyCheckbox).not.toBeChecked()
    scrollLegalDocumentToEnd('Privacy Policy')
    fireEvent.click(screen.getByRole('button', { name: /i have read and agree/i }))
    expect(privacyCheckbox).toBeChecked()

    fireEvent.click(privacyCheckbox)
    expect(screen.getByRole('dialog', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(privacyCheckbox).toBeChecked()
  })

  it('blocks account creation until both versioned confirmations are checked', () => {
    render(<App />)
    openSignup()

    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))

    expect(screen.getByRole('alert')).toHaveTextContent(/read both documents to the end/i)
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
    expect(screen.queryByText(/preparing your workspace/i)).not.toBeInTheDocument()
  })
})

describe('sidebar actions', () => {
  it('shows the guest sidebar without history and offers sign up there', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    expect(document.querySelector('.app-shell.home-entry')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search History')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open sidebar menu/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^sign up$/i })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }))
    act(() => {
      vi.advanceTimersByTime(180)
    })
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()

    const courseSelect = screen.getByLabelText('Course')
    expect(courseSelect.querySelectorAll('optgroup')).toHaveLength(6)
    expect(courseSelect.querySelectorAll('option')).toHaveLength(26)
    fireEvent.change(courseSelect, {
      target: { value: 'Bachelor of Science in Information Technology' },
    })
    expect(courseSelect).toHaveValue('Bachelor of Science in Information Technology')
  })

  it('does not show Profile settings to guests', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }))
    act(() => {
      vi.advanceTimersByTime(1200)
    })
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))

    expect(screen.queryByRole('button', { name: 'Profile' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()
  })

  it('keeps sidebar settings available to signed-in students', () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Student Email Address'), {
      target: { value: 'student@up.phinmaed.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password' },
    })
    fireEvent.submit(screen.getByLabelText('Student Email Address').closest('form'))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()
  })

  it('lets students update their display name and course from Profile settings', () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Student Email Address'), {
      target: { value: 'student@up.phinmaed.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password' },
    })
    fireEvent.submit(screen.getByLabelText('Student Email Address').closest('form'))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Alex Wildcat' },
    })
    fireEvent.change(screen.getByLabelText('Course'), {
      target: { value: 'Bachelor of Science in Information Technology' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(screen.getByRole('status')).toHaveTextContent('Profile changes saved.')
    expect(document.querySelector('.user-display-name')).toHaveTextContent('Alex Wildcat')
    expect(document.querySelector('.user-display-role')).toHaveTextContent(
      'Student · Bachelor of Science in Information Technology'
    )
    expect(document.querySelector('.user-avatar-badge')).toHaveTextContent('AL')
  })

  it('rejects oversized profile photo uploads', () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Student Email Address'), {
      target: { value: 'student@up.phinmaed.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password' },
    })
    fireEvent.submit(screen.getByLabelText('Student Email Address').closest('form'))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    const oversizedPhoto = new File(
      [new Uint8Array(2 * 1024 * 1024 + 1)],
      'profile.png',
      { type: 'image/png' }
    )
    fireEvent.change(screen.getByLabelText('Choose profile photo'), {
      target: { files: [oversizedPhoto] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/2 MB or smaller/i)
  })
})

describe('notification center', () => {
  it('marks notifications as read and clears them from the inbox', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Registrar Document Releasing')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }))
    expect(screen.getByText('Unread (0)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(screen.getByText("You're all caught up with university advisories!")).toBeInTheDocument()
  })

  it('dismisses an individual notification', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    const dismissBtns = screen.getAllByRole('button', { name: /dismiss notification/i })
    expect(dismissBtns.length).toBeGreaterThan(0)
    fireEvent.click(dismissBtns[0])

    expect(screen.queryByText('Registrar Document Releasing')).not.toBeInTheDocument()
  })

  it('navigates settings tabs and persists preferences', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /appearance/i })[0])
    expect(screen.getByText(/Visual color scheme/i)).toBeInTheDocument()
  })
})
