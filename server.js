const http = require('http');
var static = require('node-static');
var file = new(static.Server)(__dirname);
const requestListener = function (req, res) {
    file.serve(req, res);
}

const server = http.createServer(requestListener);
server.listen(8000);