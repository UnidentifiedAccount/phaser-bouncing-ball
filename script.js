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
    "CobaltGuardLunar.png":{ speed: 0.8, health: 10 },
    "ExecutionerPlush.png":{ speed: 0.5, health: 30 },
    "GhostLunar.png":      { speed: 1.8, health: 2 },
    "KnightLunar.png":     { speed: 1.1, health: 5 },
    "LO_Marionette.png":   { speed: 1.3, health: 1 },
    "ReaperAct2_refreshed.png": { speed: 0.8, health: 15 },
    "SinRealtdsnobackground.png": { speed: 1.6, health: 1 }
};

// Tower stats
const TOWER_STATS = {
    "Commander.png":   { range: 120, damage: 1, firerate: 5, cost: 30, isCommander: true },
    "Minigunner.png":  { range: 100, damage: 1, firerate: 0.1, cost: 40 },
    "Scout.png":       { range: 80,  damage: 2, firerate: 3, cost: 10 },
    "Shotgun.png":     { range: 60,  damage: 4, firerate: 5, cost: 20 }
};

const config = {
    type: Phaser.AUTO,
    width: WIDTH,
    height: HEIGHT,
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
let bullets;
// Add a render layer for bullets
let bulletGraphics;

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

    // Enemy group
    enemies = this.physics.add.group();

    // Tower group
    towers = this.add.group();
    // Bullet group
    bullets = this.physics.add.group();
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
    // Sidebar tower icons (for drag and drop)
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
    // Drag and drop logic
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

function update(time, delta) {
    // Spawn enemies at intervals
    enemySpawnTimer++;
    if (enemySpawnTimer >= enemySpawnInterval) {
        spawnEnemy.call(this);
        enemySpawnTimer = 0;
    }
    // Move enemies toward the ball
    enemies.getChildren().forEach(enemy => {
        let dx = ball.x - enemy.x;
        let dy = ball.y - enemy.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
            enemy.x += (dx / dist) * enemy.enemySpeed;
            enemy.y += (dy / dist) * enemy.enemySpeed;
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
    // --- Tower Firing Logic ---
    towers.getChildren().forEach(tower => {
        // Commander passive: reduce firerate of other towers in range
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
        tower.lastShot += delta;
        let effectiveFirerate = tower.firerate * firerateBuff;
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
    bullets.getChildren().forEach(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.lifetime--;
        // Remove bullet if out of lifetime or out of bounds
        if (bullet.lifetime <= 0 || bullet.x < 0 || bullet.x > WIDTH || bullet.y < 0 || bullet.y > HEIGHT) {
            bullet.destroy();
        } else {
            // Check collision with enemies
            enemies.getChildren().forEach(enemy => {
                let d = Math.sqrt((bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2);
                if (d < 24) {
                    enemy.enemyHealth -= bullet.damage;
                    bullet.destroy();
                    if (enemy.enemyHealth <= 0) {
                        enemy.destroy();
                        playerMoney += 2;
                        drawSidebar.call(this);
                    }
                }
            });
        }
    });
    renderBullets(bulletGraphics);
}

function spawnEnemy() {
    // Random edge and random position along that edge
    let edge = Phaser.Math.Between(0, 3); // 0=top, 1=right, 2=bottom, 3=left
    let x, y;
    if (edge === 0) { x = Phaser.Math.Between(0, WIDTH); y = 0; }
    if (edge === 1) { x = WIDTH; y = Phaser.Math.Between(0, HEIGHT); }
    if (edge === 2) { x = Phaser.Math.Between(0, WIDTH); y = HEIGHT; }
    if (edge === 3) { x = 0; y = Phaser.Math.Between(0, HEIGHT); }
    let asset = ENEMY_ASSETS[Phaser.Math.Between(0, ENEMY_ASSETS.length - 1)];
    let stats = ENEMY_STATS[asset];
    let enemy = enemies.create(x, y, asset);
    enemy.setDisplaySize(48, 48);
    enemy.setDepth(2);
    enemy.enemySpeed = stats.speed;
    enemy.enemyHealth = stats.health;
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
    this.add.text(10, 10, 'Towers', { fontSize: '18px', fill: '#fff' });
    TOWER_ASSETS.forEach((asset, i) => {
        let stats = TOWER_STATS[asset];
        let y = 60 + i * 90;
        this.add.text(70, y - 20, `R:${stats.range}`, { fontSize: '12px', fill: '#fff' });
        this.add.text(70, y - 5, `D:${stats.damage}`, { fontSize: '12px', fill: '#fff' });
        this.add.text(70, y + 10, `F:${stats.firerate}`, { fontSize: '12px', fill: '#fff' });
        this.add.text(70, y + 25, `$${stats.cost}`, { fontSize: '12px', fill: '#ff0' });
        if (stats.isCommander) {
            this.add.text(10, y + 35, 'Commander: Reduces firerate of towers in range', { fontSize: '10px', fill: '#0ff' });
        }
    });
    this.add.text(10, HEIGHT - 40, `Money: $${playerMoney}`, { fontSize: '14px', fill: '#0f0' });
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
    towers.add(tower);
    playerMoney -= stats.cost;
    drawSidebar.call(this);
}

function fireBullet(tower, target) {
    let angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    let speed = 6;
    // Use a graphics object for bullet visuals
    let bullet = bullets.create(tower.x, tower.y, null);
    bullet.setData('isBullet', true);
    bullet.vx = Math.cos(angle) * speed;
    bullet.vy = Math.sin(angle) * speed;
    bullet.lifetime = 60;
    bullet.damage = tower.damage;
    // Use a circle for bullet visuals
    bullet.displayWidth = 8;
    bullet.displayHeight = 8;
    bullet.setVisible(false); // Hide default sprite
    // Draw bullet manually in update
}

// Draw bullets manually
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
