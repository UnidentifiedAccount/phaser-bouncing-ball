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
    "SinRealtdsnobackground.png",
    "demon.png" // Added demon asset
];
const TOWER_ASSETS = [
    "Commander.png",
    "Minigunner.png",
    "Scout.png",
    "Shotgun.png"
];

// Assign stats for each enemy asset
const ENEMY_STATS = {
    "CitizenPlush.png":    { speed: 1.0, health: 4 },
    "CobaltGuardLunar.png":{ speed: 0.8, health: 50 },
    "ExecutionerPlush.png":{ speed: 0.3, health: 360 },
    "GhostLunar.png":      { speed: 1.2, health: 5 },
    "KnightLunar.png":     { speed: 2, health: 10 },
    "LO_Marionette.png":   { speed: 1.3, health: 20},
    "ReaperAct2_refreshed.png": { speed: 0.6, health: 60 },
    "SinRealtdsnobackground.png": { speed: 1.5, health: 1 },
    "demon.png":           { speed: 0.5, health: 100 } // Demon stats
};

// Cash rewards per enemy type
const ENEMY_CASH = {
    "CitizenPlush.png": 15,
    "CobaltGuardLunar.png": 60,
    "ExecutionerPlush.png": 300,
    "GhostLunar.png": 25,
    "KnightLunar.png": 40,
    "LO_Marionette.png": 50,
    "ReaperAct2_refreshed.png": 65,
    "SinRealtdsnobackground.png": 5,
    "demon.png": 20 // Demon cash
};

// Tower stats
const TOWER_STATS = {
    "Commander.png":   { range: 150, damage: 4, firerate: 12, cost: 110, isCommander: true },
    "Minigunner.png":  { range: 120, damage: 2, firerate: 0.5, cost: 130 },
    "Scout.png":       { range: 80,  damage: 5, firerate: 9, cost: 25 },
    "Shotgun.png":     { range: 60,  damage: 3, firerate: 6, cost:  45},
};

// --- HP MODIFIER CONFIG ---
const ENEMY_HP_MODIFIER = {
    // key: firstWaveAppeared
    "CitizenPlush.png": 0,
    "GhostLunar.png": 0,
    "KnightLunar.png": 1,
    "CobaltGuardLunar.png": 2,
    "LO_Marionette.png": 4,
    "ReaperAct2_refreshed.png": 3,
    "ExecutionerPlush.png": 4,
    "SinRealtdsnobackground.png": 3,
    "demon.png": 4 // Demon only appears after wave 5, but only via Reaper
};

// --- WAVE REWARD CONFIG ---
const WAVE_REWARDS = [50, 100, 200, 400];

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
        { type: "CitizenPlush.png", count: 6 },
        { type: "GhostLunar.png", count: 4 }
    ],
    [ // Wave 2
        { type: "CitizenPlush.png", count: 7 },
        { type: "GhostLunar.png", count: 5 },
        { type: "KnightLunar.png", count: 4 }
    ],
    [ // Wave 3
        { type: "KnightLunar.png", count: 9 },
        { type: "CobaltGuardLunar.png", count: 4 },
        { type: "LO_Marionette.png", count: 8 } // Add 10 Marionettes
    ],
    [ // Wave 4
        { type: "CobaltGuardLunar.png", count: 6 },
        { type: "ReaperAct2_refreshed.png", count: 2 }
    ],
    [ // Wave 5 (Final)
        { type: "CitizenPlush.png", count: 20 },
        { type: "CobaltGuardLunar.png", count: 10 }, // 5 more (was 5)
        { type: "LO_Marionette.png", count: 17 },
         { type: "ReaperAct2_refreshed.png", count: 4 }, // 1 more (was 3)
        { type: "ExecutionerPlush.png", count: 1 },
        { type: "KnightLunar.png", count: 18 }, // 5 more (was 15)
        { type: "GhostLunar.png", count: 19 },
        
    ]
];
let currentWave = 0;
let waveQueue = [];
let waveInProgress = false;
let waveTimer = 0;
let reaperSummonTimers = {}; // { [reaperId]: { timer: number, reaper: Phaser.Sprite } }
let stunnedTowers = [];
let executionerStunTimer = 0;
let executionerKillTimer = 0;

