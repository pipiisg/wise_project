function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function doUntilDone(f, time) {
    let startTime = new Date().getTime();
    let output = f();
    await timeout(time - new Date().getTime() + startTime);
    if (output == 0) {
        return await doUntilDone(f, time);
    }
    return output;

}
async function doUntilDone2(f, time)
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
async function run()
{
    let x = await doUntilDone2(() => {
        if (Math.random() < 0.2){
            return 1
        }
        console.log(2);
        return 0
    }, 1000)
    console.log(x)
}
run()