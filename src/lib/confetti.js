import confetti from 'canvas-confetti'

// Chrome/silver burst for medals and achievements
export function goldBurst() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#ffffff', '#e8ecf2', '#d4d8e0', '#b8bcc8', '#8a8f9c'],
    gravity: 0.8,
    ticks: 200,
  })
}

// Green burst for financial rewards
export function greenBurst() {
  confetti({
    particleCount: 60,
    spread: 60,
    origin: { y: 0.6 },
    colors: ['#5ab870', '#4a9060', '#2d5a2d', '#80d890', '#ffffff'],
    gravity: 0.8,
    ticks: 180,
  })
}

// Big celebration for legendary events
export function epicBurst() {
  const duration = 1500
  const end = Date.now() + duration
  const colors = ['#ffffff', '#d4d8e0', '#b8bcc8', '#4a7ad9']

  function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors })
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
