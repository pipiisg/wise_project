//start human player
var up = false;
var down = false;
var right = false;
var left = false;

var mouseX = 0;
var mouseY = 0;
var mouseDown = false;
var justClicked = false;
var currentShape = "";

var mouseShape = [];
var modelMain;

var spell = "";
loadModel();

async function loadModel()
{
    modelMain = await tf.loadLayersModel('shapeClass/shapeClass.json');
    console.log("Model Loaded!");
}
function predict(shape)
{
    if (shape.length > 3)
    {
        
        let possibleShapes = ["jump",  "force", "attack"];
        return tf.tidy(() => {
            let regShape = regularizeShape(makeMLShape(shape));
            let readyToTensorize = toMLInput(regShape);
            const shapeTensor3d = tf.tensor(readyToTensorize);
            const shapeTensor = shapeTensor3d.reshape([1,38]);
            const prediction = modelMain.predict(shapeTensor);
            let answer = prediction.argMax(-1).dataSync()[0];
            const confidence = prediction.max().dataSync()[0];
            return possibleShapes[answer];
        });
    }
    return "";
}
function regularizeShape(shape, rotateAndDilate = true)
{
    let v = shape[0];
    let newShape = [];

    //translate shape so that shape[0] is (0, 0)
    for (let i = 0; i < shape.length; i++)
    {

        newShape.push({x: shape[i].x - v.x, y: shape[i].y - v.y});
    }
    if (rotateAndDilate)
    {
        //finds point of max distance
        let maxD = 0;
        let index = 0;
        for (let i = 1; i < newShape.length; i++)
        {
            let d = newShape[i].x ** 2 + newShape[i].y ** 2
            if (d > maxD)
            {
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
function transformShape(shape, ang = 0, dilationCon = 1)
{
    let a = Math.cos(ang) * dilationCon;
    let b = Math.sin(ang) * dilationCon;
    const mat = tf.tensor([[a, -b], [b, a]])
    let newShape = [];
    for (let i = 0; i < shape.length; i++)
    {
        tf.tidy(() => {
            const v = tf.tensor([shape[i].x, shape[i].y], [2, 1])
            const result = mat.matMul(v);
            let data = result.dataSync();
            newShape.push({x: data[0], y: data[1]});
          });
    }
    mat.dispose();
    return newShape;
}
function makeMLShape(shape)
{
    let newShape = [];
    for (let i = 0; i < 20; i++)
    {
        let t = Math.floor((shape.length - 1) * i / 20);
        if (t == shape.length){
            t--;
        }
        let r = (shape.length * i / 20) % 1;
        let x = (1 - r) * shape[t].x + r * shape[t + 1].x;
        let y = (1 - r) * shape[t].y + r * shape[t + 1].y;
        newShape.push({x:x, y:y});
    }
    return newShape;
}
function toMLInput(shape)
{
    //changes shape from a dictionary in a list to a tensor
    const arrayShape = [];
    for (let i = 1; i < shape.length; i++)
    {
        arrayShape.push([shape[i].x, shape[i].y]);
    }
    return arrayShape
}
function getMouseShape()
{
    return mouseShape;
}
const doMouseStuff = () =>
{
    if (mouseDown)
    {
        if (justClicked)
        {
            justClicked = false;
        }
        if (mouseShape.length == 0 || 
            (mouseShape[mouseShape.length-1].x != mouseX 
                || mouseShape[mouseShape.length-1].y != mouseY)){
            mouseShape.push({x: mouseX, y: mouseY});
        }

    }
    else
    {
        if (justClicked)
        {
            spell = predict(mouseShape);
            mouseShape = [];
            justClicked = false;
            
        }

    }
}
const mouse = function(event){
    if (event.type === "mousedown"){
        mouseDown = true;
        mouseX = event.x;
        mouseY = event.y;
        justClicked = true;
    }
    else if (event.type === "mouseup"){
        mouseDown = false;
        mouseX = event.x;
        mouseY = event.y;
        justClicked = true;
    }
    else{
        mouseX = event.x;
        mouseY = event.y;
    }
}
const displayShape = (shape) => {
    if (shape.length > 0)
    {
        c.beginPath();
        c.moveTo(shape[0].x, shape[0].y)
        for (let i = 0; i < shape.length; i++)
        {
            c.lineTo(shape[i].x, shape[i].y)
        }
        c.stroke();
    }

}
function humanPlayerUpdate(state)
{
    let tX = W / 2 - me.x;
    let tY = H /2 - me.y + me.velY / 2;

    c.fillStyle = "#000000";
    c.fillRect(0, 0, W, H);
    for (const p of state.players)
    {
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
        c.fillStyle = "#"+red+green+"00"
        c.fillRect(p.x - 25 + tX, p.y - 20 + tY - p.r, p.health/2, 5);
    }
    c.strokeStyle = "#FFFFFF";
    for (const p of state.platforms)
    {
        c.beginPath();
        c.moveTo(p.x + tX, p.y + tY);
        if (p.isVertical)
            c.lineTo(p.x + tX, p.y + p.length + tY);
        else
            c.lineTo(p.x + p.length + tX, p.y + tY);
        c.stroke();
    }
    displayShape(mouseShape);
    for (const s of state.spells)
    {
        c.fillStyle = s.color;
        c.beginPath();
        c.moveTo(s.x + tX + 5, s.y + tY);
        c.arc(s.x + tX, s.y + tY, 5, 0, 6.29);
        c.fill();
    }
    let ang = Math.atan2(mouseY - me.y - tY, mouseX - me.x - tX);
    let ret = {up: up, down: down, left: left, right: right, spell: spell, ang: ang};
    spell = "";
    return ret;
}
setInterval(doMouseStuff, 5);
window.addEventListener("keydown", (e) => {
    if (!e.repeat)
    {
        switch(e.key)
        {
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
    switch(e.key)
    {
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
//end human player


//start simple player
function simplePlayerUpdate(state)
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
//end simple player

//start test player
function testPlayerUpdate(state)
{
    return {up: false, right: false, left: false, down: false, spell: "", ang: 0};
}
//end test player