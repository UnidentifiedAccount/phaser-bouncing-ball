let WIDTH = 600;
let HEIGHT = 600;

const ENEMY_ASSETS = [
    "CitizenPlush.png",
    "CobaltGuardLunar.png",
    "ExecutionerPlush.png",
    "GhostLunar.png",
    "KnightLunar.png",
    "LO_Marionette.png",
    "ReaperAct2_refreshed.png",
    "SinRealtdsnobackground.png"
];
const TOWER_ASSETS = [
    "Commander.png",
    "Minigunner.png",
    "Scout.png",
    "Shotgun.png"
];

// Assign stats for each enemy asset
const ENEMY_STATS = {
    "CitizenPlush.png":    { speed: 1.0, health: 3 },
    "CobaltGuardLunar.png":{ speed: 0.8, health: 30 },
    "ExecutionerPlush.png":{ speed: 0.3, health: 250 },
    "GhostLunar.png":      { speed: 1.2, health: 4 },
    "KnightLunar.png":     { speed: 1.1, health: 10 },
    "LO_Marionette.png":   { speed: 2, health: 15},
    "ReaperAct2_refreshed.png": { speed: 0.5, health: 50 },
    "SinRealtdsnobackground.png": { speed: 1.6, health: 1 }
};

// Cash rewards per enemy type
const ENEMY_CASH = {
    "CitizenPlush.png": 25,
    "CobaltGuardLunar.png": 90,
    "ExecutionerPlush.png": 400,
    "GhostLunar.png": 40,
    "KnightLunar.png": 60,
    "LO_Marionette.png": 75,
    "ReaperAct2_refreshed.png": 100,
    "SinRealtdsnobackground.png": 0
};

// Tower stats
const TOWER_STATS = {
    "Commander.png":   { range: 200, damage: 1, firerate: 5, cost: 100, isCommander: true },
    "Minigunner.png":  { range: 300, damage: 1, firerate: 0.1, cost: 150 },
    "Scout.png":       { range: 100,  damage: 5, firerate: 3, cost: 40 },
    "Shotgun.png":     { range: 75,  damage: 3, firerate: 6, cost:  50},
};

