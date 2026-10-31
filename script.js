// Game configuration and state variables
const GOAL_CANS = 20;
const HARD_GOAL_CANS = 25;
const MAX_SCORING_CANS = 30;
const DIFFICULTY_DURATIONS = { easy: 45, medium: 30, hard: 30 };
const PENALTY_CANS_PER_SPAWN = 2;
const PERFECT_GAME_MESSAGE = 'Amazing! You collected every single one of the 30 jerry cans!';
const WINNING_MESSAGES = [
  'You did it! The water is clean! You collected {count} jerry cans!',
  'Fantastic work! You collected {count} cans!',
  'Great job! You reached {count} cans!'
];
const LOSING_MESSAGES = [
  'Time is up! Try again to reach {goal} cans.',
  'Almost there! Try again for a cleaner shore.',
  'Keep going! You can collect {goal} cans next time.'
];
const MILESTONE_MESSAGES = [
  { score: goalCans => Math.ceil(goalCans / 2), message: 'Halfway there! Keep collecting!' },
  { score: goalCans => goalCans, message: 'You reached the goal! Amazing work!' }
];
let currentCans = 0;
let timeLeft = DIFFICULTY_DURATIONS.medium;
let scoringCansSpawned = 0;
let scoringCansCollected = 0;
let gameActive = false;
let spawnInterval;
let timerInterval;
let confettiTimeout;
let audioContext;
let triggeredMilestones = new Set();
const UI_SOUND_NOTES = {
  start: [523, 659, 784],
  reset: [392, 311],
  easy: [587],
  medium: [440, 554],
  hard: [330, 440, 659]
};

function getSelectedDifficulty() {
  return document.querySelector('input[name="difficulty"]:checked').value;
}

function getGoalCans() {
  return getSelectedDifficulty() === 'hard' ? HARD_GOAL_CANS : GOAL_CANS;
}

function updateGoalInstruction() {
  document.querySelector('.game-instructions').textContent =
    `Collect ${getGoalCans()} cans to win!`;
}

function setDifficultyEnabled(enabled) {
  document.querySelectorAll('input[name="difficulty"]').forEach(input => {
    input.disabled = !enabled;
  });
}

// Creates the 3x3 game grid where items will appear
function createGrid() {
  const grid = document.querySelector('.game-grid');
  grid.innerHTML = ''; // Clear any existing grid cells
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell'; // Each cell represents a grid square
    grid.appendChild(cell);
  }
}

// Ensure the grid is created when the page loads
createGrid();
updateGoalInstruction();

// Spawns scoring and penalty cans in random grid cells
function spawnWaterCan() {
  if (!gameActive || scoringCansSpawned >= MAX_SCORING_CANS) return;
  scoringCansSpawned += 1;
  const cells = document.querySelectorAll('.grid-cell');
  cells.forEach(cell => (cell.innerHTML = ''));

  const availableCells = Array.from(cells);
  const isHardMode = getSelectedDifficulty() === 'hard';
  const totalCans = isHardMode ? availableCells.length : PENALTY_CANS_PER_SPAWN + 1;

  for (let canIndex = 0; canIndex < totalCans; canIndex += 1) {
    const randomIndex = Math.floor(Math.random() * availableCells.length);
    const randomCell = availableCells.splice(randomIndex, 1)[0];
    const penaltyClass = canIndex > 0
      ? ` penalty-can${isHardMode ? ` hard-can-${canIndex}` : ''}`
      : '';

    randomCell.innerHTML = `
      <div class="water-can-wrapper">
        <div class="water-can${penaltyClass}"></div>
      </div>
    `;
  }
}

function updateStats() {
  document.getElementById('current-cans').textContent = currentCans;
  document.getElementById('timer').textContent = timeLeft;
}

function showMilestoneMessage() {
  const milestone = MILESTONE_MESSAGES.find(({ score }) =>
    score(getGoalCans()) === currentCans && !triggeredMilestones.has(currentCans)
  );
  if (!milestone) return;

  triggeredMilestones.add(currentCans);
  document.getElementById('achievements').textContent = milestone.message;
}

function getAudioContext() {
  if (!window.AudioContext) return;

  audioContext ??= new window.AudioContext();
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(error => {
      console.error('Unable to resume audio playback:', error);
    });
  }
  return audioContext;
}

function playUiSound(action) {
  const context = getAudioContext();
  if (!context) return;

  const startTime = context.currentTime;
  UI_SOUND_NOTES[action].forEach((frequency, index) => {
    const noteStart = startTime + index * 0.1;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.055, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.09);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.09);
  });
}

