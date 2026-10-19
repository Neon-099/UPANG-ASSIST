import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const socketHandlers = vi.hoisted(() => ({}))

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn((event, handler) => { socketHandlers[event] = handler }),
    disconnect: vi.fn(),
  }),
}))

const studentSession = {
  token: 'test-student-token',
  user: {
    id: 'student-id',
    name: 'Juan Student',
    email: 'student@up.phinmaed.com',
    course: 'Bachelor of Science in Information Technology',
    accountType: 'student',
  },
}

let supportRequests

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('ResizeObserver', class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  supportRequests = []
  Object.keys(socketHandlers).forEach((event) => delete socketHandlers[event])
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const path = String(url)
    const json = (data, headers = {}) => ({
      ok: true,
      status: 200,
      json: async () => data,
      text: async () => JSON.stringify(data),
      headers: { get: (name) => headers[name.toLowerCase()] || null },
    })
    if (path.endsWith('/auth/login') || path.endsWith('/auth/register')) {
      return json(studentSession)
    }
    if (path.endsWith('/auth/me')) return json({ user: studentSession.user })
    if (path.endsWith('/support/mine')) return json({ conversation: null })
    if (path.endsWith('/chat')) {
      return json({
        text: 'I could not find a reliable answer. Would you like to contact support?',
        escalate: true,
      }, { 'content-type': 'application/json' })
    }
    if (path.endsWith('/support')) {
      const body = JSON.parse(options.body)
      supportRequests.push(body)
      return json({
        conversation: {
          _id: 'support-conversation-id',
          question: body.question,
          status: 'waiting_for_support',
          messages: body.history.map((message) => ({
            sender: message.sender === 'user' ? 'student' : 'assistant',
            senderName: message.sender === 'user' ? studentSession.user.name : 'UPangAssist',
            text: message.text,
            clientMessageId: message.id,
          })),
        },
        administratorAvailable: false,
        message: 'Support is currently unavailable. Your inquiry is saved.',
      })
    }
    if (path.endsWith('/support-conversation-id/end')) {
      return json({
        conversation: {
          _id: 'support-conversation-id',
          question: 'Can I speak with a person about my enrollment?',
          status: 'ended_by_student',
          messages: [{
            sender: 'student',
            senderName: studentSession.user.name,
            text: 'Can I speak with a person about my enrollment?',
            clientMessageId: 'chat-user-0001',
          }],
        },
      })
    }
    return { ok: false, status: 404, json: async () => ({ error: 'Not found' }), headers: { get: () => null } }
  }))
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  cleanup()
})

async function signInAsStudent() {
  openLogin()
  fireEvent.change(screen.getByLabelText('Student Email Address'), {
    target: { value: studentSession.user.email },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'correct horse battery staple' },
  })
  await act(async () => {
    fireEvent.submit(screen.getByLabelText('Student Email Address').closest('form'))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  act(() => {
    vi.advanceTimersByTime(1200)
  })
}

function openSignup() {
  fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }))
  act(() => vi.advanceTimersByTime(180))
}

