canvas = document.getElementById("canvas")
canvas.focus()
c = canvas.getContext("2d")

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const H = canvas.height;
const W = canvas.width;
var mouseX = 0;
var mouseY = 0;
var mouseDown = false;
var justClicked = false;
var currentShape = "";

var mouseShape = [];
var modelMain;
var up = false;
var down = false;
var right = false;
var left = false;
var spell = "";
var readyToSave = false;
var playing = false;
loadModel();
const dist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const divide = (f, e0, e1, iter) => {
    for (let i = 0; i < iter; i++) {
        let mid = (e0 + e1) / 2;
        if (f(mid) * f(e0) > 0) {
            e0 = mid;
        }
        else e1 = mid;
    }
    return e0
}
const toNum = (d, n) => {
    const l = [];
    for (let i = 0; i < n; i++) {
        l.push((d == i) ? 1 : 0);
    }
    return l
}
async function loadModel() {
    modelMain = await tf.loadLayersModel('./shapeClass/shapeClass.json');
    console.log("Model Loaded!");
}
function predict(shape) {
    if (shape.length > 3) {

        let possibleShapes = ["jump", "force", "attack"];
        return tf.tidy(() => {
            let regShape = regularizeShape(makeMLShape(shape));
            let readyToTensorize = toMLInput(regShape);
            const shapeTensor3d = tf.tensor(readyToTensorize);
            const shapeTensor = shapeTensor3d.reshape([1, 38]);
            const prediction = modelMain.predict(shapeTensor);
            let answer = prediction.argMax(-1).dataSync()[0];
            const confidence = prediction.max().dataSync()[0];
            return possibleShapes[answer];
        });
    }
    return "";
}
function regularizeShape(shape, rotateAndDilate = true) {
    let v = shape[0];
    let newShape = [];

    //translate shape so that shape[0] is (0, 0)
    for (let i = 0; i < shape.length; i++) {

        newShape.push({ x: shape[i].x - v.x, y: shape[i].y - v.y });
    }
    if (rotateAndDilate) {
        //finds point of max distance
        let maxD = 0;
        let index = 0;
        for (let i = 1; i < newShape.length; i++) {
            let d = newShape[i].x ** 2 + newShape[i].y ** 2
            if (d > maxD) {
                maxD = d;
                index = i;
            }
        }

        //finds angle and magnitude
        let mag = 1 / Math.sqrt(maxD);
        let ang = -1 * Math.atan2(newShape[index].y, newShape[index].x);
        newShape = transformShape(newShape, ang, mag);
    }

    return newShape;

}
function transformShape(shape, ang = 0, dilationCon = 1) {
    let a = Math.cos(ang) * dilationCon;
    let b = Math.sin(ang) * dilationCon;
    const mat = tf.tensor([[a, -b], [b, a]])
    let newShape = [];
    for (let i = 0; i < shape.length; i++) {
        tf.tidy(() => {
            const v = tf.tensor([shape[i].x, shape[i].y], [2, 1])
            const result = mat.matMul(v);
            let data = result.dataSync();
            newShape.push({ x: data[0], y: data[1] });
        });
    }
    mat.dispose();
    return newShape;
}
function makeMLShape(shape) {
    let newShape = [];
    for (let i = 0; i < 20; i++) {
        let t = Math.floor((shape.length - 1) * i / 20);
        if (t == shape.length) {
            t--;
        }
        let r = (shape.length * i / 20) % 1;
        let x = (1 - r) * shape[t].x + r * shape[t + 1].x;
        let y = (1 - r) * shape[t].y + r * shape[t + 1].y;
        newShape.push({ x: x, y: y });
    }
    return newShape;
}
function toMLInput(shape) {
    //changes shape from a dictionary in a list to a tensor
    const arrayShape = [];
    for (let i = 1; i < shape.length; i++) {
        arrayShape.push([shape[i].x, shape[i].y]);
    }
    return arrayShape
}
function getMouseShape() {
    return mouseShape;
}
const doMouseStuff = () => {
    if (playing)
    {
        if (mouseDown) {
            if (justClicked) {
                justClicked = false;
            }
            if (mouseShape.length == 0 ||
                (mouseShape[mouseShape.length - 1].x != mouseX
                    || mouseShape[mouseShape.length - 1].y != mouseY)) {
                mouseShape.push({ x: mouseX, y: mouseY });
            }
    
        }
        else {
            if (justClicked) {
                spell = predict(mouseShape);
                mouseShape = [];
                justClicked = false;
    
            }
    
        }
    }

}
const mouse = function (event) {
    if (event.type === "mousedown") {
        mouseDown = true;
        mouseX = event.x;
        mouseY = event.y;
        justClicked = true;
    }
    else if (event.type === "mouseup") {
        mouseDown = false;
        mouseX = event.x;
        mouseY = event.y;
        justClicked = true;
    }
    else {
        mouseX = event.x;
        mouseY = event.y;
    }
}
const displayShape = (shape) => {
    if (shape.length > 0) {
        c.beginPath();
        c.moveTo(shape[0].x, shape[0].y)
        for (let i = 0; i < shape.length; i++) {
            c.lineTo(shape[i].x, shape[i].y)
        }
        c.stroke();
    }

}
function getHumanPlayerUpdate(me, bot) {
    return (state) => {
        let tX = W / 2 - me.x;
        let tY = H / 2 - me.y + me.velY / 2;
        c.fillStyle = "#000000";
        c.fillRect(0, 0, W, H);
        for (const p of state.players) {
            if (p == me) c.fillStyle = "green"
            else c.fillStyle = "purple"

            c.beginPath();
            c.moveTo(p.x + p.r + tX, p.y + tY);
            c.arc(p.x + tX, p.y + tY, p.r, 0, 6.29);
            c.fill();
            let green = Math.floor(p.health / 100 * 255);
            let red = 255 - green;
            green = green.toString(16);
            red = red.toString(16);
            if (green.length < 2)
                green = "0" + green
            if (red.length < 2)
                red = "0" + red;
            c.fillStyle = "#" + red + green + "00"
            c.fillRect(p.x - 25 + tX, p.y - 20 + tY - p.r, p.health / 2, 5);
        }
        c.strokeStyle = "#FFFFFF";
        for (const p of state.platforms) {
            c.beginPath();
            c.moveTo(p.x + tX, p.y + tY);
            if (p.isVertical)
                c.lineTo(p.x + tX, p.y + p.length + tY);
            else
                c.lineTo(p.x + p.length + tX, p.y + tY);
            c.stroke();
        }
        /*
        c.font = "30px Arial"
        c.fillStyle = (up) ? "#FFFFFF" : "#000000";
        c.fillRect(100, H - 133, 40, 40);
        c.fillStyle = (!up) ? "#FFFFFF" : "#000000";
        c.fillText("W", 105, H - 100);
        c.fillStyle = (right) ? "#FFFFFF" : "#000000";
        c.fillRect(140, H - 83, 40, 40);
        c.fillStyle = (!right) ? "#FFFFFF" : "#000000";
        c.fillText("D", 149, H - 50);
        c.fillStyle = (left) ? "#FFFFFF" : "#000000";
        c.fillRect(60, H - 83, 40, 40);
        c.fillStyle = (!left) ? "#FFFFFF" : "#000000";
        c.fillText("A", 69, H - 50);
        */
        displayShape(mouseShape);
        for (const s of state.spells) {
            c.fillStyle = s.color;
            c.beginPath();
            c.moveTo(s.x + tX + 5, s.y + tY);
            c.arc(s.x + tX, s.y + tY, 5, 0, 6.29);
            c.fill();
        }
        let ang = Math.atan2(bot.y - me.y - 20, bot.x - me.x);
        let ret = { up: up, down: down, left: left, right: right, spell: spell, ang: ang };
        spell = "";
        return ret;
    }
}
class Player {
    constructor(obj) {
        this.x = obj.x;
        this.y = obj.y;
        this.r = obj.r;
        this.friction = obj.friction;
        //this.getInput = obj.getInput; //initialize with seperate method
        this.velX = 0;
        this.velY = 0;
        this.touching = [];
        //format {up:_, down:_, right:_, left:_} where _ is false or a coordinate
        this.touchingDown = false;
        this.touchingEnds = []; //format {x:_, y:_}
        this.effects = []; //add functions that take in player and do something to them
        this.health = 100;
        this.spellToCast = "";
        this.spellAng = 0;
        this.spellCoolDown = 0;
        this.canDoubleJump = true;
    }
    update(externalForces, state) {
        let inputs = this.getInput(state);
        if (inputs.spell) {
            this.spellToCast = inputs.spell;
            this.spellAng = inputs.ang;
        }
        if (this.touchingDown) {
            this.spellCoolDown--;
        }

        if (this.spellToCast != "" && this.spellCoolDown < 1) {
            this.castSpell(state);
        }
        this.velX += externalForces.x;
        this.velY += externalForces.y;

        let input = this.inputToForce(inputs);
        this.velX += input.x;
        this.velY += input.y;
        this.velX *= this.friction;
        this.velY *= this.friction;
        this.x += this.velX;
        this.y += this.velY;
        this.getTouching(state.platforms);
        this.doCollisions();
        this.getEnds(state.ends);
        this.doEndCollision();
        return inputs;

    }
    setUpdateFunction(updateFunc) {
        this.getInput = updateFunc;
    }