function playWaterDropSound() {
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const sparkle = context.createOscillator();
  const sparkleGain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(900, now);
  oscillator.frequency.exponentialRampToValueAtTime(280, now + 0.18);
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  oscillator.connect(gain);
  gain.connect(context.destination);
  sparkle.type = 'sine';
  sparkle.frequency.setValueAtTime(1600, now);
  sparkle.frequency.exponentialRampToValueAtTime(650, now + 0.1);
  sparkleGain.gain.setValueAtTime(0.035, now);
  sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  sparkle.connect(sparkleGain);
  sparkleGain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.18);
  sparkle.start(now);
  sparkle.stop(now + 0.1);
}

function playIncorrectSound() {
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(260, now);
  oscillator.frequency.exponentialRampToValueAtTime(130, now + 0.28);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.28);
}

function clearWaterConfetti() {
  clearTimeout(confettiTimeout);
  document.querySelector('.water-confetti')?.remove();
}

function showWaterConfetti() {
  clearWaterConfetti();
  const confetti = document.createElement('div');
  confetti.className = 'water-confetti';
  confetti.setAttribute('aria-hidden', 'true');

  for (let dropIndex = 0; dropIndex < 36; dropIndex += 1) {
    const drop = document.createElement('span');
    drop.className = 'water-droplet';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 0.5}s`;
    drop.style.animationDuration = `${1.8 + Math.random() * 0.8}s`;
    confetti.appendChild(drop);
  }

  document.body.appendChild(confetti);
  confettiTimeout = setTimeout(() => confetti.remove(), 3200);
}

function handleCanClick(event) {
  const clickedCan = event.target.closest('.water-can');
  if (!gameActive || !clickedCan) return;

  if (clickedCan.classList.contains('penalty-can')) {
    playIncorrectSound();
    currentCans = Math.max(0, currentCans - 1);
  } else {
    playWaterDropSound();
    currentCans += 1;
    scoringCansCollected += 1;
  }
  clickedCan.closest('.grid-cell').innerHTML = '';
  updateStats();
  if (!clickedCan.classList.contains('penalty-can')) showMilestoneMessage();
}

function resetGame() {
  gameActive = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);
  clearWaterConfetti();
  currentCans = 0;
  triggeredMilestones = new Set();
  timeLeft = DIFFICULTY_DURATIONS[getSelectedDifficulty()];
  scoringCansSpawned = 0;
  scoringCansCollected = 0;
  document.getElementById('achievements').textContent = '';
  document.querySelectorAll('.grid-cell').forEach(cell => (cell.innerHTML = ''));
  setDifficultyEnabled(true);
  updateStats();
}

// Initializes and starts a new game
function startGame() {
  if (gameActive) return; // Prevent starting a new game if one is already active
  resetGame();
  gameActive = true;
  setDifficultyEnabled(false);
  createGrid(); // Set up the game grid
  spawnWaterCan();
  spawnInterval = setInterval(spawnWaterCan, 1000); // Spawn water cans every second
  timerInterval = setInterval(() => {
    timeLeft -= 1;
    updateStats();
    if (timeLeft === 0) endGame();
  }, 1000);
}

function endGame() {
  gameActive = false; // Mark the game as inactive
  clearInterval(spawnInterval); // Stop spawning water cans
  clearInterval(timerInterval);
  document.querySelectorAll('.grid-cell').forEach(cell => (cell.innerHTML = ''));

  const goalCans = getGoalCans();
  const isWinner = currentCans >= goalCans;
  const messages = isWinner ? WINNING_MESSAGES : LOSING_MESSAGES;
  const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
  const message = isWinner && scoringCansCollected === MAX_SCORING_CANS
    ? PERFECT_GAME_MESSAGE
    : isWinner
      ? selectedMessage.replace('{count}', currentCans)
      : selectedMessage.replace('{goal}', goalCans);
  document.getElementById('achievements').textContent = message;
  if (isWinner) showWaterConfetti();
}

// Set up click handlers for game controls
document.getElementById('start-game').addEventListener('click', () => {
  if (gameActive) return;
  playUiSound('start');
  startGame();
});
document.getElementById('reset-game').addEventListener('click', () => {
  playUiSound('reset');
  resetGame();
});
document.querySelector('.game-grid').addEventListener('click', handleCanClick);
document.querySelectorAll('input[name="difficulty"]').forEach(input => {
  input.addEventListener('change', () => {
    playUiSound(getSelectedDifficulty());
    timeLeft = DIFFICULTY_DURATIONS[getSelectedDifficulty()];
    updateStats();
    updateGoalInstruction();
  });
});