// --- GLOBAL REAPER ID COUNTER ---
if (typeof window.REAPER_ID_COUNTER === 'undefined') window.REAPER_ID_COUNTER = 1;

let hpModifierIcon = null;
let hpModifierTooltip = null;

function preload() {
    this.load.image("ball", "assets/ball.png");
    ENEMY_ASSETS.forEach(asset => this.load.image(asset, `assets/${asset}`));
    TOWER_ASSETS.forEach(asset => this.load.image(asset, `Towers/${asset}`));
}

function create() {
    // Ball (objective) in the center
    ball = this.add.sprite(WIDTH / 2, HEIGHT / 2, "ball");
    ball.setDisplaySize(ballSize * 0.5, ballSize * 0.5); // Shrink base to 50%
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
        // Adjust iconY to align icons with their stat descriptions
        let iconY = 90 + i * 90; // Was 60 + i*90, now 90 for better alignment
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
    // --- HP Modifier Indicator ---
    // Remove previous indicator if it exists
    if (hpModifierIcon && hpModifierIcon.destroy) hpModifierIcon.destroy();
    if (hpModifierTooltip && hpModifierTooltip.destroy) hpModifierTooltip.destroy();
    hpModifierIcon = this.add.rectangle(10, HEIGHT - 30, 28, 28, 0x8844ff, 0.8).setOrigin(0, 0).setInteractive();
    let hpText = this.add.text(16, HEIGHT - 26, 'HP+', { fontSize: '16px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0, 0);
    hpModifierIcon.on('pointerover', () => {
        if (hpModifierTooltip && hpModifierTooltip.destroy) hpModifierTooltip.destroy();
        hpModifierTooltip = this.add.text(45, HEIGHT - 38, 'Enemy HP increases by 13% per wave after first appearance.', {
            fontSize: '14px', fill: '#fff', backgroundColor: '#222', padding: { left: 6, right: 6, top: 2, bottom: 2 }
        }).setDepth(200).setOrigin(0, 0);
    });
    hpModifierIcon.on('pointerout', () => {
        if (hpModifierTooltip && hpModifierTooltip.destroy) hpModifierTooltip.destroy();
        hpModifierTooltip = null;
    });
}

let waveTransitionTimer = 0;
let waveTransitionActive = false;
let waveCompleteText = null;
let punishmentText = null;
let specialLongTransition = false;
let phase2Text = null;

function update(time, delta) {
    // --- Wave Spawning ---
    if (!waveInProgress && currentWave < WAVES.length && !waveTransitionActive) {
        startWave.call(this, currentWave);
    }
    // Handle wave transition delay
    if (waveTransitionActive) {
        waveTransitionTimer += delta || 16;
        let transitionDuration = 10000; // 10 seconds between waves
        // --- Show different interval text and color for each transition ---
        let intervalText = 'You should repent commander.The cult deems you guilty of your sins.';
        let intervalColor = '#8844ff'; // purple by default
        let intervalFontSize = '7px';
        if (currentWave === 1) {
            intervalText = 'You should repent commander. The cult deems you GUILTY of your sins.';
            intervalColor = '#8844ff';
        } 
        else if (currentWave === 2) {
            intervalText = 'Stop resisting and accept your punishment. It is HIS will';
            intervalColor = '#a000c8'; // purple-red blend

        } else if (currentWave === 3) {
            intervalText = "You are really are stubborn aren't you. Guess I'll have to kill you myself.";
            intervalColor = '#c00044'; // more red

        } else if (currentWave === 4) {
            intervalText = "Puny mortal, for your crimes, thy Punishment is DEATH";
            intervalColor = '#ff0000'; // pure red
        } else {
            intervalText = '';
        }
        if (!this.customIntervalText && intervalText) {
            this.customIntervalText = this.add.text(WIDTH / 2, HEIGHT / 2, intervalText, {
                fontSize: '28px',
                fill: intervalColor,
                fontStyle: 'bold',
                fontFamily: 'Arial',
                align: 'center'
            }).setOrigin(0.5, 0.5).setDepth(200);
        }
        if (waveTransitionTimer > transitionDuration) {
            waveTransitionActive = false;
            waveTransitionTimer = 0;
            specialLongTransition = false;
            if (waveCompleteText && waveCompleteText.destroy) waveCompleteText.destroy();
            if (punishmentText && punishmentText.destroy) { punishmentText.destroy(); punishmentText = null; }
            if (this.customIntervalText && this.customIntervalText.destroy) { this.customIntervalText.destroy(); this.customIntervalText = null; }
            if (currentWave < WAVES.length) {
                startWave.call(this, currentWave);
            }
        }
        return;
    }
    if (waveInProgress && waveQueue.length > 0) {
        waveTimer += delta || 16;
        if (waveTimer > 800) {
            let type = waveQueue.shift();
            if (type === "ReaperAct2_refreshed.png") {
                let reaper = spawnEnemy.call(this, type);
                if (reaper && reaper.id !== undefined) {
                    reaperSummonTimers[reaper.id] = { timer: 0 };
                }
            } else if (type !== "SinRealtdsnobackground.png") {
                spawnEnemy.call(this, type);
            }
            waveTimer = 0;
        }
    }
    // --- Reaper Summoning SinRealtdsnobackground.png (nerfed to 1 per 2 seconds) ---
    for (const reaperId in reaperSummonTimers) {
        if (!reaperSummonTimers.hasOwnProperty(reaperId)) continue;
        let timerObj = reaperSummonTimers[reaperId];
        timerObj.timer += delta || 16;
        // Find if the specific reaper for this timer is still alive
        let reaper = enemies.getChildren().find(enemy => enemy.texture.key === "ReaperAct2_refreshed.png" && enemy.id == reaperId && enemy.active);
        if (!reaper) {
            delete reaperSummonTimers[reaperId]; // Remove timer if reaper is dead
            continue;
        }
        if (timerObj.timer > 2000) { // 1 per 2 seconds
            for (let j = 0; j < 3; j++) {
                spawnEnemy.call(this, "SinRealtdsnobackground.png");
            }
            for (let j = 0; j < 5; j++) {
                spawnEnemy.call(this, "GhostLunar.png");
            }
            // --- Reaper now also summons 2 demons at edges ---
            window.allowDemonSpawn = true;
            for (let j = 0; j < 2; j++) {
                spawnEnemyAtEdge.call(this, "demon.png");
            }
            window.allowDemonSpawn = false;
            timerObj.timer = 0;
        }
    }
    // --- Executioner Kill Mechanic (nerfed, but buffed in phase 2) ---
    executionerKillTimer += delta || 16;
    if (executionerKillTimer > 3000) { // Every 3 seconds
        let executioners = enemies.getChildren().filter(e => e.texture.key === "ExecutionerPlush.png");
        if (executioners.length > 0) {
            let allTowers = towers.getChildren().filter(t => t.active);
            Phaser.Utils.Array.Shuffle(allTowers);
            executioners.forEach(exec => {
                // PHASE 2 BUFF: kill 3 and stun 1 tower every 3s
                if (exec.phase2) {
                    let phase2Towers = allTowers.slice(0, 4); // 3 to kill, 1 to stun
                    let toKill = phase2Towers.slice(0, 3);
                    let toStun = phase2Towers[3];
                    toKill.forEach(tower => { if (tower) tower.destroy(); });
                    if (toStun && !toStun.stunned) {
                        toStun.stunned = true;
                        toStun.stunTime = 3000;
                    }
                } else {
                    // Normal: kill 2 towers
                    let toKill = allTowers.slice(0, 2);
                    toKill.forEach(tower => { if (tower) tower.destroy(); });
                }
                // Show "DIE!" above each executioner
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
    // --- Reaper Kill Mechanic (kill 1 tower every 5 seconds, refund 75% of cost) ---
    if (!this.reaperKillTimers) this.reaperKillTimers = {};
    let sidebarNeedsUpdate = false;
    enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        if (enemy.texture.key === "ReaperAct2_refreshed.png") {
            if (!this.reaperKillTimers[enemy.id]) this.reaperKillTimers[enemy.id] = 0;
            this.reaperKillTimers[enemy.id] += delta || 16;
            if (this.reaperKillTimers[enemy.id] >= 5000) {
                let towersArr = towers.getChildren().filter(t => t.active);
                if (towersArr.length > 0) {
                    Phaser.Utils.Array.Shuffle(towersArr);
                    let tower = towersArr[0];
                    if (tower.towerCost) {
                        playerMoney += Math.floor(tower.towerCost * 0.75);
                    }
                    tower.destroy();
                    sidebarNeedsUpdate = true;
                }
                this.reaperKillTimers[enemy.id] = 0;
            }
        }
    });
    // Clean up timers for dead reapers
    Object.keys(this.reaperKillTimers).forEach(id => {
        let stillExists = enemies.getChildren().some(e => e.active && e.texture.key === "ReaperAct2_refreshed.png" && e.id == id);
        if (!stillExists) delete this.reaperKillTimers[id];
    });
    // --- Stun Timer Update & Visual Indicator ---
    towers.getChildren().forEach(tower => {
        if (!tower.active) return;
        // Highlight yellow if buffed by commander (but not commander himself)
        if (!tower.isCommander) {
            let inRangeOfCommander = towers.getChildren().some(other => other.isCommander && Math.sqrt((tower.x - other.x) ** 2 + (tower.y - other.y) ** 2) < other.range);
            if (inRangeOfCommander) {
                tower.setTint(0xffff00); // yellow
            } else if (!tower.stunned) {
                tower.clearTint();
            }
        }
        // Stun logic
        if (tower.stunned) {
            tower.stunTime -= delta || 16;
            tower.setAlpha(0.4); // Translucent when stunned
            if (tower.stunTime <= 0) {
                tower.stunned = false;
                tower.setAlpha(1);
            }
        } else {
            tower.setAlpha(1);
        }
    });
    // --- Tower Firing Logic ---
    let bulletsSpawnedThisFrame = 0;
    const BULLET_SPAWN_LIMIT_PER_FRAME = 1000;
    towers.getChildren().forEach(tower => {
        if (!tower.active) return; // Skip destroyed towers
        if (tower.stunned) return; // Stunned towers can't attack
        let firerateBuff = 1;
        if (!tower.isCommander) {
            // Commander buff: halve interval between shots (2x firerate), not stackable
            let inRangeOfCommander = towers.getChildren().some(other => other.isCommander && Math.sqrt((tower.x - other.x) ** 2 + (tower.y - other.y) ** 2) < other.range);
            if (inRangeOfCommander) firerateBuff *= 0.5; // 2x faster
        }
        if (!tower.lastShot) tower.lastShot = 0;
        tower.lastShot += delta || 16;
        let effectiveFirerate = (tower.firerate * firerateBuff) * 60;
        effectiveFirerate = Math.max(effectiveFirerate, 120); // Clamp: minimum 120ms between shots
        // All towers (including Minigunner) use bullet logic
        if (tower.lastShot >= effectiveFirerate && bulletsSpawnedThisFrame < BULLET_SPAWN_LIMIT_PER_FRAME) {
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
                let before = bullets.length;
                fireBullet.call(this, tower, target);
                let after = bullets.length;
                bulletsSpawnedThisFrame += (after - before);
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
            if (!enemy.active) return;
            let d = Math.sqrt((bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2);
            if (d < 24) {
                if (!bullet.piercedEnemies) bullet.piercedEnemies = new Set();
                if (bullet.piercedEnemies.has(enemy)) return;
                bullet.piercedEnemies.add(enemy);
                enemy.enemyHealth -= bullet.damage;
                if (!bullet.piercing) bullets.splice(i, 1);
                if (enemy.enemyHealth <= 0) {
                    let cash = ENEMY_CASH[enemy.texture.key] || 0;
                    // --- Wave 5 death counter for Executioner spawn ---
                    if (currentWave === 4 && typeof window.wave5DeathCounter === 'number') {
                        window.wave5DeathCounter++;
                    }
                    enemy.destroy();
                    playerMoney += cash;
                    sidebarNeedsUpdate = true;
                }
            }
        });
    }
    // Only update sidebar once per frame if needed
    if (sidebarNeedsUpdate) drawSidebar.call(this);
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
        // --- Executioner special: instant base kill and phase 2 ---
        if (enemy.texture.key === "ExecutionerPlush.png") {
            // Phase 2: Summon on half health (if not already done and not at base)
            if (!enemy.phase2 && enemy.enemyHealth <= ENEMY_STATS["ExecutionerPlush.png"].health / 2 && !enemy.hasSummonedPhase2) {
                for (let i = 0; i < 3; i++) {
                    spawnEnemyAtEdge.call(this, "CobaltGuardLunar.png");
                }
                for (let i = 0; i < 10; i++) {
                    spawnEnemyAtEdge.call(this, "KnightLunar.png");
                }
                spawnEnemyAtEdge.call(this, "ReaperAct2_refreshed.png");
                enemy.hasSummonedPhase2 = true;
                enemy.phase2 = true;
                // --- PHASE 2 BUFF: Move to edge, heal, increase speed ---
                let edge = Phaser.Math.Between(0, 3);
                let newX, newY;
                if (edge === 0) { newX = Phaser.Math.Between(0, WIDTH); newY = 0; }
                if (edge === 1) { newX = WIDTH; newY = Phaser.Math.Between(0, HEIGHT); }
                if (edge === 2) { newX = Phaser.Math.Between(0, WIDTH); newY = HEIGHT; }
                if (edge === 3) { newX = 0; newY = Phaser.Math.Between(0, HEIGHT); }
                enemy.x = newX;
                enemy.y = newY;
                enemy.enemyHealth = 200;
                enemy.enemySpeed = 0.6; // Correct phase 2 speed
                // Remove phase2 indicator if it exists
                if (enemy.phase2Text && enemy.phase2Text.destroy) { enemy.phase2Text.destroy(); enemy.phase2Text = null; }
                // Make Executioner glow red in phase 2
                enemy.setTint(0xff2222);
            }
            // Remove phase2 indicator if executioner dies
            if ((!enemy.active || enemy.enemyHealth <= 0) && enemy.phase2Text && enemy.phase2Text.destroy) {
                enemy.phase2Text.destroy();
                enemy.phase2Text = null;
            }
            // Remove healthbar if executioner dies
            if ((!enemy.active || enemy.enemyHealth <= 0) && enemy.execHealthBar) {
                enemy.execHealthBar.clear();
                enemy.execHealthBar.destroy();
                enemy.execHealthBar = null;
            }
            if ((!enemy.active || enemy.enemyHealth <= 0) && enemy.execHealthBarText) {
                enemy.execHealthBarText.destroy();
                enemy.execHealthBarText = null;
            }
            // Remove red glow if executioner dies
            if ((!enemy.active || enemy.enemyHealth <= 0) && enemy.clearTint) {
                enemy.clearTint();
            }
            // If Executioner reaches the base, instant game over
            if (dist < (ballSize / 2 + enemy.displayHeight / 2)) {
                ballHealth = 0;
                drawHealthBar();
                gameOver.call(this);
                if (enemy.phase2Text && enemy.phase2Text.destroy) { enemy.phase2Text.destroy(); enemy.phase2Text = null; }
                enemy.destroy();
            }
        } else if (dist < (ballSize / 2 + enemy.displayHeight / 2)) {
            // Normal enemy collision with base
            if (enemy.texture.key === "demon.png") {
                enemy.destroy();
                ballHealth -= 4; // Demon deals 4 damage
            } else {
                enemy.destroy();
                ballHealth--;
            }
            drawHealthBar();
            if (ballHealth <= 0) {
                gameOver.call(this);
            }
        }
    });
    // --- End of wave check ---
    if (waveInProgress && waveQueue.length === 0 && enemies.getLength() === 0) {
        waveInProgress = false;
        // --- Give wave reward ---
        if (currentWave < WAVE_REWARDS.length) {
            playerMoney += WAVE_REWARDS[currentWave];
            drawSidebar.call(this);
        }
        currentWave++;
        // Clean up wave 5 death counter variables
        window.wave5DeathCounter = undefined;
        window.wave5ExecToSpawn = undefined;
        window.wave5ExecSpawned = undefined;
        if (currentWave >= WAVES.length) {
            this.add.text(WIDTH / 2 - 80, HEIGHT / 2, "Victory!", { fontSize: '32px', fill: '#0f0' });
            this.scene.pause();
        } else {
            // Special long transition before final wave
            if (currentWave === WAVES.length) {
                // Should not happen, handled above
            } else if (currentWave === WAVES.length - 1) {
                // After wave 4, before wave 5
                if (waveCompleteText && waveCompleteText.destroy) waveCompleteText.destroy();
                waveCompleteText = this.add.text(WIDTH / 2, HEIGHT / 2 - 40, `Wave ${currentWave} Complete!`, {
                    fontSize: '32px', fill: '#fff', fontStyle: 'bold', fontFamily: 'Arial', align: 'center'
                }).setOrigin(0.5, 0.5).setDepth(100);
                punishmentText = this.add.text(WIDTH / 2, HEIGHT / 2 + 10, 'YOU WILL FACE YOUR PUNISHMENT HERETIC', {
                    fontSize: '14px', fill: '#ff2222', fontStyle: 'bold', fontFamily: 'Arial', align: 'center'
                }).setOrigin(0.5, 0.5).setDepth(101);
                waveTransitionActive = true;
                waveTransitionTimer = 0;
                specialLongTransition = true;
            } else {
                // Normal transition
                if (waveCompleteText && waveCompleteText.destroy) waveCompleteText.destroy();
                waveCompleteText = this.add.text(WIDTH / 2, HEIGHT / 2 - 40, `Wave ${currentWave} Complete!`, {
                    fontSize: '32px', fill: '#fff', fontStyle: 'bold', fontFamily: 'Arial', align: 'center'
                }).setOrigin(0.5, 0.5).setDepth(100);
                waveTransitionActive = true;
                waveTransitionTimer = 0;
                specialLongTransition = false;
            }
        }
    }

    // --- Executioner spawn logic for wave 5 ---
    if (currentWave === 4 && typeof window.wave5DeathCounter === 'number' && window.wave5ExecToSpawn > 0 && window.wave5ExecSpawned < window.wave5ExecToSpawn) {
        if (window.wave5DeathCounter >= 25) { // Nerfed: now 25 deaths required
            // Spawn Executioner(s) at edge
            for (let i = 0; i < window.wave5ExecToSpawn; i++) {
                spawnEnemyAtEdge.call(this, "ExecutionerPlush.png");
                window.wave5ExecSpawned++;
            }
            window.wave5ExecToSpawn = 0; // Prevent further spawns
        }
    }

    // --- Executioner healthbar below him ---
    enemies.getChildren().forEach(enemy => {
        if (enemy.texture && enemy.texture.key === "ExecutionerPlush.png" && enemy.active) {
            if (!enemy.execHealthBar) {
                enemy.execHealthBar = this.add.graphics();
                enemy.execHealthBarText = this.add.text(enemy.x, enemy.y + 38, 'Executioner', { fontSize: '10px', fill: '#ff0000', fontStyle: 'bold', fontFamily: 'Arial' }).setOrigin(0.5, 0);
            }
            // Update healthbar position and value
            let barWidth = 48;
            let barHeight = 6;
            let x = enemy.x - barWidth / 2;
            let y = enemy.y + 24;
            let maxHp = enemy.phase2 ? 200 : ENEMY_STATS["ExecutionerPlush.png"].health;
            let healthRatio = Math.max(0, enemy.enemyHealth / maxHp);
            enemy.execHealthBar.clear();
            enemy.execHealthBar.fillStyle(0x222222, 1);
            enemy.execHealthBar.fillRect(x, y, barWidth, barHeight);
            enemy.execHealthBar.fillStyle(0xff0000, 1);
            enemy.execHealthBar.fillRect(x, y, barWidth * healthRatio, barHeight);
            enemy.execHealthBar.lineStyle(1, 0xffffff, 1);
            enemy.execHealthBar.strokeRect(x, y, barWidth, barHeight);
            enemy.execHealthBar.setDepth(100);
            enemy.execHealthBarText.setPosition(enemy.x, y + barHeight + 1);
            enemy.execHealthBarText.setDepth(101);
        } else if (enemy.execHealthBar) {
            enemy.execHealthBar.clear();
            enemy.execHealthBar.destroy();
            enemy.execHealthBar = null;
            if (enemy.execHealthBarText) { enemy.execHealthBarText.destroy(); enemy.execHealthBarText = null; }
        }
    });
}

function startWave(waveNum) {
    if (waveNum >= WAVES.length) return;
    waveQueue = [];
    reaperSummonTimers = {};
    // --- Custom spawn order for Executioner in wave 5 ---
    if (waveNum === 4) { // Wave 5 (index 4)
        let entries = [];
        let execCount = 0;
        WAVES[waveNum].forEach(entry => {
            for (let i = 0; i < entry.count; i++) {
                if (entry.type === "ExecutionerPlush.png") execCount++;
                else entries.push(entry.type);
            }
        });
        // Set up death counter for Executioner spawn
        window.wave5DeathCounter = 0;
        window.wave5ExecToSpawn = execCount;
        window.wave5ExecSpawned = 0;
        waveQueue = entries;
    } else {
        WAVES[waveNum].forEach(entry => {
            for (let i = 0; i < entry.count; i++) {
                waveQueue.push(entry.type);
            }
        });
        Phaser.Utils.Array.Shuffle(waveQueue);
    }
    waveInProgress = true;
    waveTimer = 0;
    // Remove wave complete text if present
    if (typeof waveCompleteText !== 'undefined' && waveCompleteText && waveCompleteText.destroy) {
        waveCompleteText.destroy();
        waveCompleteText = null;
    }
    // Show fun message for final wave
    if (waveNum === WAVES.length - 1) {
        if (this.finalWaveText && this.finalWaveText.destroy) this.finalWaveText.destroy();
        this.finalWaveText = this.add.text(WIDTH / 2, 40, 'YOU SHALL DIE HERETIC!!!', {
            fontSize: '32px',
            fill: '#ff0000',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            align: 'center'
        }).setOrigin(0.5, 0).setDepth(100);
    } else if (this.finalWaveText && this.finalWaveText.destroy) {
        this.finalWaveText.destroy();
        this.finalWaveText = null;
    }
}

function spawnEnemy(type) {
    // If no type provided, pick random (for legacy calls)
    if (!type) {
        let filtered = ENEMY_ASSETS.filter(e => e !== "SinRealtdsnobackground.png" && e !== "demon.png"); // Prevent demon from random spawn
        type = filtered[Phaser.Math.Between(0, filtered.length - 1)];
    }
    // Prevent demon from spawning except via Reaper's summon
    if (type === "demon.png" && !window.allowDemonSpawn) return null;
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
    // --- Apply HP modifier ---
    let firstWave = ENEMY_HP_MODIFIER[type] ?? 0;
    let bonusWaves = typeof currentWave === 'number' ? Math.max(0, currentWave - firstWave) : 0;
    let bonusHp = Math.ceil(stats.health * 0.13 * bonusWaves); // 13% per wave
    enemy.enemySpeed = stats.speed;
    enemy.enemyHealth = stats.health + bonusHp;
    // Assign unique id for reaper kill timer
    if (type === "ReaperAct2_refreshed.png") enemy.id = window.REAPER_ID_COUNTER++;
    // --- Executioner phase 2 cash bonus ---
    if (type === "ExecutionerPlush.png" && enemy.phase2CashGiven !== true) {
        enemy.phase2CashGiven = false;
    }
    enemies.add(enemy);
    return enemy;
}

// Helper to spawn enemy at random edge
function spawnEnemyAtEdge(type) {
    // Prevent demon from spawning except via Reaper's summon
    if (type === "demon.png" && !window.allowDemonSpawn) return null;
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
    if (type === "ReaperAct2_refreshed.png") enemy.id = window.REAPER_ID_COUNTER++;
    enemies.add(enemy);
    return enemy;
}

function drawHealthBar() {
    healthBar.clear();
    let barWidth = 60; // 50% of previous 120
    let barHeight = 8; // 50% of previous 16
    let x = WIDTH / 2 - barWidth / 2;
    let y = HEIGHT / 2 - (ballSize * 0.5) / 2 - 15; // Adjust for smaller base
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

let waveTextObj = null;
let moneyTextObj = null;

function drawSidebar() {
    sidebarGraphics.clear();
    sidebarGraphics.fillStyle(0x222244, 1);
    sidebarGraphics.fillRect(0, 0, 100, HEIGHT);
    // Remove previous text objects if they exist
    if (waveTextObj && waveTextObj.destroy) { waveTextObj.destroy(); waveTextObj = null; }
    if (moneyTextObj && moneyTextObj.destroy) { moneyTextObj.destroy(); moneyTextObj = null; }
    // --- Wave indicator removed as requested ---
    // Cash indicator
    moneyTextObj = this.add.text(10, 32, `Cash: $${playerMoney}`, { fontSize: '16px', fill: '#0f0' });
    this.add.text(10, 54, 'Towers', { fontSize: '16px', fill: '#fff' });
    TOWER_ASSETS.forEach((asset, i) => {
        let stats = TOWER_STATS[asset];
        let y = 90 + i * 90; // Match iconY for alignment
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
        if (!enemy.active) return;
        let d = Math.sqrt((bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2);
        if (d < 24) {
            if (!bullet.piercedEnemies) bullet.piercedEnemies = new Set();
            if (bullet.piercedEnemies.has(enemy)) return;
            bullet.piercedEnemies.add(enemy);
            enemy.enemyHealth -= bullet.damage;
            if (!bullet.piercing) bullets.splice(i, 1);
            if (enemy.enemyHealth <= 0) {
                let cash = ENEMY_CASH[enemy.texture.key] || 0;
                // --- Wave 5 death counter for Executioner spawn ---
                if (currentWave === 4 && typeof window.wave5DeathCounter === 'number') {
                    window.wave5DeathCounter++;
                }
                enemy.destroy();
                playerMoney += cash;
                sidebarNeedsUpdate = true;
            }
        }
    });
}
// --- Tower special death logic (Minigunner second chance) ---
// This must be after all destroy() calls for towers in the frame
// Remove Minigunner second chance logic: all towers die normally
let towersToRemove = [];
towers.getChildren().forEach(tower => {
    if (!tower.active) return;
    if (tower._pendingDestroy) {
        // Already handled
        return;
    }
    // Check if tower was destroyed this frame (by enemy or mechanic)
    if (!tower.scene) return; // Already destroyed
});
towersToRemove.forEach(tower => { tower._pendingDestroy = true; tower.destroy(); });