const config = {
    type: Phaser.AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent: 'game-container', // Ensure Phaser renders into the correct div
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let ball;
let ballSize = 80;
let ballHealth = 20;
let maxBallHealth = 20;
let healthBar;
let enemies;
let enemySpeed = 1.2;
let enemySpawnTimer = 0;
let enemySpawnInterval = 80;
let towers;
let selectedTowerIndex = 0;
let placingTower = false;
let draggingTower = null;
let draggingTowerSprite = null;
let sidebarGraphics;
let playerMoney = 100;
// --- Tower Defense Game Core Logic ---
// Add bullet group
let bullets = [];
// Add a render layer for bullets
let bulletGraphics;

// --- Wave Structure ---
const WAVES = [
    [ // Wave 1
        { type: "CitizenPlush.png", count: 5 },
        { type: "GhostLunar.png", count: 4 }
    ],
    [ // Wave 2
        { type: "CitizenPlush.png", count: 7 },
        { type: "GhostLunar.png", count: 5 },
        { type: "KnightLunar.png", count: 3 }
    ],
    [ // Wave 3
        { type: "KnightLunar.png", count: 8 },
        { type: "CobaltGuardLunar.png", count: 2 }
    ],
    [ // Wave 4
        { type: "CobaltGuardLunar.png", count: 4 },
        { type: "ReaperAct2_refreshed.png", count: 2 }
    ],
    [ // Wave 5 (Final)
        { type: "CitizenPlush.png", count: 20 },
        { type: "CobaltGuardLunar.png", count: 5 },
        { type: "ExecutionerPlush.png", count: 1 },
        { type: "ReaperAct2_refreshed.png", count: 3 },
        { type: "GhostLunar.png", count: 10 },
        { type: "KnightLunar.png", count: 15 },
        { type: "LO_Marionette.png", count: 5 }
    ]
];
let currentWave = 0;
let waveQueue = [];
let waveInProgress = false;
let waveTimer = 0;
let reaperSummonTimers = [];
let stunnedTowers = [];
let executionerStunTimer = 0;
let executionerKillTimer = 0;

function preload() {
    this.load.image("ball", "assets/ball.png");
    ENEMY_ASSETS.forEach(asset => this.load.image(asset, `assets/${asset}`));
    TOWER_ASSETS.forEach(asset => this.load.image(asset, `Towers/${asset}`));
}

function create() {
    // Ball (objective) in the center
    ball = this.add.sprite(WIDTH / 2, HEIGHT / 2, "ball");
    ball.setDisplaySize(ballSize, ballSize);
    ball.setDepth(1);

    // Health bar graphics
    healthBar = this.add.graphics();
    drawHealthBar();

    // Enemy group (use this.add.group, not this.physics.add.group for static sprites)
    enemies = this.add.group();

    // Tower group (use this.add.group for static sprites)
    towers = this.add.group();

    // Bullet group (no physics needed for visuals)
    bullets = [];

    // Input for placing towers
    this.input.on('pointerdown', pointer => {
        if (placingTower) {
            placeTower.call(this, pointer.x, pointer.y);
        }
    });

    // Keyboard: 1-4 to select tower, T to toggle placement mode
    this.input.keyboard.on('keydown', event => {
        if (event.key >= '1' && event.key <= String(TOWER_ASSETS.length)) {
            selectedTowerIndex = parseInt(event.key) - 1;
        }
        if (event.key.toLowerCase() === 't') {
            placingTower = !placingTower;
        }
    });

    // Sidebar for towers
    sidebarGraphics = this.add.graphics();
    drawSidebar.call(this);
    TOWER_ASSETS.forEach((asset, i) => {
        let iconY = 60 + i * 90;
        let icon = this.add.sprite(40, iconY, asset).setInteractive();
        icon.setDisplaySize(48, 48);
        icon.setDepth(10);
        icon.on('pointerdown', pointer => {
            if (playerMoney >= TOWER_STATS[asset].cost) {
                draggingTower = asset;
                draggingTowerSprite = this.add.sprite(pointer.x, pointer.y, asset);
                draggingTowerSprite.setDisplaySize(48, 48);
                draggingTowerSprite.setAlpha(0.7);
                draggingTowerSprite.setDepth(20);
            }
        });
        icon.on('pointerover', () => { icon.setAlpha(0.8); });
        icon.on('pointerout', () => { icon.setAlpha(1); });
    });
    this.input.on('pointermove', pointer => {
        if (draggingTowerSprite) {
            draggingTowerSprite.x = pointer.x;
            draggingTowerSprite.y = pointer.y;
        }
    });
    this.input.on('pointerup', pointer => {
        if (draggingTower && draggingTowerSprite) {
            if (pointer.x > 100 && pointer.x < WIDTH && pointer.y > 0 && pointer.y < HEIGHT) {
                placeTower.call(this, pointer.x, pointer.y, draggingTower);
            }
            draggingTowerSprite.destroy();
            draggingTower = null;
            draggingTowerSprite = null;
        }
    });
    bulletGraphics = this.add.graphics();
}

function startWave(waveNum) {
    if (waveNum >= WAVES.length) return;
    waveQueue = [];
    reaperSummonTimers = [];
    WAVES[waveNum].forEach(entry => {
        for (let i = 0; i < entry.count; i++) {
            waveQueue.push(entry.type);
        }
    });
    Phaser.Utils.Array.Shuffle(waveQueue);
    waveInProgress = true;
    waveTimer = 0;
    // Show fun message for final wave
    if (waveNum === WAVES.length - 1) {
        if (this.finalWaveText) this.finalWaveText.destroy();
        this.finalWaveText = this.add.text(WIDTH / 2, 40, 'YOU SHALL DIE HERETIC!!!', {
            fontSize: '32px',
            fill: '#ff0000',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            align: 'center'
        }).setOrigin(0.5, 0).setDepth(100);
    } else if (this.finalWaveText) {
        this.finalWaveText.destroy();
        this.finalWaveText = null;
    }
}

function update(time, delta) {
    // --- Wave Spawning ---
    if (!waveInProgress && currentWave < WAVES.length) {
        startWave(currentWave);
    }
    if (waveInProgress && waveQueue.length > 0) {
        waveTimer += delta || 16;
        if (waveTimer > 800) {
            let type = waveQueue.shift();
            if (type === "ReaperAct2_refreshed.png") {
                spawnEnemy.call(this, type);
                reaperSummonTimers.push({
                    reaperAlive: true,
                    timer: 0,
                    reaperId: Date.now() + Math.random()
                });
            } else if (type !== "SinRealtdsnobackground.png") {
                spawnEnemy.call(this, type);
            }
            waveTimer = 0;
        }
    }
    // --- Reaper Summoning SinRealtdsnobackground.png (nerfed to 1 per 2 seconds) ---
    for (let i = reaperSummonTimers.length - 1; i >= 0; i--) {
        let timerObj = reaperSummonTimers[i];
        timerObj.timer += delta || 16;
        // Find if reaper is still alive
        let reaperAlive = false;
        enemies.getChildren().forEach(enemy => {
            if (enemy.texture.key === "ReaperAct2_refreshed.png") {
                reaperAlive = true;
            }
        });
        timerObj.reaperAlive = reaperAlive;
        if (!reaperAlive) {
            reaperSummonTimers.splice(i, 1);
            continue;
        }
        if (timerObj.timer > 2000) { // 1 per 2 seconds
            for (let j = 0; j < 3; j++) {
                spawnEnemy.call(this, "SinRealtdsnobackground.png");
            }
            timerObj.timer = 0;
        }
    }
    // --- Executioner Kill Mechanic (buffed) ---
    executionerKillTimer += delta || 16;
    if (executionerKillTimer > 2000) {
        let executioners = enemies.getChildren().filter(e => e.texture.key === "ExecutionerPlush.png");
        if (executioners.length > 0) {
            let allTowers = towers.getChildren();
            Phaser.Utils.Array.Shuffle(allTowers);
            let toKill = allTowers.slice(0, 3);
            toKill.forEach(tower => {
                tower.destroy();
            });
            // Show "DIE!" above each executioner
            executioners.forEach(exec => {
                if (!exec.dieText || !exec.dieText.active) {
                    exec.dieText = this.add.text(exec.x, exec.y - 40, 'DIE!', {
                        fontSize: '24px',
                        fill: '#ff0000',
                        fontStyle: 'bold',
                        fontFamily: 'Arial',
                        align: 'center'
                    }).setOrigin(0.5, 1).setDepth(100);
                    this.tweens.add({
                        targets: exec.dieText,
                        y: exec.y - 70,
                        alpha: 0,
                        duration: 900,
                        onComplete: () => { exec.dieText.destroy(); }
                    });
                }
            });
        }
        executionerKillTimer = 0;
    }
    // --- Knight Stun Mechanic (on contact) ---
    enemies.getChildren().forEach(enemy => {
        if (enemy.texture.key === "KnightLunar.png") {
            towers.getChildren().forEach(tower => {
                let d = Math.sqrt((tower.x - enemy.x) ** 2 + (tower.y - enemy.y) ** 2);
                if (d < 30 && !tower.stunned) {
                    tower.stunned = true;
                    tower.stunTime = 3000;
                }
            });
        }
    });
    // --- Reaper Kill Mechanic (kill all towers on contact, refund 75% of cost) ---
    enemies.getChildren().forEach(enemy => {
        if (enemy.texture.key === "ReaperAct2_refreshed.png") {
            towers.getChildren().forEach(tower => {
                let d = Math.sqrt((tower.x - enemy.x) ** 2 + (tower.y - enemy.y) ** 2);
                if (d < 30) {
                    towers.getChildren().forEach(t => {
                        if (t.towerCost) {
                            playerMoney += Math.floor(t.towerCost * 0.75);
                        }
                        t.destroy();
                    });
                    drawSidebar.call(this);
                }
            });
        }
    });
    // --- Stun Timer Update ---
    towers.getChildren().forEach(tower => {
        if (tower.stunned) {
            tower.stunTime -= delta || 16;
            if (tower.stunTime <= 0) {
                tower.stunned = false;
            }
        }
    });
    // --- Tower Firing Logic ---
    towers.getChildren().forEach(tower => {
        if (tower.stunned) return; // Stunned towers can't attack
        let firerateBuff = 1;
        if (!tower.isCommander) {
            towers.getChildren().forEach(other => {
                if (other.isCommander) {
                    let d = Math.sqrt((tower.x - other.x) ** 2 + (tower.y - other.y) ** 2);
                    if (d < other.range) firerateBuff *= 0.7; // 30% faster
                }
            });
        }
        if (!tower.lastShot) tower.lastShot = 0;
        tower.lastShot += delta || 16;
        let effectiveFirerate = (tower.firerate * firerateBuff) * 60; // convert to ms
        if (tower.lastShot >= effectiveFirerate) {
            // Find nearest enemy in range
            let target = null;
            let minDist = Infinity;
            enemies.getChildren().forEach(enemy => {
                let d = Math.sqrt((tower.x - enemy.x) ** 2 + (tower.y - enemy.y) ** 2);
                if (d < tower.range && d < minDist) {
                    minDist = d;
                    target = enemy;
                }
            });
            if (target) {
                fireBullet.call(this, tower, target);
                tower.lastShot = 0;
            }
        }
    });
    // --- Bullet Logic ---
    bulletGraphics.clear();
    for (let i = bullets.length - 1; i >= 0; i--) {
        let bullet = bullets[i];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.lifetime--;
        bulletGraphics.fillStyle(0xffff00, 1);
        bulletGraphics.fillCircle(bullet.x, bullet.y, 4);
        if (bullet.lifetime <= 0 || bullet.x < 0 || bullet.x > WIDTH || bullet.y < 0 || bullet.y > HEIGHT) {
            bullets.splice(i, 1);
            continue;
        }
        enemies.getChildren().forEach(enemy => {
            let d = Math.sqrt((bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2);
            if (d < 24) {
                if (!bullet.piercedEnemies) bullet.piercedEnemies = new Set();
                if (bullet.piercedEnemies.has(enemy)) return;
                bullet.piercedEnemies.add(enemy);
                enemy.enemyHealth -= bullet.damage;
                if (!bullet.piercing) bullets.splice(i, 1);
                if (enemy.enemyHealth <= 0) {
                    let cash = ENEMY_CASH[enemy.texture.key] || 0;
                    enemy.destroy();
                    playerMoney += cash;
                    drawSidebar.call(this);
                }
            }
        });
    }
    // --- Move enemies toward the ball (fix: use correct reference for ball position) ---
    enemies.getChildren().forEach(enemy => {
        if (!ball || !enemy) return;
        let dx = ball.x - enemy.x;
        let dy = ball.y - enemy.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
            let moveX = (dx / dist) * enemy.enemySpeed;
            let moveY = (dy / dist) * enemy.enemySpeed;
            enemy.x += moveX;
            enemy.y += moveY;
        }
        // Check collision with ball
        if (dist < (ballSize / 2 + enemy.displayHeight / 2)) {
            enemy.destroy();
            ballHealth--;
            drawHealthBar();
            if (ballHealth <= 0) {
                gameOver.call(this);
            }
        }
    });
    // --- End of wave check ---
    if (waveInProgress && waveQueue.length === 0 && enemies.getLength() === 0) {
        waveInProgress = false;
        currentWave++;
        if (currentWave >= WAVES.length) {
            this.add.text(WIDTH / 2 - 120, HEIGHT / 2 - 40, "Victory! All Waves Complete!", { fontSize: '32px', fill: '#0f0' });
            this.scene.pause();
        }
    }
}

function spawnEnemy(type) {
    // If no type provided, pick random (for legacy calls)
    if (!type) {
        let filtered = ENEMY_ASSETS.filter(e => e !== "SinRealtdsnobackground.png");
        type = filtered[Phaser.Math.Between(0, filtered.length - 1)];
    }
    let edge = Phaser.Math.Between(0, 3);
    let x, y;
    if (edge === 0) { x = Phaser.Math.Between(0, WIDTH); y = 0; }
    if (edge === 1) { x = WIDTH; y = Phaser.Math.Between(0, HEIGHT); }
    if (edge === 2) { x = Phaser.Math.Between(0, WIDTH); y = HEIGHT; }
    if (edge === 3) { x = 0; y = Phaser.Math.Between(0, HEIGHT); }
    let stats = ENEMY_STATS[type];
    let enemy = this.add.sprite(x, y, type);
    enemy.setDisplaySize(48, 48);
    enemy.setDepth(2);
    enemy.enemySpeed = stats.speed;
    enemy.enemyHealth = stats.health;
    enemies.add(enemy);
}

function drawHealthBar() {
    healthBar.clear();
    let barWidth = 120;
    let barHeight = 16;
    let x = WIDTH / 2 - barWidth / 2;
    let y = HEIGHT / 2 - ballSize / 2 - 30;
    // Background
    healthBar.fillStyle(0x222222, 1);
    healthBar.fillRect(x, y, barWidth, barHeight);
    // Health
    let healthWidth = (ballHealth / maxBallHealth) * barWidth;
    healthBar.fillStyle(0x00ff00, 1);
    healthBar.fillRect(x, y, healthWidth, barHeight);
    // Border
    healthBar.lineStyle(2, 0xffffff, 1);
    healthBar.strokeRect(x, y, barWidth, barHeight);
}

function drawSidebar() {
    sidebarGraphics.clear();
    sidebarGraphics.fillStyle(0x222244, 1);
    sidebarGraphics.fillRect(0, 0, 100, HEIGHT);
    // Wave indicator
    let waveText = `Wave: ${Math.min(currentWave + 1, WAVES.length)}/${WAVES.length}`;
    this.add.text(10, 10, waveText, { fontSize: '16px', fill: '#fff' });
    // Cash indicator
    this.add.text(10, 32, `Cash: $${playerMoney}`, { fontSize: '16px', fill: '#0f0' });
    this.add.text(10, 54, 'Towers', { fontSize: '16px', fill: '#fff' });
    TOWER_ASSETS.forEach((asset, i) => {
        let stats = TOWER_STATS[asset];
        let y = 80 + i * 90;
        this.add.text(70, y - 20, `R:${stats.range}`, { fontSize: '12px', fill: '#fff' });
        this.add.text(70, y - 5, `D:${stats.damage}`, { fontSize: '12px', fill: '#fff' });
        this.add.text(70, y + 10, `F:${stats.firerate}`, { fontSize: '12px', fill: '#fff' });
        this.add.text(70, y + 25, `$${stats.cost}`, { fontSize: '12px', fill: '#ff0' });
        if (stats.isCommander) {
            this.add.text(10, y + 35, 'Commander: Reduces firerate of towers in range', { fontSize: '10px', fill: '#0ff' });
        }
    });
}

function placeTower(x, y, asset) {
    // Prevent placing on the ball or sidebar
    let dx = x - ball.x;
    let dy = y - ball.y;
    if (Math.sqrt(dx * dx + dy * dy) < ballSize || x < 100) return;
    let stats = TOWER_STATS[asset];
    if (playerMoney < stats.cost) return;
    let tower = this.add.sprite(x, y, asset);
    tower.setDisplaySize(48, 48);
    tower.towerType = asset;
    tower.range = stats.range;
    tower.damage = stats.damage;
    tower.firerate = stats.firerate;
    tower.isCommander = !!stats.isCommander;
    tower.lastShot = 0;
    tower.towerCost = stats.cost; // Track cost for refund
    towers.add(tower);
    playerMoney -= stats.cost;
    drawSidebar.call(this);
}

function fireBullet(tower, target) {
    let angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    let speed = 6;
    if (tower.towerType === "Shotgun.png") {
        // Shotgun: 3 piercing bullets in a spread
        for (let i = -1; i <= 1; i++) {
            let spread = angle + i * 0.18; // ~10 degrees
            let bullet = {
                x: tower.x,
                y: tower.y,
                vx: Math.cos(spread) * speed,
                vy: Math.sin(spread) * speed,
                lifetime: 20,
                damage: tower.damage,
                piercing: true,
                piercedEnemies: new Set()
            };
            bullets.push(bullet);
        }
    } else {
        let bullet = {
            x: tower.x,
            y: tower.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            lifetime: 60,
            damage: tower.damage
        };
        bullets.push(bullet);
    }
}

function renderBullets(graphics) {
    bullets.getChildren().forEach(bullet => {
        graphics.fillStyle(0xffff00, 1);
        graphics.fillCircle(bullet.x, bullet.y, 4);
    });
}

function gameOver() {
    this.add.text(WIDTH / 2 - 80, HEIGHT / 2, "Game Over!", { fontSize: '32px', fill: '#ff0000' });
    this.scene.pause();
}