    inputToForce(inputs) {
        let ret = {
            x: 0,
            y: 0
        }
        if (this.touchingDown) {
            if (inputs.up) {
                ret.y -= 25;
            }
        }
        if (inputs.down) {
            ret.y += 0.5;
        }
        if (inputs.right) {
            ret.x += 0.5;
        }
        if (inputs.left) {
            ret.x -= 0.5;
        }
        return ret;
    }

    getTouching(platforms) {
        this.touching = [];
        for (const p of platforms) {
            if (p.isVertical) {
                if (Math.abs(this.y - p.y - p.length / 2) < p.length / 2 && //right y
                    Math.abs(p.x - this.x) < this.r) //right x
                {
                    if (this.velX > 0)
                        this.touching.push({
                            up: false, down: false, left: false, right: p.x
                        });
                    else
                        this.touching.push({
                            up: false, down: false, left: p.x, right: false
                        });
                }
            }
            else {
                if (Math.abs(this.x - p.x - p.length / 2) < p.length / 2 && //right x
                    Math.abs(p.y - this.y) < this.r) //right y
                {
                    if (this.velY >= 0)
                        this.touching.push({
                            up: false, down: p.y, left: false, right: false
                        });
                    else
                        this.touching.push({
                            up: p.y, down: false, left: false, right: false
                        });
                }
            }
        }
        this.touchingDown = false;
        for (const intersection of this.touching) {
            if (intersection.down != false) {
                this.touchingDown = true;
                this.canDoubleJump = true;
                break;
            }
        }
    }
    doCollisions() {
        //add hit top
        for (const i of this.touching) {
            if (i.up != false) {
                this.velY = Math.max(0, this.velY);
                this.y = i.up + this.r;
            }
            if (i.down != false) {
                this.velY = Math.min(0, this.velY);
                this.y = i.down - this.r;
            }
            if (i.left != false) {
                this.velX = Math.max(0, this.velX);
                this.x = i.left + this.r;
            }
            if (i.right != false) {
                this.velX = Math.min(0, this.velX);
                this.x = i.right - this.r;
            }
        }
    }
    getEnds(ends) {
        this.touchingEnds = [];
        for (const e of ends) {
            if (dist(this, e) < this.r * this.r) {
                this.touchingEnds.push({ x: e.x, y: e.y });
            }
        }
    }
    doEndCollision() {
        if (this.touchingEnds.length > 0) {
            this.touchingDown = true;
            this.canDoubleJump = false;
            let e = this.touchingEnds[0];
            let xO = this.x - this.velX - e.x;
            let yO = this.y - this.velY - e.y;
            let xN = this.x - e.x;
            let yN = this.y - e.y;
            let slope = (yN - yO) / (xN - xO);

            //figure out where the collision happened
            let f = (x) => x * x + (yO + slope * (x - xO)) ** 2 - this.r ** 2;
            let xI = divide(f, Math.min(xO, xN), Math.max(xO, xN), 10)
            let yI = slope * (xI - xO) + yO;
            this.x = xI + e.x;
            this.y = yI + e.y;

            //update velX, velY so normal to circle

            //first, change coordiate basis to par/perp
            let perp = this.velX * xI + this.velY * yI;
            perp /= this.r;
            let xPerp = xI / this.r;
            let yPerp = yI / this.r;

            //adjust velX, velY
            let adjustPerp = Math.max(0, - perp);
            let xAd = adjustPerp * xPerp;
            let yAd = adjustPerp * yPerp;
            this.velX += xAd;
            this.velY += yAd;

        }
    }
    castSpell(state) {
        if (this.spellToCast == "jump") {
            if (!this.canDoubleJump) {
                return;
            }
            this.canDoubleJump = false;
            this.touchingDown = true;
            this.velY = 0;
        }
        if (this.spellToCast == "force") {
            state.spells.push(new Spell({
                x: this.x, y: this.y, vel: 20, caster: this, r: 30,
                ang: this.spellAng, onHit: (p) => {
                    p.velX += 30 * Math.cos(this.spellAng);
                    p.velY += 10 * Math.sin(this.spellAng)
                },
                color: "#ADD8E6"
            }, state));
        }
        if (this.spellToCast == "attack") {
            state.spells.push(new Spell({
                x: this.x, y: this.y, vel: 20, caster: this, r: 20,
                ang: this.spellAng, onHit: (p) => { p.health -= 30; },
                color: "#FF0000"
            }, state));
        }
        this.spellCoolDown = 30;
        this.spellToCast = "";
    }

}
class Spell {
    constructor(obj, state) {
        this.x = obj.x;
        this.y = obj.y;
        this.vel = obj.vel;
        this.xBasis = Math.cos(obj.ang);
        this.yBasis = Math.sin(obj.ang);
        this.onHit = obj.onHit;
        this.caster = obj.caster;
        this.r = obj.r;
        this.color = obj.color;
        this.findPathEnd(state);
    }

