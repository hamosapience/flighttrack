var geolib = require('geolib');
var planefinder = require('planefinder');
var fr = require("./fr-client.js");

var coords = {
  latitude: 55.4506,
  longitude: 37.3704
};
var maxDistance = 50000;  // meters

var bounds = geolib.getBoundsOfDistance(coords, maxDistance);

console.log(bounds);

var client = planefinder.createClient({
	bounds: bounds,
	interval: 2000
});

var frClient = fr.createClient({
	bounds: bounds,
	interval: 3000
});


frClient.on('data', function(traffic){
	console.log(traffic);
});



var app = require('http').createServer(handler),
	io = require('socket.io').listen(app),
	fs = require('fs');

io.set("resource", "/");

app.listen(8000);

function handler (req, res) {
  fs.readFile(__dirname + '/client.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}

io.sockets.on('connection', function(socket){
	client.on('data', function(traffic) {
		socket.emit('traffic', {
			data: traffic
		});
	});
});



client.resume();

