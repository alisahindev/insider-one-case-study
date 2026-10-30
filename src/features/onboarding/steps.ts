export interface TourStep {
  /** CSS selector of the element to spotlight; none centres the card on a dimmed screen. */
  target?: string
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to 1nsider',
    body: 'A full day at the races in your browser: a stable of horses, a program of rounds and live results. Here is what you can do, in under a minute.',
  },
  {
    target: '[data-tour="setup"]',
    title: 'Set up your race day',
    body: 'Choose the stable size, the runners per round and each round’s distance. Settings also hold the seed, which replays any race day exactly, and light or dark mode.',
  },
  {
    target: '[data-tour="controls"]',
    title: 'Draw and run',
    body: 'Generate program draws random horses for every round. Start runs the rounds back to back, and the speed switch works mid-race. Shortcuts: Space starts or pauses, G draws, 1, 2 and 4 set the speed.',
  },
  {
    target: '[data-tour="track"]',
    title: 'On the track',
    body: 'Every horse has its own form, mid-race surges and fatigue, so the best-conditioned horse is the favourite, not a sure thing. Poles count down every 400m to the finish.',
  },
  {
    target: '[data-tour="standings"]',
    title: 'Live standings',
    body: 'The running order, updated as horses overtake each other.',
  },
  {
    target: '[data-tour="stable"]',
    title: 'The stable',
    body: 'All your horses with their condition from 1 to 100. Horses in the current round move to the top; the rest are dimmed.',
  },
  {
    target: '[data-tour] .handle',
    title: 'Make the layout yours',
    body: 'Drag any panel by this handle, to the other column or within one. With a keyboard, focus the handle and use the arrow keys. Your layout is remembered.',
  },
  {
    target: '[data-tour="results"]',
    title: 'Results',
    body: 'Each round lands here as it finishes, newest first: the podium up front and the full finishing order one click away.',
  },
  {
    title: 'You’re ready',
    body: 'Draw a program and start the races. You can replay this tour any time from the question mark at the top.',
  },
]
