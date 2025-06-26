let WIDTH = 600;
let HEIGHT = 600;

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
let yspeed = 0.5;
let xspeed = 1.0;
let cursors;
let wKey, aKey, sKey, dKey;

function preload() {
    this.load.image("ball", "assets/ball.png"); // watch out for case sensitivity
}

function create() {
    ball = this.add.sprite(WIDTH / 2, HEIGHT / 2, "ball"); // x, y, and the ball "key"
    ball.setDisplaySize(ballSize, ballSize); // width, height
    // Add WASD keys
    wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    aKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
}

function update() {
    // Ball movement with WASD
    let moveSpeed = 4;
    if (wKey.isDown) {
        ball.y -= moveSpeed;
    }
    if (sKey.isDown) {
        ball.y += moveSpeed;
    }
    if (aKey.isDown) {
        ball.x -= moveSpeed;
    }
    if (dKey.isDown) {
        ball.x += moveSpeed;
    }

    // Keep bouncing logic
    ball.y += yspeed;
    ball.x += xspeed;

    if (ball.y >= HEIGHT - ballSize / 2 || ball.y <= ballSize / 2) {
        yspeed *= -1;
    }
    if (ball.x >= WIDTH - ballSize / 2 || ball.x <= ballSize / 2) {
        xspeed *= -1;
    }
}
