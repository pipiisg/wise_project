const tf = require("@tensorflow/tfjs-node");
const { memoryUsage } = require("process");
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
       if (this.touchingDown && this.spellCoolDown > 0) {
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
               if (dPar <= 0 && dPar >= -Math.sqrt(dist({ x: oldX, y: oldY }, this))
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
   //spell.add(tf.layers.dense({units: 50, activation: "relu"}));
   spell.add(tf.layers.dense({ units: 4, activation: "softmax" }));
   const opt2 = tf.train.adam();
   spell.compile({
       optimizer: opt2,
       loss: tf.metrics.categoricalCrossentropy
   });
   return [move, spell]
}
async function loadBotModels(moveString, spellString)
{
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
       let ang = Math.atan2(otherPlayer.y - modelPlayer.y, otherPlayer.x - modelPlayer.x);
       let ret = {
           up: up, down: false, left: left,
           right: right, spell: spell, ang: ang
       }
       return ret;
   }
   return updateFunc;
}
function getDummyUpdate(movementNum, spellNum, modelPlayer, otherPlayer)
{
    const updateFunc = (state) => 
    {
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
        let ang = Math.atan2(otherPlayer.y - modelPlayer.y, otherPlayer.x - modelPlayer.x);
        let ret = {
            up: up, down: false, left: left,
            right: right, spell: spell, ang: ang
        };
        return ret;
    }
    return updateFunc
}
function doTimestep(state) {
   for (const player of state.players) {
       player.update({ x: 0, y: 2 }, state);
   }
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
       if (p.health < 0 || p.y > 500) {
           winner += i + 1;
       }
   }
   return winner;
}
async function loadEvaluatorModel(name)
{
    const evaluator = await tf.loadLayersModel("file://./" + name + "/model.json");
     /*evaluator.compile({
         optimizer: tf.train.adam(),
         loss: tf.metrics.categoricalCrossentropy
        });*/
    return evaluator
}
function copyState(state)
{
    const players = [];
    for (const p of state.players)
    {
        players.push({x: p.x, p: p.y, r: p.r, xVel: p.velX, yVel: p.velY,
            health: p.health, spellCoolDown: p.spellCoolDown});
    }
    const spells = [];
    for (const s of state.spells)
    {
        spells.push({x: s.x, y: s.y, vel: s.vel, xBasis: s.xBasis, yBasis: s.yBasis,
        onHit: s.onHit, r: s.r, caster: state.players.indexOf(s.caster), color: s.color});
    }
    return [players, spells]
}
function pasteState(stateObj, model1Move, model1Spell, model2Move, model2Spell)
{
    const players = stateObj[0];
    const spells = stateObj[1];
    const bot1 = new Player({
        x: players[0].x,
        y: players[0].y,
        r: players[0].r,
        friction: 0.95
    });
    bot1.velX = players[0].xVel;
    bot1.velY = players[0].yVel;
    bot1.health = players[0].health;
    bot1.spellCoolDown = players[0].spellCoolDown;
    bot1.setUpdateFunction(getModelUpdate(model1Move, model1Spell, bot1));
    const bot2 = new Player({
        x: players[1].x,
        y: players[1].y,
        r: players[1].r,
        friction: 0.95
    });
    bot2.velX = players[1].xVel;
    bot2.velY = players[1].yVel;
    bot2.health = players[1].health;
    bot2.spellCoolDown = players[1].spellCoolDown;
    bot2.setUpdateFunction(getModelUpdate(model2Move, model2Spell, bot2));
    const state = {
        players: [bot1, bot2],
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
    for (const s of spells)
    {
        const nSpell = new Spell({
            x: s.x, y: s.y, vel: s.vel, caster: state.players[s.caster], r: s.r,
            ang: 0, onHot: s.onHit, color: s.color
        }, state);
        nSpell.xBasis = s.xBasis;
        nSpell.yBasis = s.yBasis;
        state.spells.push(nSpell);
    }
    return state
}
function evaluateStateNeural(state, evaluator)
{
    return tf.tidy(() => {
        const t1 = stateToTensor(state.players[0], state.players[1], state.platforms, state.spells);
        const t2 = stateToTensor(state.players[1], state.players[0], state.platforms, state.spells);
        const eval = evaluator.predict(tf.concat([t1, t2], 1)).dataSync();
        return eval;
    })
    
}
function healthToScore(health)
{
    switch (health)
    {
        case 100:
            return 0;
        case 70:
            return -1/6;
        case 40:
            return -0.5;
        case 10:
            return -1.5;
    }
    return -3;
}
function positionToScore(pos)
{
   const dis = Math.abs(pos - 800) / 700;
   return -1 * dis ** 4;

}
function evaluateStateReg(state)
{
    const player1 = state.players[0];
    const player2 = state.players[1];
    if (player1.y > 10)
        return [0, 1];
    if (player2.y > 10)
        return [1, 0];

    let playerEvals = [0, 0];

    //from positions
    playerEvals[0] += healthToScore(player1.health);
    playerEvals[0] += positionToScore(player1.x);
    playerEvals[1] += healthToScore(player2.health);
    playerEvals[1] += positionToScore(player2.x);

    //from spells
    for (const s of state.spells)
    {
        const target = (s.caster == player1) ? player2 : player1;
        const targetNum = (s.caster == player1) ? 1 : 0;
        const steps = (target.x - s.x) / s.xBasis;
        if (steps > 0)
        {
            if (s.color == "#FF0000")
            {
                playerEvals[targetNum] += (healthToScore(target.health - 30) - healthToScore(target.health)) / 2;
            }
            else
            {
                const dir = 2 * (s.xBasis > 0) - 1;
                playerEvals[targetNum] += (positionToScore(target.x + dir * 200) - positionToScore(target.x)) / 2;
            }
        }
    }
    
    //from ability to cast spells
    const dirPush = 2 * (player1.x > player2.x) - 1;
    const deltaHealth1 = (healthToScore(player1.health - 30) - healthToScore(player1.health)) / 2;
    const deltaPos1 = (positionToScore(player1.x + dirPush * 200) - positionToScore(player1.x)) / 2;
    playerEvals[0] += (30 - player2.spellCoolDown) / 60 * Math.min(deltaHealth1, deltaPos1);
    const deltaHealth2 = (healthToScore(player2.health - 30) - healthToScore(player2.health)) / 2;
    const deltaPos2 = (positionToScore(player2.x - dirPush * 200) - positionToScore(player2.x)) / 2;
    playerEvals[1] += (30 - player1.spellCoolDown) / 60 * Math.min(deltaHealth2, deltaPos2);

    const exp1 = Math.exp(playerEvals[0]);
    const exp2 = Math.exp(playerEvals[1]);
    return [exp1 / (exp1 + exp2), exp2 / (exp1 + exp2)];

}
function testEval(state)
{
    return state.players.map(d => - d.x);
}
function doBattle(model1Move, model1Spell, model2Move, model2Spell, evaluatorFunc)
{
    const trainingStates = [];
    //prepare players
    const bot1 = new Player({
        x: 200,
        y: - 100,
        r: 15,
        friction: 0.95,
    });
    bot1.setUpdateFunction(getModelUpdate(model1Move, model1Spell, bot1));
    const bot2 = new Player({
        x: 1400,
        y: - 100,
        r: 15,
        friction: 0.95,
    });
    bot2.setUpdateFunction(getModelUpdate(model2Move, model2Spell, bot2));
    //prepare state
    const state = {
        players: [bot1, bot2],
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
    let winner = 0;
    let currentState = [false];
    let mod = Math.floor(30 * Math.random());
    tf.engine().startScope();
    for (let count = 0; count < 3000 && winner == 0; count++) {
        winner = doTimestep(state);
        if (count % 30 == mod)
        {
            if (currentState[0])
            {
                trainingStates.push([currentState[1], evaluatorFunc(state)]);
            }
            currentState = [true, copyState(state)];
        }
    }
    tf.engine().endScope();
    return [trainingStates, winner];
}
function getTrainingData(stateData, evaluatorFunc, botNum, model1Move, model1Spell, model2Move, model2Spell)
{
    const state = pasteState(stateData[0], model1Move, model1Spell, model2Move, model2Spell);
    const principle = state.players[botNum];
    const opponent = state.players[botNum ^ 1];
    const stateTensor = stateToTensor(principle, opponent, state.platforms, state.spells);
    const movementNum = Math.floor(6 * Math.random());
    const spellNum = Math.floor(4 * Math.random());
    principle.setUpdateFunction(getDummyUpdate(movementNum, spellNum, principle, opponent));
    for (let i = 0; i < 10; i ++)
    {
        doTimestep(state);
    }
    if (botNum == 0)
    {
        principle.setUpdateFunction(getModelUpdate(model1Move, model1Spell, principle));
    }
    else
    {
        principle.setUpdateFunction(getModelUpdate(model2Move, model2Spell, principle));
    }
    for (let i = 0; i < 20; i ++)
    {
        doTimestep(state);
    }
    const evalDiff = evaluatorFunc(state)[botNum] - stateData[1][botNum];
    if (movementNum == 1 || movementNum == 4 || movementNum == 5)
    {
        evalDiff -= 0.1;
    }
    if (evalDiff > 0)
    {
        return [[stateTensor, movementNum, spellNum]];
    }
    return [];
}
async function doTrainingBattle(model1Move, model1Spell, model2Move, model2Spell, evaluatorFunc)
{
    /* I want this method to
    a) run a battle
    b) get training data from that battle
    c) train models on training data */
    const [battleData, winner] = doBattle(model1Move, model1Spell, model2Move, model2Spell, evaluatorFunc);
    const bot1TrainingData = [];
    for (const d of battleData)
    {
        const trainingEx = getTrainingData(d, evaluatorFunc, 0, model1Move, model1Spell, model2Move, model2Spell);
        if (trainingEx.length > 0)
            bot1TrainingData.push(trainingEx[0]);
    }
    tf.util.shuffle(bot1TrainingData);
    const stateList1 = bot1TrainingData.map(d => d[0]);
    const moveList1 = bot1TrainingData.map(d => toNum(d[1], 6));
    const spellList1 = bot1TrainingData.map(d => toNum(d[2], 4));
    if (stateList1.length > 0)
    {
        const stateTensor1 = tf.concat(stateList1);
        const moveTensor1 = tf.tensor(moveList1);
        const spellTensor1 = tf.tensor(spellList1);
        for (let i = 0; i < 5; i ++)
        {
            await model1Move.trainOnBatch(stateTensor1, moveTensor1);
            await model1Spell.trainOnBatch(stateTensor1, spellTensor1);
        }
        stateTensor1.dispose();
        moveTensor1.dispose();
        spellTensor1.dispose();
    }
    const bot2TrainingData = [];
    for (const d of battleData)
    {
        const trainingEx = getTrainingData(d, evaluatorFunc, 1, model1Move, model1Spell, model2Move, model2Spell);
        if (trainingEx.length > 0)
            bot2TrainingData.push(trainingEx[0]);
    }
    tf.util.shuffle(bot2TrainingData);
    const stateList2 = bot2TrainingData.map(d => d[0]);
    const moveList2 = bot2TrainingData.map(d => toNum(d[1], 6));
    const spellList2 = bot2TrainingData.map(d => toNum(d[2], 4));
    if (stateList2.length > 0)
    {
        const stateTensor2 = tf.concat(stateList2);
        const moveTensor2 = tf.tensor(moveList2);
        const spellTensor2 = tf.tensor(spellList2);

        for (let i = 0; i < 5; i ++)
        {
            await model2Move.trainOnBatch(stateTensor2, moveTensor2);
            await model2Spell.trainOnBatch(stateTensor2, spellTensor2);
        }
        stateTensor2.dispose();
        moveTensor2.dispose();
        spellTensor2.dispose();
    }
}
async function saveLocal(model, string, a)
{
   let s = "" + a.toFixed(3);
   return await model.save("file://./bots/"+string+s.substring(1));
}
async function run(hours)
{
    const bots = [];
    for (let i = 0; i < 2; i ++)
    {
        bots.push(await loadBotModels("file://./newMove/imitatorMove.json", "file://./newSpell/imitatorSpell.json"));
    }

    const saveKey = Math.random();
    const startTime = new Date().getTime();
    let timeToWork = 0;
    for (let i = 0; i < hours.length; i ++)
    {
        let count = 0;
        console.log("Starting Training cycle", i);
        timeToWork += hours[i];
        const tEnd = startTime + timeToWork * 3600000;
        while (new Date().getTime() < tEnd && memoryUsage().rss < 3 * 2 ** 30)
        {
            for (let k = 0; k < 100; k ++)
            {
                count ++;
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                process.stdout.write(count.toString());

                let bot1Num = Math.floor(bots.length * Math.random());
                let bot2Num = Math.floor(bots.length * Math.random());
                tf.engine().startScope();
                await doTrainingBattle(bots[bot1Num][0], bots[bot1Num][1], bots[bot2Num][0], bots[bot2Num][1], evaluateStateReg);
                tf.engine().endScope();
            }
        }
        for (let j = 0; j < bots.length; j ++)
        {
            await saveLocal(bots[j][0], "botMove" + (i + 1) + j, saveKey);
            await saveLocal(bots[j][1], "botSpell" + (i + 1) + j, saveKey);
        }
        process.stdout.write("\n");
        bots.push(await loadBotModels("file://./newMove/imitatorMove.json", "file://./newSpell/imitatorSpell.json"));
    }
}
run([1, 2, 2, 2, 2, 2]);

//make bot just for jumps
//remove randomness from simulator!!
//weight jumping badly in evaluation function