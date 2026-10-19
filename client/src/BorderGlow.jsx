import { useCallback, useEffect, useRef } from 'react'
import './BorderGlow.css'

function parseHSL(value) {
  const match = value.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/)
  if (!match) return { h: 40, s: 80, l: 80 }
  return { h: Number.parseFloat(match[1]), s: Number.parseFloat(match[2]), l: Number.parseFloat(match[3]) }
}

function buildGlowVars(glowColor, intensity) {
  const { h, s, l } = parseHSL(glowColor)
  const opacities = [100, 60, 50, 40, 30, 20, 10]
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10']

  return Object.fromEntries(opacities.map((opacity, index) => [
    `--glow-color${keys[index]}`,
    `hsl(${h}deg ${s}% ${l}% / ${Math.min(opacity * intensity, 100)}%)`,
  ]))
}

const gradientPositions = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%']
const gradientKeys = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven']
const gradientColorMap = [0, 1, 2, 0, 1, 2, 1]

function buildGradientVars(colors) {
  const variables = Object.fromEntries(gradientKeys.map((key, index) => {
    const color = colors[Math.min(gradientColorMap[index], colors.length - 1)]
    return [key, `radial-gradient(at ${gradientPositions[index]}, ${color} 0px, transparent 50%)`]
  }))
  variables['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`
  return variables
}

function isLightColor(color) {
  const value = color.trim().replace('#', '')
  if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(value)) return false
  const hex = value.length === 3 ? [...value].map((character) => character + character).join('') : value
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 180
}

function animateValue({ start = 0, end = 100, duration = 1000, delay = 0, ease, onUpdate, onEnd }, timers, frames) {
  let frameId
  const timerId = window.setTimeout(() => {
    const startedAt = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1)
      onUpdate(start + (end - start) * ease(progress))
      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
        frames.add(frameId)
      } else {
        onEnd?.()
      }
    }
    frameId = requestAnimationFrame(tick)
    frames.add(frameId)
  }, delay)
  timers.add(timerId)
}

const easeOutCubic = (value) => 1 - (1 - value) ** 3
const easeInCubic = (value) => value ** 3

function BorderGlow({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '#120F17',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  fillOpacity = 0.5,
  ...props
}) {
  const cardRef = useRef(null)

  const getCenter = useCallback((element) => {
    const { width, height } = element.getBoundingClientRect()
    return [width / 2, height / 2]
  }, [])

  const handlePointerMove = useCallback((event) => {
    const card = cardRef.current
    if (!card) return

    const rect = card.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const [centerX, centerY] = getCenter(card)
    const dx = x - centerX
    const dy = y - centerY
    const proximity = Math.min(
      Math.max(Math.max(Math.abs(dx) / Math.max(centerX, 1), Math.abs(dy) / Math.max(centerY, 1)), 0),
      1,
    )
    const angle = dx === 0 && dy === 0
      ? 0
      : (Math.atan2(dy, dx) * (180 / Math.PI) + 450) % 360

    card.style.setProperty('--edge-proximity', `${(proximity * 100).toFixed(3)}`)
    card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`)
  }, [getCenter])

  useEffect(() => {
    if (!animated || !cardRef.current) return undefined

    const card = cardRef.current
    const timers = new Set()
    const frames = new Set()
    const angleStart = 110
    const angleEnd = 465

    card.classList.add('sweep-active')
    card.style.setProperty('--cursor-angle', `${angleStart}deg`)
    animateValue({
      duration: 500,
      ease: easeOutCubic,
      onUpdate: (value) => card.style.setProperty('--edge-proximity', value),
    }, timers, frames)
    animateValue({
      duration: 1500,
      end: 50,
      ease: easeInCubic,
      onUpdate: (value) => card.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (value / 100) + angleStart}deg`),
    }, timers, frames)
    animateValue({
      delay: 1500,
      duration: 2250,
      start: 50,
      end: 100,
      ease: easeOutCubic,
      onUpdate: (value) => card.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (value / 100) + angleStart}deg`),
    }, timers, frames)
    animateValue({
      delay: 2500,
      duration: 1500,
      start: 100,
      end: 0,
      ease: easeInCubic,
      onUpdate: (value) => card.style.setProperty('--edge-proximity', value),
      onEnd: () => card.classList.remove('sweep-active'),
    }, timers, frames)

    return () => {
      timers.forEach(window.clearTimeout)
      frames.forEach(cancelAnimationFrame)
      card.classList.remove('sweep-active')
    }
  }, [animated])

  const style = {
    '--card-bg': backgroundColor,
    '--edge-sensitivity': edgeSensitivity,
    '--border-radius': `${borderRadius}px`,
    '--glow-padding': `${glowRadius}px`,
    '--cone-spread': coneSpread,
    '--fill-opacity': fillOpacity,
    ...buildGlowVars(glowColor, glowIntensity),
    ...buildGradientVars(colors),
  }
  const lightSurface = isLightColor(backgroundColor)

  return (
    <div
      {...props}
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={(event) => {
        cardRef.current?.style.setProperty('--edge-proximity', '0')
        props.onPointerLeave?.(event)
      }}
      className={`border-glow-card${lightSurface ? ' border-glow-card--light' : ''} ${className}`.trim()}
      style={{ ...style, ...props.style }}
    >
      <span className="edge-light" aria-hidden="true" />
      <div className="border-glow-inner">{children}</div>
    </div>
  )
}

export default BorderGlow
