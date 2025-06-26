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
    "CitizenPlush.png":    { speed: 1.0, health: 2 },
    "CobaltGuardLunar.png":{ speed: 1.5, health: 1 },
    "ExecutionerPlush.png":{ speed: 0.8, health: 4 },
    "GhostLunar.png":      { speed: 1.8, health: 1 },
    "KnightLunar.png":     { speed: 1.2, health: 3 },
    "LO_Marionette.png":   { speed: 1.1, health: 2 },
    "ReaperAct2_refreshed.png": { speed: 1.3, health: 2 },
    "SinRealtdsnobackground.png": { speed: 1.6, health: 1 }
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
}

function update() {
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

function placeTower(x, y) {
    // Prevent placing on the ball
    let dx = x - ball.x;
    let dy = y - ball.y;
    if (Math.sqrt(dx * dx + dy * dy) < ballSize) return;
    let asset = TOWER_ASSETS[selectedTowerIndex];
    let tower = this.add.sprite(x, y, asset);
    tower.setDisplaySize(48, 48);
    towers.add(tower);
}

function gameOver() {
    this.add.text(WIDTH / 2 - 80, HEIGHT / 2, "Game Over!", { fontSize: '32px', fill: '#ff0000' });
    this.scene.pause();
}
