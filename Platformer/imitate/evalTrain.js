const tf = require("@tensorflow/tfjs-node");
const dist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const divide = (f, e0, e1, iter) =>
{
 for (let i = 0; i < iter; i++)
 {
     let mid = (e0 + e1) / 2;
     if (f(mid) * f(e0) > 0)
     {
         e0 = mid;
     }
     else e1 = mid;
 }
 return e0
}
class Player
{
 constructor(obj)
 {
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
     this.dataList = obj.dataList;
 }
 update(externalForces, state)
 {
     let inputs = this.getInput(state);
     if (inputs.spell)
     {
         this.spellToCast = inputs.spell;
         this.spellAng = inputs.ang;
     }
     if (this.touchingDown)
     {
         this.spellCoolDown --;
     }
  
     if (this.spellToCast != "" && this.spellCoolDown < 1)
     {
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
 setUpdateFunction(updateFunc)
 {
     this.getInput = updateFunc;
 }
 inputToForce(inputs)
 {
     let ret = {
         x: 0,
         y: 0
     }
     if (this.touchingDown)
     {
         if (inputs.up)
         {
             ret.y -= 25;
         }
     }
     if (inputs.down)
     {
         ret.y += 0.5;
     }
     if (inputs.right)
     {
         ret.x += 0.5;
     }
     if (inputs.left)
     {
         ret.x -= 0.5;
     }
     return ret;
 }
 getTouching(platforms)
 {
     this.touching = [];
     for (const p of platforms)
     {
         if (p.isVertical)
         {
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
         else
         {
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
     for (const intersection of this.touching)
     {
         if (intersection.down != false)
         {
             this.touchingDown = true;
             this.canDoubleJump = true;
             break;
         }
     }
 }
 doCollisions()
 {
     //add hit top
     for (const i of this.touching)
     {
         if (i.up != false)
         {
             this.velY = Math.max(0, this.velY);
             this.y = i.up + this.r;
         }
         if (i.down != false)
         {
             this.velY = Math.min(0, this.velY);
             this.y = i.down - this.r;
         }
         if (i.left != false)
         {
             this.velX = Math.max(0, this.velX);
             this.x = i.left + this.r;
         }
         if (i.right != false)
         {
             this.velX = Math.min(0, this.velX);
             this.x = i.right - this.r;
         }
     }
 }
 getEnds(ends)
 {
     this.touchingEnds = [];
     for (const e of ends)
     {
         if (dist(this, e) < this.r * this.r)
         {
             this.touchingEnds.push({x: e.x, y: e.y});
         }
     }
 }
 doEndCollision()
 {
     if (this.touchingEnds.length > 0)
     {
         this.touchingDown = true;
         this.canDoubleJump = false;
         let e = this.touchingEnds[0];
         let xO = this.x - this.velX - e.x;
         let yO = this.y - this.velY - e.y;
         let xN = this.x - e.x;
         let yN = this.y - e.y;
         let slope = (yN - yO) / (xN - xO);
         //figure out where the collision happened
         let f = (x) => x*x + (yO + slope * (x - xO))**2 - this.r**2;
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
 castSpell(state)
 {
     if (this.spellToCast == "jump")
     {
         if (!this.canDoubleJump)
         {
             return;
         }
         this.canDoubleJump = false;
         this.touchingDown = true;
         this.velY = 0;
     }
     if (this.spellToCast == "force")
     {
         state.spells.push(new Spell({
             x: this.x, y: this.y, vel: 20, caster: this, r: 30,
             ang: this.spellAng, onHit: (p) => {p.velX += 30 * Math.cos(this.spellAng);
             p.velY += 10 * Math.sin(this.spellAng)},
             color: "#ADD8E6"
         }, state));
     }
     if (this.spellToCast == "attack")
     {
         state.spells.push(new Spell({
             x: this.x, y: this.y, vel: 20, caster: this, r: 20,
             ang: this.spellAng, onHit: (p) => {p.health -= 30;},
             color: "#FF0000"
         }, state));
     }
     this.spellCoolDown = 30;
     this.spellToCast = "";
 }
}
class Spell{
 constructor(obj, state)
 {
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
 update(state)
 {
     let toDelete = false;
     //move
     let oldX = this.x;
     let oldY = this.y;
     this.x += this.vel * this.xBasis;
     this.y += this.vel * this.yBasis;
     if ((oldX > this.maxX) != (this.x > this.maxX))
     {
         this.x = this.maxX;
         this.y = this.maxY;
         toDelete = true;
     }
     //for each player:
         //find distances of player perpendicular and paralell to angle
         //if perpendicular distance < 20 and parallel distance where was recently
         //hit player
     for (const p of state.players)
     {
         if (p != this.caster)
         {
             let dX = p.x - this.x;
             let dY = p.y - this.y;
             let dPar = dX * this.xBasis + dY * this.yBasis;
             let dPerp = -dX * this.yBasis + dY * this.xBasis;
             if (dPar <= 0 && dPar >= -Math.sqrt(dist({x: oldX, y: oldY}, this))
                 && Math.abs(dPerp) < this.r + p.r)
             {
                 this.onHit(p);
                 this.delete(state);
                 return;
             }
          
         }
     }
     if (toDelete)
         this.delete(state);
 }
 delete(state)
 {
     state.spellsToDelete.push(state.spells.indexOf(this));
 }
 findPathEnd(state)
 {
     let stepMin = 1000; //number of steps the spell will go without obstacles
     for (const p of state.platforms)
     {
         if (p.isVertical){
             let steps = (p.x - this.x) / this.xBasis;
             if (steps > 0){ //in front of spell
                 let yHit = steps * this.yBasis + this.y - p.y;
                 if (yHit > 0 && yHit < p.length) //actually hits wall
                 {
                     if (steps < stepMin)
                     {
                         stepMin = steps;
                     }
                 }
             }
         }
         else{
             let steps = (p.y - this.y) / this.yBasis;
             if (steps > 0){ //in front of spell
                 let xHit = steps * this.xBasis + this.x - p.x;
                 if (xHit > 0 && xHit < p.length) //actually hits wall
                 {
                     if (steps < stepMin)
                     {
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
function stateToTensor(firstPlayer, opponent, platforms, spells)
{
 let l = [];
 for (let i = 0; i < 12; i++)
 {
     let ang = 2 * Math.PI / i;
     let xBasis = Math.cos(ang);
     let yBasis = Math.sin(ang);
     let stepMin = 1000;
     for (const p of platforms)
     {
         if (p.isVertical){
             let steps = (p.x - firstPlayer.x) / xBasis;
             if (steps > 0){ //in front of spell
                 let yHit = steps * yBasis + firstPlayer.y - p.y;
                 if (yHit > 0 && yHit < p.length) //actually hits wall
                 {
                     if (steps < stepMin)
                     {
                         stepMin = steps;
                     }
                 }
             }
         }
         else{
             let steps = (p.y - firstPlayer.y) / yBasis;
             if (steps > 0){ //in front of spell
                 let xHit = steps * xBasis + firstPlayer.x - p.x;
                 if (xHit > 0 && xHit < p.length) //actually hits wall
                 {
                     if (steps < stepMin)
                     {
                         stepMin = steps;
                     }
                 }
             }
         }
     }
     l.push(20 / Math.max(20, stepMin));
 }
 if (spells.length > 0)
 {
     let closestSpell = spells[0];
     let dMin = dist(spells[0], firstPlayer);
     for (const s of spells)
     {
         if (dist(s, firstPlayer) < dMin)
         {
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
 else
 {
     l.push(0);
     l.push(0);
     l.push(0);
     l.push(0);
     l.push(0);
 }
 if (dist(firstPlayer, opponent) > 400){
     l.push(20 * (opponent.x - firstPlayer.x) / dist(firstPlayer, opponent));
     l.push(20 * (opponent.y - firstPlayer.y) / dist(firstPlayer, opponent));
 }
 else{
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
function createBotModel()
{
 const move = tf.sequential();
 move.add(tf.layers.dense({inputShape:[27], units: 50, activation: "relu"}));
 move.add(tf.layers.dense({units: 50, activation: "relu"}));
 move.add(tf.layers.dense({units: 6, activation: "softmax"}));
 const opt1 = tf.train.adam();
 move.compile({
     optimizer: opt1,
     loss: tf.metrics.categoricalCrossentropy
 });
 const spell = tf.sequential();
 spell.add(tf.layers.dense({inputShape:[27], units: 50, activation: "relu"}));
 //spell.add(tf.layers.dense({units: 50, activation: "relu"}));
 spell.add(tf.layers.dense({units: 4, activation: "softmax"}));
 const opt2 = tf.train.adam();
 spell.compile({
     optimizer: opt2,
     loss: tf.metrics.categoricalCrossentropy
 });
 return [move, spell]
}
function getModelUpdate(modelMove, modelSpell, modelPlayer)
{
 const updateFunc = (state) =>
 {
     let otherPlayer;
     for (const p of state.players)
     {
         if (p != modelPlayer)
         {
             otherPlayer = p;
             break;
         }
     }
     const s = stateToTensor(modelPlayer, otherPlayer, state.platforms, state.spells);
     const movementProbs = modelMove.predict(s).dataSync();
     const spellProbs = modelSpell.predict(s).dataSync();
     let a = Math.random();
     let tempNum;
     for (let i = 0; i < movementProbs.length; i++)
     {
         a -= movementProbs[i];
         if (a < 0)
         {
             tempNum = i;
             break;
         }
     }
     const movementNum = tempNum;
     a = Math.random();
     for (let i = 0; i < spellProbs.length; i++)
     {
         a -= spellProbs[i];
         if (a < 0)
         {
             tempNum = i;
             break;
         }
     }
     const spellNum = tempNum;
     modelPlayer.dataList.push([s, movementNum, spellNum]);
     let up = false;
     let right = false;
     let left = false;
     let spell = "";
     switch (movementNum){
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
     switch(spellNum){
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
     let ret = {up: up, down: false, left: left,
         right: right, spell: spell, ang: ang}
     return ret;
 }
 return updateFunc;
}
function createEvaluatorModel()
{
 const model = tf.sequential();
 model.add(tf.layers.dense({inputShape:[54], units: 50, activation: "relu"}));
 model.add(tf.layers.dense({units: 50, activation: "relu"}));
 model.add(tf.layers.dense({units: 2, activation: "softmax"}));
 const opt = tf.train.adam();
 model.compile({
     optimizer: opt,
     loss: tf.metrics.categoricalCrossentropy
 });
 return model;
}
function doTimestep(state)
{
 for (const player of state.players){
     player.update({x: 0, y: 2}, state);
 }
 for (const s of state.spells)
 {
     s.update(state);
 }
 state.spellsToDelete.sort((a, b) => b-a);
 for (const s of state.spellsToDelete)
 {
     state.spells.splice(s, 1);
 }
 state.spellsToDelete = [];
 let winner = 0;
 for (let i = 0; i < state.players.length; i++)
 {
     const p = state.players[i];
     if (p.health < 0 || p.y > 500)
     {
         winner += i + 1;
     }
 }
 return winner;
}
function doBattle(model1Move, model1Spell, model2Move, model2Spell)
{
 //list of bot1 tensors and decisions (pass both along to bots)
 const bot1Data = [];
 //list of bot2 tensors and decisions
 const bot2Data = [];
 //prepare players
 const bot1 = new Player({
     x: 200,
     y: - 100,
     r: 15,
     friction: 0.95,
     dataList: bot1Data
 });
 bot1.setUpdateFunction(getModelUpdate(model1Move, model1Spell, bot1));
 const bot2 = new Player({
     x: 1400,
     y: - 100,
     r: 15,
     friction: 0.95,
     dataList: bot2Data
 });
 bot2.setUpdateFunction(getModelUpdate(model2Move, model2Spell, bot2));
 //prepare state
 const state = {
     players: [bot1, bot2],
     platforms: [
         {x: 100, y: 1, length: 1400, isVertical: false},
         {x: 1, y: -500, length: 400, isVertical: true},
         {x: 1, y: -100, length: 100, isVertical: false},
         {x: 100, y: -200, length: 100, isVertical: false},
         {x: 1, y: -300, length: 50, isVertical: false},
         {x: 200, y: -300, length: 200, isVertical: false},
         {x: 400, y: -350, length: 50, isVertical: true},
         {x: 500, y: -300, length: 200, isVertical: false},
         {x: 900, y: -300, length: 200, isVertical: false},
         {x: 1200, y: -350, length: 50, isVertical: true},
         {x: 1200, y: -300, length: 200, isVertical: false},
         {x: 1600, y: -500, length: 400, isVertical: true},
         {x: 1500, y: -100, length: 100, isVertical: false},
         {x: 1400, y: -200, length: 100, isVertical: false},
         {x: 1550, y: -300, length: 50, isVertical: false}
     ],
     spells: [],
     ends: [],
     spellsToDelete: []
 };
 for (const p of state.platforms){
     state.ends.push({x: p.x, y: p.y});
     state.ends.push({x: p.x + (1 - p.isVertical) * p.length,
         y: p.y + p.isVertical * p.length});
 }
 for (const s of state.spells)
 {
     s.findPathEnd(state);
 }
  let winner = 0;
 for (let count = 0; count < 3000 && winner == 0; count++)
 {
     winner = doTimestep(state);
 }
 return [winner, bot1Data, bot2Data];
}
async function saveLocal(model, string, a)
{
 let s = "" + a.toFixed(3);
 return await model.save("file://./bots/"+string+s.substring(1));
}
async function runTrainingBattle(model1Move, model1Spell, model2Move, model2Spell, evaluator)
{
    const [result, bot1Data, bot2Data] = doBattle(model1Move, model1Spell,
        model2Move, model2Spell);
    let battleLabel = [0, 0];
    if (result == 1)
    {
        battleLabel = [1, 0];
    }
    else if (result == 2)
    {
        battleLabel = [0, 1];
    }
    let dataList = [];
    let labelList = [];
    for (let j = bot2Data.length - 100; j < bot2Data.length; j++)
    {
        dataList.push(tf.concat([bot1Data[j][0], bot2Data[j][0]], 1));
        labelList.push(battleLabel);
    }
    if ((result == 1 || result == 2))
    {
        const data = tf.concat(dataList);
        const labels = tf.tensor(labelList);
        await evaluator.trainOnBatch(data, labels);
    }
}
async function trainEvalutatorOnBots(names, hours)
{
    const evaluator = createEvaluatorModel();
    const saveKey = Math.random();
    const bots = [];
    for (const d of names)
    {
        const move = await tf.loadLayersModel("file://./" + d[0]);
        const spell = await tf.loadLayersModel("file://./" + d[1]);
        move.compile({
            optimizer: tf.train.adam(),
            loss: tf.metrics.categoricalCrossentropy
        });
        spell.compile({
            optimizer: tf.train.adam(),
            loss: tf.metrics.categoricalCrossentropy
        });
        bots.push([move, spell]);
    }
    let tEnd = new Date().getTime() + hours[i] * 3600000;
    let count = 0;
    while (new Date().getTime() < tEnd)
    {
        for (let k = 0; k < 100; k ++)
        {
            count ++;
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(count.toString());
            const bot1Num = Math.floor(Math.random() * bots.length);
            const bot2Num = Math.floor(Math.random() * bots.lengh);
            tf.engine().startScope();
            runTrainingBattle(bots[bot1Num][0], bots[bot1Num][1], bots[bot2Num][0], bots[bot2Num][1], evaluator);
            tf.engine().endScope();
        }
    }

    await saveLocal(evaluator, "evaluator", saveKey);
}
trainEvalutatorOnBots([["imitatorMove/imitatorMove.json", "imitatorSpell/imitatorSpell.json"], ["imitatorMove2/imitatorMove.json", "imitatorSpell2/imitatorSpell.json"]], 8);