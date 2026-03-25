const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScoreDisplay = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const diffBtns = document.querySelectorAll('.diff-btn');

let selectedDifficulty = 'easy';

diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDifficulty = btn.dataset.diff;
    });
});

let width, height;
let isPlaying = false;
let score = 0;
let frameCount = 0;
let animationId;

// Entities
let player;
let obstacles = [];
let particles = [];

// Game Settings
const playerRadius = 14;
let baseSpeed = 5;
let currentSpeed = baseSpeed;
let spawnRateStart = 50; // frames
let currentSpawnRate = spawnRateStart;

// Colors
const colors = {
    player: '#00ffff',
    playerGlow: 'rgba(0, 255, 255, 0.8)',
    obstacle: '#ff0055',
    obstacleGlow: 'rgba(255, 0, 85, 0.8)',
    bgGrid: 'rgba(0, 255, 255, 0.05)'
};

function resize() {
    const container = document.getElementById('game-container');
    width = container.clientWidth;
    height = container.clientHeight;
    
    // Scale for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    if(player) {
        player.y = height - 120;
    }
}

window.addEventListener('resize', resize);

class Player {
    constructor() {
        this.x = width / 2;
        this.y = height - 120;
        this.radius = playerRadius;
        this.targetX = width / 2;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.player;
        ctx.shadowBlur = 25;
        ctx.shadowColor = colors.playerGlow;
        ctx.fill();
        ctx.shadowBlur = 0; 
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    update() {
        // Smoothly move towards target X
        this.x += (this.targetX - this.x) * 0.25;
        
        // Boundaries
        if (this.x < this.radius + 15) this.x = this.radius + 15;
        if (this.x > width - this.radius - 15) this.x = width - this.radius - 15;
    }
}

class Obstacle {
    constructor() {
        this.radius = Math.random() * 8 + 12; // 12 to 20
        this.x = Math.random() * (width - this.radius * 4) + this.radius * 2;
        this.y = -this.radius - 30;
        this.speed = currentSpeed + (Math.random() * 2 - 1); 
        this.wobbleSpeed = Math.random() * 0.04 + 0.02;
        this.wobbleRange = Math.random() * 30 + 10;
        this.wobbleOffset = Math.random() * Math.PI * 2;
        this.baseX = this.x;
        this.rot = 0;
        this.rotSpeed = (Math.random() - 0.5) * 0.1;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        
        ctx.beginPath();
        // Star shape
        const spikes = 4;
        const outer = this.radius;
        const inner = this.radius * 0.4;
        
        for(let i = 0; i < spikes * 2; i++) {
            const r = (i % 2 === 0) ? outer : inner;
            const a = (Math.PI / spikes) * i;
            if(i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        
        ctx.fillStyle = colors.obstacle;
        ctx.shadowBlur = 20;
        ctx.shadowColor = colors.obstacleGlow;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        this.x = this.baseX + Math.sin(frameCount * this.wobbleSpeed + this.wobbleOffset) * this.wobbleRange;
        this.rot += this.rotSpeed;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 4 + 1;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1;
        this.decay = Math.random() * 0.03 + 0.015;
        this.color = color;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${this.life})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(${this.color}, ${this.life})`;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95; // friction
        this.vy *= 0.95;
        this.life -= this.decay;
        this.radius *= 0.96;
    }
}

function initGame() {
    if (selectedDifficulty === 'easy') {
        baseSpeed = 4.5;
        spawnRateStart = 55;
    } else if (selectedDifficulty === 'medium') {
        baseSpeed = 6.5;
        spawnRateStart = 40;
    } else if (selectedDifficulty === 'hard') {
        baseSpeed = 9.0;
        spawnRateStart = 28;
    }

    player = new Player();
    obstacles = [];
    particles = [];
    score = 0;
    frameCount = 0;
    currentSpeed = baseSpeed;
    currentSpawnRate = spawnRateStart;
    scoreDisplay.innerText = '0';
    scoreDisplay.classList.add('visible');
}

function createExplosion(x, y, colorRgb, amount=30) {
    for (let i = 0; i < amount; i++) {
        particles.push(new Particle(x, y, colorRgb));
    }
}

function drawBackground() {
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = colors.bgGrid;
    ctx.lineWidth = 1;
    
    // Moving Grid Line effect
    const lineSpacing = 50;
    const offset = (frameCount * baseSpeed * 0.4) % lineSpacing;
    
    ctx.beginPath();
    // Vertical lines
    for(let x = width/2; x <= width; x += lineSpacing) {
        ctx.moveTo(x, 0); ctx.lineTo(x, height);
        ctx.moveTo(width - x, 0); ctx.lineTo(width - x, height);
    }
    // Horizontal moving lines
    for(let y = offset; y <= height; y += lineSpacing) {
        // Only draw lines in the lower 70% to give a perspective feel (fading top)
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }
    ctx.stroke();
    
    // Vignette
    const gradient = ctx.createRadialGradient(width/2, height/2, height*0.2, width/2, height/2, height*0.8);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function checkCollision(p, o) {
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    return dist < (p.radius + o.radius * 0.65); // Slightly forgiving hitbox
}

function gameOver() {
    isPlaying = false;
    createExplosion(player.x, player.y, '0, 255, 255', 50); // Player explosion
    scoreDisplay.classList.remove('visible');
    
    if ("vibrate" in navigator) {
        try { navigator.vibrate([50, 50, 80]); } catch(e){}
    }
    
    setTimeout(() => {
        gameOverScreen.classList.remove('hidden');
        finalScoreDisplay.innerText = Math.floor(score);
    }, 1200);
}

function gameLoop() {
    if (!isPlaying && particles.length === 0 && obstacles.length > 0) return; // Stop entirely if dead + particles gone
    
    animationId = requestAnimationFrame(gameLoop);
    
    drawBackground();
    
    if (isPlaying) {
        frameCount++;
        score += 0.05; // Base score increment
        scoreDisplay.innerText = Math.floor(score);
        
        if (Math.floor(score) % 50 === 0 && Math.floor(score) > 0 && Math.floor(score) !== score._lastPop) {
            scoreDisplay.style.transform = 'scale(1.4)';
            setTimeout(() => scoreDisplay.style.transform = 'scale(1)', 200);
            score._lastPop = Math.floor(score);
            
            // Increase difficulty
            currentSpeed += 0.3;
            if(currentSpawnRate > 12) currentSpawnRate -= 2;
        }

        if (frameCount % Math.max(Math.floor(currentSpawnRate), 10) === 0) {
            obstacles.push(new Obstacle());
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Player
    if (isPlaying) {
        player.update();
        player.draw();
        
        // Trail effect
        if(frameCount % 3 === 0) {
            particles.push(new Particle(player.x, player.y + player.radius, '0, 255, 255'));
            particles[particles.length-1].life = 0.5;
            particles[particles.length-1].vx = 0;
            particles[particles.length-1].vy = 2;
        }
    }

    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        if (isPlaying) o.update();
        o.draw();
        
        if (isPlaying && checkCollision(player, o)) {
            gameOver();
            // Obstacle explosion
            createExplosion(o.x, o.y, '255, 0, 85', 30);
            obstacles.splice(i, 1); // remove the one that hit us
            continue;
        }
        
        if (o.y > height + 50) {
            obstacles.splice(i, 1);
            if(isPlaying) score += 2; // Fixed score for dodging
        }
    }
}

// Controls
let isDragging = false;

function handlePointerDown(e) {
    if(!isPlaying) return;
    isDragging = true;
    updatePointerXY(e);
}

function handlePointerMove(e) {
    if(!isPlaying || !isDragging) return;
    updatePointerXY(e);
}

function handlePointerUp() {
    isDragging = false;
}

function updatePointerXY(e) {
    let clientX;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
    } else {
        clientX = e.clientX;
    }
    const rect = canvas.getBoundingClientRect();
    player.targetX = clientX - rect.left;
}

canvas.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp);

canvas.addEventListener('touchstart', (e) => { 
    if(isPlaying) e.preventDefault(); 
    handlePointerDown(e); 
}, { passive: false });
window.addEventListener('touchmove', (e) => { 
    if(isDragging && isPlaying) e.preventDefault(); 
    handlePointerMove(e); 
}, { passive: false });
window.addEventListener('touchend', handlePointerUp);

startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    startGame();
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startGame();
});

function startGame() {
    initGame();
    isPlaying = true;
    if(animationId) cancelAnimationFrame(animationId);
    gameLoop();
}

resize();
drawBackground(); 