    update(state) {
        let toDelete = false;
        //move
        let oldX = this.x;
        let oldY = this.y;
        this.x += this.vel * this.xBasis;
        this.y += this.vel * this.yBasis;

        if ((oldX > this.maxX) != (this.x > this.maxX)) {
            this.x = this.maxX;
            this.y = this.maxY;
            toDelete = true;
        }

        //for each player:
        //find distances of player perpendicular and paralell to angle
        //if perpendicular distance < 20 and parallel distance where was recently
        //hit player
        for (const p of state.players) {
            if (p != this.caster) {
                let dX = p.x - this.x;
                let dY = p.y - this.y;

                let dPar = dX * this.xBasis + dY * this.yBasis;
                let dPerp = -dX * this.yBasis + dY * this.xBasis;

                if (dPar <= p.r && dPar >= -p.r-Math.sqrt(dist({ x: oldX, y: oldY }, this))
                    && Math.abs(dPerp) < this.r + p.r) {
                    this.onHit(p);
                    this.delete(state);
                    return;
                }

            }
        }
        if (toDelete)
            this.delete(state);
    }

    delete(state) {
        state.spellsToDelete.push(state.spells.indexOf(this));
    }

    findPathEnd(state) {
        let stepMin = 1000; //number of steps the spell will go without obstacles
        for (const p of state.platforms) {
            if (p.isVertical) {
                let steps = (p.x - this.x) / this.xBasis;
                if (steps > 0) { //in front of spell
                    let yHit = steps * this.yBasis + this.y - p.y;
                    if (yHit > 0 && yHit < p.length) //actually hits wall
                    {
                        if (steps < stepMin) {
                            stepMin = steps;
                        }
                    }
                }
            }
            else {
                let steps = (p.y - this.y) / this.yBasis;
                if (steps > 0) { //in front of spell
                    let xHit = steps * this.xBasis + this.x - p.x;
                    if (xHit > 0 && xHit < p.length) //actually hits wall
                    {
                        if (steps < stepMin) {
                            stepMin = steps;
                        }
                    }
                }
            }
        }

        this.maxX = this.x + this.xBasis * stepMin;
        this.maxY = this.y + this.yBasis * stepMin;
    }
}
async function loadBotModels(moveString, spellString) {
    const move = await tf.loadLayersModel(moveString);
    const spell = await tf.loadLayersModel(spellString);
    const opt1 = tf.train.adam();
    move.compile({
        optimizer: opt1,
        loss: tf.metrics.categoricalCrossentropy
    });
    const opt2 = tf.train.adam();
    spell.compile({
        optimizer: opt2,
        loss: tf.metrics.categoricalCrossentropy
    });
    return [move, spell];
}
function createBotModel() {
    const move = tf.sequential();
    move.add(tf.layers.dense({ inputShape: [27], units: 50, activation: "relu" }));
    move.add(tf.layers.dense({ units: 50, activation: "relu" }));
    move.add(tf.layers.dense({ units: 6, activation: "softmax" }));

    const opt1 = tf.train.adam();
    move.compile({
        optimizer: opt1,
        loss: tf.metrics.categoricalCrossentropy
    });

    const spell = tf.sequential();
    spell.add(tf.layers.dense({ inputShape: [27], units: 50, activation: "relu" }));
    spell.add(tf.layers.dense({ units: 50, activation: "relu" }));
    spell.add(tf.layers.dense({ units: 4, activation: "softmax" }));
    const opt2 = tf.train.adam();
    spell.compile({
        optimizer: opt2,
        loss: tf.metrics.categoricalCrossentropy
    });
    return [move, spell]
}
function stateToTensor(firstPlayer, opponent, platforms, spells) {
    let l = [];
    for (let i = 0; i < 12; i++) {
        let ang = 2 * Math.PI / i;
        let xBasis = Math.cos(ang);
        let yBasis = Math.sin(ang);
        let stepMin = 1000;
        for (const p of platforms) {
            if (p.isVertical) {
                let steps = (p.x - firstPlayer.x) / xBasis;
                if (steps > 0) { //in front of spell
                    let yHit = steps * yBasis + firstPlayer.y - p.y;
                    if (yHit > 0 && yHit < p.length) //actually hits wall
                    {
                        if (steps < stepMin) {
                            stepMin = steps;
                        }
                    }
                }
            }
            else {
                let steps = (p.y - firstPlayer.y) / yBasis;
                if (steps > 0) { //in front of spell
                    let xHit = steps * xBasis + firstPlayer.x - p.x;
                    if (xHit > 0 && xHit < p.length) //actually hits wall
                    {
                        if (steps < stepMin) {
                            stepMin = steps;
                        }
                    }
                }
            }
        }
        l.push(20 / Math.max(20, stepMin));
    }
    if (spells.length > 0) {
        let closestSpell = spells[0];
        let dMin = dist(spells[0], firstPlayer);
        for (const s of spells) {
            if (dist(s, firstPlayer) < dMin) {
                dMin = dist(s, firstPlayer);
                closestSpell = s;
            }
        }
        l.push(closestSpell.xBasis);
        l.push(closestSpell.yBasis);
        l.push(20 * (closestSpell.x - firstPlayer.x) / Math.min(400, dMin));
        l.push(20 * (closestSpell.y - firstPlayer.y) / Math.min(400, dMin));
        l.push(closestSpell.color == "#FF0000");
    }
    else {
        l.push(0);
        l.push(0);
        l.push(0);
        l.push(0);
        l.push(0);
    }
    if (dist(firstPlayer, opponent) > 400) {
        l.push(20 * (opponent.x - firstPlayer.x) / dist(firstPlayer, opponent));
        l.push(20 * (opponent.y - firstPlayer.y) / dist(firstPlayer, opponent));
    }
    else {
        let ang = Math.atan2((opponent.y - firstPlayer.y), (opponent.x - firstPlayer.x));
        l.push(Math.cos(ang));
        l.push(Math.sin(ang));
    }
    l.push(opponent.velX / 5);
    l.push(opponent.velY / 5);
    l.push(firstPlayer.velX / 5);
    l.push(firstPlayer.velY / 5);
    l.push(firstPlayer.spellCoolDown / 30);
    l.push(opponent.spellCoolDown / 30);
    l.push(firstPlayer.health / 100);
    l.push(opponent.health / 100);
    l = l.map(d => (Number.isNaN(d) ? 1 : d));
    return tf.tensor([l]);
}
function getModelUpdate(modelMove, modelSpell, modelPlayer) {
    const updateFunc = (state) => {
        let otherPlayer;
        for (const p of state.players) {
            if (p != modelPlayer) {
                otherPlayer = p;
                break;
            }
        }
        const s = stateToTensor(modelPlayer, otherPlayer, state.platforms, state.spells);
        const movementNum = modelMove.predict(s).argMax(-1).dataSync()[0];
        const spellNum = modelSpell.predict(s).argMax(-1).dataSync()[0];
        let up = false;
        let right = false;
        let left = false;
        let spell = "";
        switch (movementNum) {
            case 0: //none

                break;
            case 1: //up
                up = true;
                break;
            case 2: //right
                right = true;
                break;
            case 3: //left
                left = true;
                break;
            case 4: //up, right
                up = true;
                right = true;
                break;
            case 5: //up, left
                up = true;
                left = true;
                break;

        }
        switch (spellNum) {
            case 0://none

                break;
            case 1:
                spell = "jump"
                break;
            case 2:
                spell = "force"
                break;
            case 3:
                spell = "attack"
                break;
        }
        let ang = Math.atan2(otherPlayer.y - modelPlayer.y - 20, otherPlayer.x - modelPlayer.x);
        let ret = {
            up: up, down: false, left: left,
            right: right, spell: spell, ang: ang
        }
        return ret;
    }

    return updateFunc;
}
function getSimplePlayerUpdate(simple)
{
    return (state) =>
    {
        let otherPlayer;
        for (const p of state.players)
        {
            if (p != simple)
            {
                otherPlayer = p;
                break;
            }
        }
        let ang = Math.atan2(otherPlayer.y - simple.y, otherPlayer.x - simple.x);
        let ret = {up: simple.velX == 0 || otherPlayer.y < simple.y, down: false, left: otherPlayer.x < simple.x,
            right: otherPlayer.x > simple.x, spell: "attack", ang: ang}
        return ret;
    }
}
function doTimestep(state, bot, human) {
    human.update({ x: 0, y: 2 }, state);
    bot.update({ x: 0, y: 2 }, state);
    for (const s of state.spells) {
        s.update(state);
    }
    state.spellsToDelete.sort((a, b) => b - a);
    for (const s of state.spellsToDelete) {
        state.spells.splice(s, 1);
    }
    state.spellsToDelete = [];
    let winner = 0;
    for (let i = 0; i < state.players.length; i++) {
        const p = state.players[i];
        if (p.health < 0 || p.y > 100) {
            winner += i + 1;
        }
    }
    return winner;
}
function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function doUntilDone(f, time)
{
    let output = 0;
    while (output == 0)
    {
        let startTime = new Date().getTime();
        output = f();
        await timeout(time - new Date().getTime() + startTime);
    }
    return output
}
async function doBattle(botMove, botSpell, switchPos) {
    const human = new Player({
        x: 200 + 1200 * switchPos,
        y: - 100,
        r: 15,
        friction: 0.95,
    });
    const bot = new Player({
        x: 1400 - 1200 * switchPos,
        y: - 100,
        r: 15,
        friction: 0.95,
    });
    human.setUpdateFunction(getHumanPlayerUpdate(human, bot));
    bot.setUpdateFunction(getModelUpdate(botMove, botSpell, bot));
    const state = {
        players: [human, bot],
        platforms: [
            { x: 100, y: 1, length: 1400, isVertical: false },
            { x: 1, y: -500, length: 400, isVertical: true },
            { x: 1, y: -100, length: 100, isVertical: false },
            { x: 100, y: -200, length: 100, isVertical: false },
            { x: 1, y: -300, length: 50, isVertical: false },
            { x: 200, y: -300, length: 200, isVertical: false },
            { x: 400, y: -350, length: 50, isVertical: true },
            { x: 500, y: -300, length: 200, isVertical: false },
            { x: 900, y: -300, length: 200, isVertical: false },
            { x: 1200, y: -350, length: 50, isVertical: true },
            { x: 1200, y: -300, length: 200, isVertical: false },
            { x: 1600, y: -500, length: 400, isVertical: true },
            { x: 1500, y: -100, length: 100, isVertical: false },
            { x: 1400, y: -200, length: 100, isVertical: false },
            { x: 1550, y: -300, length: 50, isVertical: false }
        ],
        spells: [],
        ends: [],
        spellsToDelete: []
    };
    for (const p of state.platforms) {
        state.ends.push({ x: p.x, y: p.y });
        state.ends.push({
            x: p.x + (1 - p.isVertical) * p.length,
            y: p.y + p.isVertical * p.length
        });
    }
    return await doUntilDone(() => doTimestep(state, bot, human), 30);
}
async function doBattleSimple()
{
    const human = new Player({
        x: 200,
        y: - 100,
        r: 15,
        friction: 0.95,
    });
    const bot = new Player({
        x: 1400,
        y: - 100,
        r: 15,
        friction: 0.95,
    });
    human.setUpdateFunction(getHumanPlayerUpdate(human, bot));
    bot.setUpdateFunction(getSimplePlayerUpdate(bot));

    const state = {
        players: [human, bot],
        platforms: [
            { x: 100, y: 1, length: 1400, isVertical: false },
            { x: 1, y: -500, length: 400, isVertical: true },
            { x: 1, y: -100, length: 100, isVertical: false },
            { x: 100, y: -200, length: 100, isVertical: false },
            { x: 1, y: -300, length: 50, isVertical: false },
            { x: 200, y: -300, length: 200, isVertical: false },
            { x: 400, y: -350, length: 50, isVertical: true },
            { x: 500, y: -300, length: 200, isVertical: false },
            { x: 900, y: -300, length: 200, isVertical: false },
            { x: 1200, y: -350, length: 50, isVertical: true },
            { x: 1200, y: -300, length: 200, isVertical: false },
            { x: 1600, y: -500, length: 400, isVertical: true },
            { x: 1500, y: -100, length: 100, isVertical: false },
            { x: 1400, y: -200, length: 100, isVertical: false },
            { x: 1550, y: -300, length: 50, isVertical: false }
        ],
        spells: [],
        ends: [],
        spellsToDelete: []
    };
    for (const p of state.platforms) {
        state.ends.push({ x: p.x, y: p.y });
        state.ends.push({
            x: p.x + (1 - p.isVertical) * p.length,
            y: p.y + p.isVertical * p.length
        });
    }
    for (const s of state.spells) {
        s.findPathEnd(state);
    }
    return await doUntilDone(() => doTimestep(state, bot, human), 30);
}
async function doMenu(display)
{
    return await doUntilDone(display, 30);
}
function button(x, y, w, h)
{
    c.beginPath();
    c.moveTo(x + h / 2, y + h);
    c.arc(x + h / 2, y + h / 2, h / 2, Math.PI / 2, 3 * Math.PI / 2);
    c.lineTo(x + w - h / 2, y);
    c.arc(x + w - h / 2, y + h / 2, h / 2, 3 * Math.PI / 2, 5 * Math.PI / 2);
    c.lineTo(x + h / 2, y + h);
    c.stroke()

}
function overButton(x, y, w, h)
{
    if (mouseX > x + h / 2 && mouseX < x - h / 2 + w && mouseY > y && mouseY < y + h)
        return true;
    if (dist({x: x + h / 2, y: y + h / 2}, {x: mouseX, y: mouseY}) < h * h / 4)
        return true;
    if (dist({x: x + w - h / 2, y: y + h / 2}, {x: mouseX, y: mouseY}) < h * h / 4)
        return true;
    return false
    
}
function wrapText(text, x, y, maxLength, offset)
{
    let textSoFar = "";
    let lineCount = 0;
    let textList = text.split(" ");
    for (let i = 0; i < textList.length; i ++)
    {
        let testText;
        if (textSoFar)
            testText = textSoFar + " " + textList[i];
        else
            testText = textList[i];
        if (c.measureText(testText).width < maxLength)
            textSoFar = testText;
        else
        {
            c.fillText(textSoFar, x, y + lineCount * offset);
            textSoFar = textList[i];
            lineCount ++;
        }
    }
    c.fillText(textSoFar, x, y + lineCount * offset);
    return y + (lineCount + 1) * offset;

}
function playMenu()
{
    //0 -> go on
    //1 -> go back
    //3 -> main
    //4 -> imitator
    //5 -> simple
    c.fillStyle = "#000000";
    c.strokeStyle = "#FFFFFF";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#FFFFFF";
    let middle = W * 0.37;
    c.font = "150px Tahoma";
    c.fillText("Play", middle - 130, H / 4);

    //back button
    button(50, 50, 100, 50);
    c.font = "30px Tahoma";
    c.fillText("Back", 68, 85)
    if (overButton(50, 50, 100, 50) && mouseDown)
    {
        return 1;
    }

    //buttons
    let buttonWidth = 300;
    let buttonHeight = 100;
    let bottomHeight = 10 * H / 13;
    c.font = "45px Tahoma";
    button(middle - buttonWidth / 2, H / 3, buttonWidth, buttonHeight);
    button(middle - buttonWidth / 2, bottomHeight / 2 + H / 6, buttonWidth, buttonHeight);
    button(middle - buttonWidth / 2, bottomHeight, buttonWidth, buttonHeight);

    //button text
    c.fillText("Main", middle - c.measureText("Main").width / 2, H / 3 + 66);
    c.fillText("Imitator", middle - c.measureText("Imitator").width / 2, bottomHeight / 2 + H / 6 + 66);
    c.fillText("Simple", middle - c.measureText("Simple").width / 2, bottomHeight + 66);

    //info box test
    let text = "Mouse over a button to get information."
    if (overButton(middle - buttonWidth / 2, H / 3, buttonWidth, buttonHeight))
    {
        if (mouseDown)
            return 3;
        text = "Play against a neural network trained through self-play to play this game." + 
            " Making this was one of the main goals of my project, hence its name.";
    }
    if (overButton(middle - buttonWidth / 2, bottomHeight / 2 + H / 6, buttonWidth, buttonHeight))
    {
        if (mouseDown)
            return 4;
        text = "This neural network was trained to imitate me by playing against me many times.";
    }
    if (overButton(middle - buttonWidth / 2, bottomHeight, buttonWidth, buttonHeight))
    {
        if (mouseDown)
            return 5;
        text = "This follows the simplest strategy imaginable: go towards and attack." + 
        " I made it while initially testing my game.";
    }

    //info box
    let boxR = 50;
    let boxTop = H / 6
    let boxBottom = 5 * H / 6;
    let boxLeft = 2 * W / 3;
    let boxRight = 19 * W / 20;
    c.beginPath();
    c.moveTo(boxLeft + boxR, boxTop);
    c.arc(boxLeft + boxR, boxTop + boxR, boxR, 3 * Math.PI / 2, Math.PI, true);
    c.lineTo(boxLeft, boxBottom - boxR);
    c.arc(boxLeft + boxR, boxBottom - boxR, boxR, Math.PI, Math.PI / 2, true);
    c.lineTo(boxRight - boxR, boxBottom);
    c.arc(boxRight - boxR, boxBottom - boxR, boxR, Math.PI / 2, 0, true);
    c.lineTo(boxRight, boxTop + boxR);
    c.arc(boxRight - boxR, boxTop + boxR, boxR, 0, 3 * Math.PI / 2, true);
    c.lineTo(boxLeft + boxR, boxTop);
    c.stroke();

    
    c.fillText("Info", boxRight / 2 + boxLeft / 2 - 30, boxTop + 50);
    c.font = "30px Tahoma";
    wrapText(text, boxLeft + 30, boxTop + 100, boxRight - boxLeft - 60, 40);
    return 0;
}
function mainMenu()
{
    c.fillStyle = "#000000";
    c.strokeStyle = "#FFFFFF";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#FFFFFF";
    let middle = W / 2;
    c.font = "150px Tahoma";
    c.fillText("NeuraI", middle - c.measureText("NeuraI").width / 2, H / 4);

    let buttonWidth = 400;
    c.font = "80px Tahoma";
    button(middle - buttonWidth / 2, H / 2, buttonWidth, 100);
    button(middle - buttonWidth / 2, 3 * H / 4, buttonWidth, 100);

    c.fillText("Play", middle - c.measureText("Play").width / 2, H / 2 + 73);
    c.font = "70px Tahoma";
    c.fillText("Help/About", middle - c.measureText("Help/About").width / 2, 3 * H / 4 + 75);
    if (overButton(middle - buttonWidth / 2, H / 2, buttonWidth, 100) && mouseDown)
    {
        return 2;
    }
    if (overButton(middle - buttonWidth / 2, 3 * H / 4, buttonWidth, 100) && mouseDown)
    {
        return 6;
        
    }

    return 0;
}
function aboutMenu()
{
    c.fillStyle = "#000000";
    c.strokeStyle = "#FFFFFF";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#FFFFFF";
    let middle = 7 * W / 24;
    c.font = "150px Tahoma";
    c.fillText("About", 17 * W / 24 - c.measureText("About").width / 2 + 5, H / 4);
    c.fillText("Help", 7 * W / 24 - c.measureText("Help").width / 2 + 5, H / 4)

    //back button
    button(50, 50, 100, 50);
    c.font = "30px Tahoma";
    c.fillText("Back", 68, 85)
    if (overButton(50, 50, 100, 50) && mouseDown)
    {
        return 1;
    }

    //box
    let boxR = 50;
    let boxTop = H / 3
    let boxBottom = 5 * H / 6;
    let boxLeft = 7 * W / 12;
    let boxRight = 5 * W / 6;
    c.beginPath();
    c.moveTo(boxLeft + boxR, boxTop);
    c.arc(boxLeft + boxR, boxTop + boxR, boxR, 3 * Math.PI / 2, Math.PI, true);
    c.lineTo(boxLeft, boxBottom - boxR);
    c.arc(boxLeft + boxR, boxBottom - boxR, boxR, Math.PI, Math.PI / 2, true);
    c.lineTo(boxRight - boxR, boxBottom);
    c.arc(boxRight - boxR, boxBottom - boxR, boxR, Math.PI / 2, 0, true);
    c.lineTo(boxRight, boxTop + boxR);
    c.arc(boxRight - boxR, boxTop + boxR, boxR, 0, 3 * Math.PI / 2, true);
    c.lineTo(boxLeft + boxR, boxTop);
    c.stroke();

    const textAbout = "NeuraI stands for \"NeuraI excessively uses real artificial intelligence\". AI is used to figure out what shape you draw " + 
        "as well as to control the first two opponents seen on the play screen.";

    wrapText(textAbout, boxLeft + 30, boxTop + 50, boxRight - boxLeft - 60, 40);
    boxTop = H / 3
    boxBottom = 5 * H / 6;
    boxLeft = W / 6;
    boxRight = 5 * W / 12;
    c.beginPath();
    c.moveTo(boxLeft + boxR, boxTop);
    c.arc(boxLeft + boxR, boxTop + boxR, boxR, 3 * Math.PI / 2, Math.PI, true);
    c.lineTo(boxLeft, boxBottom - boxR);
    c.arc(boxLeft + boxR, boxBottom - boxR, boxR, Math.PI, Math.PI / 2, true);
    c.lineTo(boxRight - boxR, boxBottom);
    c.arc(boxRight - boxR, boxBottom - boxR, boxR, Math.PI / 2, 0, true);
    c.lineTo(boxRight, boxTop + boxR);
    c.arc(boxRight - boxR, boxTop + boxR, boxR, 0, 3 * Math.PI / 2, true);
    c.lineTo(boxLeft + boxR, boxTop);
    c.stroke();
    let bottomOfText1 = wrapText("WASD to move", boxLeft + 30, boxTop + 50, boxRight - boxLeft - 60, 40);
    bottomOfText1 = wrapText("Draw a lightning bolt to cast a damage spell.", boxLeft + 30, bottomOfText1 + 20, boxRight - boxLeft - 60, 40);
    bottomOfText1 = wrapText("Draw a triangle to cast a push spell.", boxLeft + 30, bottomOfText1 + 20, boxRight - boxLeft - 60, 40);
    bottomOfText1 = wrapText("Draw a line to double jump.", boxLeft + 30, bottomOfText1 + 20, boxRight - boxLeft - 60, 40);
    return 0;

}
function afterGameMenu(currentState)
{
    return () => {
        if (overButton(W / 3 - 100, 2 * H / 3, 200, 80) && mouseDown)
            return currentState;
        if (overButton(2 * W / 3 - 100, 2 * H / 3, 200, 80) && mouseDown)
            return 2;
        return 0
    }
}
function transition()
{
    return 1 - mouseDown;
}
async function run() {
    let currentDisplay = 1;

    let mainBotsLoaded = false;
    let mainBotMove;
    let mainBotSpell;

    let imitatorBotsLoaded = false;
    let imitatorMove;
    let imitatorSpell;

    let result;
    while (true)
    {
        await doMenu(transition);
        switch (currentDisplay){
            case 1:
                currentDisplay = await doMenu(mainMenu);
                break;
            case 2:
                currentDisplay = await doMenu(playMenu);
                break;
            case 3:
                playing = true;
                if (!mainBotsLoaded)
                {
                    mainBotsLoaded = true;
                    [mainBotMove, mainBotSpell] = await loadBotModels("./botMove61.324/model.json", "./botSpell61.324/model.json");
                }
                result = await doBattle(mainBotMove, mainBotSpell, 0);
                playing = false;
                c.strokeStyle = "#FFFFFF";
                c.fillStyle = "#FFFFFF";
                c.font = "150px Tahoma";
                c.fillText("You " + ((result == 2) ? "Won" : "Lost"), W / 2 - c.measureText("You " + ((result == 1) ? "Won" : "Lost")).width / 2, H / 4);
                c.font = "35px Tahoma"
                c.fillText("Play again", W / 3 - c.measureText("play again").width / 2, 2 * H / 3 + 50);
                c.fillText("Back", 2 * W / 3 - c.measureText("Back").width / 2, 2 * H / 3 + 50);
                currentDisplay = await doMenu(afterGameMenu(currentDisplay));
                break;
                //add transition screen
            case 4:
                playing = true;
                if (!imitatorBotsLoaded)
                {
                    imitatorBotsLoaded = true;
                    [imitatorMove, imitatorSpell] = await loadBotModels("./botMove61.324/model.json", "./botSpell61.324/model.json");
                }
                result = await doBattle(imitatorMove, imitatorSpell, 0);
                playing = false;
                c.strokeStyle = "#FFFFFF";
                c.fillStyle = "#FFFFFF";
                c.font = "150px Tahoma";
                c.fillText("You " + ((result == 2) ? "Won" : "Lost"), W / 2 - c.measureText("You " + ((result == 1) ? "Won" : "Lost")).width / 2, H / 4);
                c.font = "35px Tahoma"
                c.fillText("Play again", W / 3 - c.measureText("play again").width / 2, 2 * H / 3 + 50);
                c.fillText("Back", 2 * W / 3 - c.measureText("Back").width / 2, 2 * H / 3 + 50);
                currentDisplay = await doMenu(afterGameMenu(currentDisplay));
                break;
            case 5:
                playing = true;
                result = await doBattleSimple();
                playing = false;
                c.strokeStyle = "#FFFFFF";
                c.fillStyle = "#FFFFFF";
                c.font = "150px Tahoma";
                c.fillText("You " + ((result == 2) ? "Won" : "Lost"), W / 2 - c.measureText("You " + ((result == 1) ? "Won" : "Lost")).width / 2, H / 4);
                c.font = "35px Tahoma"
                c.fillText("Play again", W / 3 - c.measureText("play again").width / 2, 2 * H / 3 + 50);
                c.fillText("Back", 2 * W / 3 - c.measureText("Back").width / 2, 2 * H / 3 + 50);
                currentDisplay = await doMenu(afterGameMenu(currentDisplay));
                break;
            case 6:
                currentDisplay = await doMenu(aboutMenu)
                break;
        }
    }
}
run();
window.addEventListener("keydown", (e) => {
    if (!e.repeat) {
        switch (e.key) {
            case "a":
                left = true;
                break;
            case "d":
                right = true;
                break;
            case "w":
                up = true;
                break;
            case "s":
                down = true;
        }
    }
});
window.addEventListener("keyup", (e) => {
    switch (e.key) {
        case "a":
            left = false;
            break;
        case "d":
            right = false;
            break;
        case "w":
            up = false;
            break;
        case "s":
            down = false;
    }
});
window.addEventListener("mousedown", mouse);
window.addEventListener("mouseup", mouse);
window.addEventListener("mousemove", mouse);
setInterval(doMouseStuff, 5);