/*stuff to add:
    -More interesting terrain
    -Line -> double jump
    -Ligthining Bolt -> Attack (Towards mouse)
    -Triangle -> Push away (Directed towards mouse)
    -Circle to shield?
    -Bot to battle against
        Simple: Always attacks towards the enemy, moves towards them too
        Random: Random what it does
        Some neural networks (Goal: Beat simple)
*/
canvas = document.getElementById("canvas")
canvas.focus()
c = canvas.getContext("2d")

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const H = canvas.height;
const W = canvas.width;

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
        this.getInput = obj.getInput; //mouse gets included here when ready
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
    update(externalForces)
    {
        let inputs = this.getInput(state);
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
            this.castSpell();
        }
        
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
    castSpell()
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
            }));
        }
        if (this.spellToCast == "attack")
        {
            state.spells.push(new Spell({
                x: this.x, y: this.y, vel: 20, caster: this, r: 20,
                ang: this.spellAng, onHit: (p) => {p.health -= 30;}, 
                color: "#FF0000"
            }));
        }
        this.spellCoolDown = 30;
        this.spellToCast = "";
    }

}
class Spell{
    constructor(obj)
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
        this.findPathEnd();
    }

    update()
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
                    this.delete();
                    return;
                }
                
            }
        }
        if (toDelete)
            this.delete();
    }

    delete()
    {
        state.spellsToDelete.push(state.spells.indexOf(this));
    }

    findPathEnd()
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
var state;
var me;
var simple;
const prepareState = () => {
    me = new Player({
        x: 200,
        y: - 100,
        r: 15,
        friction: 0.95,
        getInput: humanPlayerUpdate
    });
    simple = new Player({
        x: 1000,
        y: - 100,
        r: 15,
        friction: 0.95,
        getInput: simplePlayerUpdate
    })
    state = {
        players: [me, simple],
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
        spells: []
    
    };
    state.ends = [];
    for (const p of state.platforms){
        state.ends.push({x: p.x, y: p.y});
        state.ends.push({x: p.x + (1 - p.isVertical) * p.length,
            y: p.y + p.isVertical * p.length});
    }
    state.spellsToDelete = [];
    for (const s of state.spells)
    {
        s.findPathEnd();
    }
}
const run = (refreshId) => {
    for (const player of state.players){
        player.update({x: 0, y: 2});
    }
    for (const s of state.spells)
    {
        s.update();
    }
    state.spellsToDelete.sort((a, b) => b-a);
    for (const s of state.spellsToDelete)
    {
        state.spells.splice(s, 1);
    }
    state.spellsToDelete = [];
    for (const p of state.players)
    {
        if (p.health < 0 || p.y > 500)
        {
            clearInterval(refreshId);
            doEnding();
            break
        }
    }
}
function doRunning(){
    prepareState();
    let refreshId = setInterval(()=>{run(refreshId)}, 30);
    
}
function doEnding(){
    doRunning();
};
doRunning()