function openLogin() {
  openSignup()
  fireEvent.click(screen.getAllByRole('button', { name: /^log in$/i })[0])
  act(() => vi.advanceTimersByTime(180))
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
  it('opens the guest assistant home by default', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /Guest!/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Student Email Address')).not.toBeInTheDocument()
  })

  it('offers Google sign-in and explains when OAuth is not configured', () => {
    render(<App />)
    openLogin()

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/VITE_GOOGLE_CLIENT_ID/)
  })

  it('shows backend startup guidance when the login API returns an empty response', async () => {
    render(<App />)
    openLogin()
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => '',
    })
    fireEvent.change(screen.getByLabelText('Student Email Address'), {
      target: { value: studentSession.user.email },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct horse battery staple' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Student Email Address').closest('form'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('alert')).toHaveTextContent('npm run dev:server')
  })

  it('transitions between login and signup without showing the home loading screen', () => {
    render(<App />)
    openLogin()

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
  it('removes account type selection and submits manual signups as students', async () => {
    render(<App />)
    openSignup()

    expect(screen.queryByLabelText(/i am a/i)).not.toBeInTheDocument()
    expect(document.getElementById('account-type')).not.toBeInTheDocument()

    const [termsCheckbox, privacyCheckbox] = screen.getAllByRole('checkbox')
    fireEvent.click(termsCheckbox)
    scrollLegalDocumentToEnd('Terms & Conditions')
    fireEvent.click(screen.getByRole('button', { name: /i have read and agree/i }))
    fireEvent.click(privacyCheckbox)
    scrollLegalDocumentToEnd('Privacy Policy')
    fireEvent.click(screen.getByRole('button', { name: /i have read and agree/i }))

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test Student' } })
    fireEvent.change(screen.getByLabelText('Course'), {
      target: { value: 'Bachelor of Science in Information Technology' },
    })
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'test@up.phinmaed.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password-123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'test-password-123' } })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const registrationRequest = fetch.mock.calls.find(([url]) => String(url).endsWith('/auth/register'))
    expect(JSON.parse(registrationRequest[1].body)).toMatchObject({ accountType: 'student' })
  })

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

    expect(document.querySelector('.app-shell.home-entry')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Guest!/ })).toBeInTheDocument()
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

  it('does not offer live chat to guests when an answer is inconclusive', async () => {
    render(<App />)

    const ask = screen.getByRole('textbox', { name: 'Ask a question' })
    fireEvent.change(ask, { target: { value: 'What is an unfamiliar campus procedure?' } })
    await act(async () => {
      fireEvent.submit(ask.closest('form'))
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })

    expect(screen.getByText('I could not find a reliable answer. Would you like to contact support?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect with Live Chat' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue Chatting' })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Live support' })).not.toBeInTheDocument()
    expect(screen.getByText('Was this helpful?')).toBeInTheDocument()
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/support'))).toBe(false)
  })

  it('does not show Profile settings to guests', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))

    expect(screen.queryByRole('button', { name: 'Profile' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()
  })

  it('keeps sidebar settings available to signed-in students', async () => {
    render(<App />)
    await signInAsStudent()

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()
  })

  it('lets students update their display name and course from Profile settings', async () => {
    render(<App />)
    await signInAsStudent()

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

  it('rejects oversized profile photo uploads', async () => {
    render(<App />)
    await signInAsStudent()

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

describe('chatbot escalation to live support', () => {
  it('offers the live support option when a streamed answer is marked inconclusive', async () => {
    render(<App />)
    await signInAsStudent()
    expect(screen.getByRole('heading', { name: /Juan!/ })).toBeInTheDocument()
    const fallbackText = 'I could not find a reliable answer. Would you like to contact support?'
    fetch.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (name) => name.toLowerCase() === 'x-upang-escalation' ? 'true' : 'text/plain',
      },
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(fallbackText) })
            .mockResolvedValueOnce({ done: true }),
        }),
      },
    }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a question' }), {
      target: { value: 'What is an unfamiliar campus procedure?' },
    })
    await act(async () => {
      fireEvent.submit(screen.getByRole('textbox', { name: 'Ask a question' }).closest('form'))
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: 'Connect with Live Chat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue Chatting' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Live Support/i })).not.toBeInTheDocument()
  })

  it('lets the student continue chatting without opening a support conversation', async () => {
    render(<App />)
    await signInAsStudent()
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a question' }), {
      target: { value: 'What is an unfamiliar campus procedure?' },
    })
    await act(async () => {
      fireEvent.submit(screen.getByRole('textbox', { name: 'Ask a question' }).closest('form'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Continue Chatting' }))
    expect(screen.queryByRole('button', { name: 'Connect with Live Chat' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Live Support/i })).not.toBeInTheDocument()
    expect(supportRequests).toHaveLength(0)
  })

  it('offers live support on an inconclusive answer and submits the full question history', async () => {
    render(<App />)
    await signInAsStudent()
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a question' }), {
      target: { value: 'Can I speak with a person about my enrollment?' },
    })
    await act(async () => {
      fireEvent.submit(screen.getByRole('textbox', { name: 'Ask a question' }).closest('form'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: 'Connect with Live Chat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue Chatting' })).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect with Live Chat' }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(supportRequests).toHaveLength(1)
    expect(supportRequests[0].question).toBe('Can I speak with a person about my enrollment?')
    expect(supportRequests[0].history.some((message) => message.sender === 'assistant')).toBe(true)
    expect(screen.getByRole('button', { name: /Open Live Support: Waiting for an administrator/i })).toBeInTheDocument()
    expect(screen.getByText('Support is currently unavailable', { exact: true })).toBeInTheDocument()
    expect(document.querySelector('.toast-duration-bar')).toHaveStyle({ animationDuration: '4200ms' })

    fireEvent.click(screen.getByRole('button', { name: /Open Live Support/i }))
    expect(screen.getByRole('dialog', { name: 'Live support conversation' })).toBeInTheDocument()
    expect(screen.getByText('Waiting for Support')).toBeInTheDocument()
    expect(screen.getAllByText('Can I speak with a person about my enrollment?').length).toBeGreaterThan(1)
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Open Live Support/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close live support' }))
    expect(screen.queryByRole('dialog', { name: 'Live support conversation' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open Live Support/i })).toBeInTheDocument()
  })

  it('keeps AI chat available while a support inquiry is waiting', async () => {
    render(<App />)
    await signInAsStudent()
    const ask = screen.getByRole('textbox', { name: 'Ask a question' })
    fireEvent.change(ask, { target: { value: 'Can I speak with a person about my enrollment?' } })
    await act(async () => {
      fireEvent.submit(ask.closest('form'))
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Live Chat' }))
    await act(async () => {
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })

    const aiInput = screen.getByRole('textbox', { name: 'Ask a question' })
    expect(aiInput).toBeEnabled()
    fireEvent.change(aiInput, { target: { value: 'Where is the Registrar office?' } })
    await act(async () => {
      fireEvent.submit(aiInput.closest('form'))
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })

    expect(screen.getByText('Where is the Registrar office?')).toBeInTheDocument()
    expect(supportRequests).toHaveLength(1)
  })

  it('shows an unread support reply in the bubble without adding it to AI chat', async () => {
    render(<App />)
    await signInAsStudent()
    const question = screen.getByRole('textbox', { name: 'Ask a question' })
    fireEvent.change(question, { target: { value: 'Can I speak with a person about my enrollment?' } })
    await act(async () => {
      fireEvent.submit(question.closest('form'))
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Live Chat' }))
    await act(async () => {
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })

    await act(async () => {
      socketHandlers['support:message']({
        conversationId: 'support-conversation-id',
        message: {
          sender: 'admin',
          senderName: 'Support Admin',
          text: 'The Registrar can help with enrollment.',
          clientMessageId: 'admin-reply-0001',
        },
      })
    })

    const bubble = screen.getByRole('button', { name: /Open Live Support, 1 new reply/i })
    expect(bubble).toContainElement(bubble.querySelector('.support-widget-icon'))
    expect(bubble).toHaveTextContent('1')
    expect(screen.queryByText('The Registrar can help with enrollment.')).not.toBeInTheDocument()
    fireEvent.click(bubble)
    expect(screen.getByText('The Registrar can help with enrollment.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toBeEnabled()
  })

  it('lets a student end their support conversation and keep using AI chat', async () => {
    render(<App />)
    await signInAsStudent()
    const question = screen.getByRole('textbox', { name: 'Ask a question' })
    fireEvent.change(question, { target: { value: 'Can I speak with a person about my enrollment?' } })
    await act(async () => {
      fireEvent.submit(question.closest('form'))
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Live Chat' }))
    await act(async () => {
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /Open Live Support/i }))
    fireEvent.click(screen.getByRole('button', { name: 'End conversation' }))
    expect(screen.getByText('End this support conversation?')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, end' }))
      for (let index = 0; index < 6; index += 1) await Promise.resolve()
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/support/support-conversation-id/end'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.getByText('You ended this conversation. You can return to AI Chat or reopen Live Support.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close live support' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Live Support/i })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toBeEnabled()
  })
})

describe('campus advisory duration', () => {
  it('shows a 10-second duration bar and automatically dismisses the advisory', () => {
    render(<App />)

    expect(screen.getByText('CAMPUS ADVISORY')).toBeInTheDocument()
    expect(document.querySelector('.campus-alert-duration-bar')).toHaveStyle({
      animationDuration: '10000ms',
    })

    act(() => {
      vi.advanceTimersByTime(9999)
    })
    expect(screen.getByText('CAMPUS ADVISORY')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('CAMPUS ADVISORY')).not.toBeInTheDocument()
  })

  it('dismisses the advisory immediately when closed manually', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss alert' }))

    expect(screen.queryByText('CAMPUS ADVISORY')).not.toBeInTheDocument()
  })
})

describe('notification center', () => {
  it('marks notifications as read and clears them from the inbox', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Registrar Document Releasing')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }))
    expect(screen.getByText('Unread (0)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(screen.getByText("You're all caught up with university advisories!")).toBeInTheDocument()
  })

  it('dismisses an individual notification', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    const dismissBtns = screen.getAllByRole('button', { name: /dismiss notification/i })
    expect(dismissBtns.length).toBeGreaterThan(0)
    fireEvent.click(dismissBtns[0])

    expect(screen.queryByText('Registrar Document Releasing')).not.toBeInTheDocument()
  })

  it('navigates settings tabs and persists preferences', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /appearance/i })[0])
    expect(screen.getByText(/Visual color scheme/i)).toBeInTheDocument()
  })
})
