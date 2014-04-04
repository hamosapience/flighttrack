var geolib = require("geolib");

exports.isInsideSector = function(point, center, sectorStartPoint, sectorEndPoint, radiusSmall, radiusBig) {

    point = convertCoordsToPoint(point);
    center = convertCoordsToPoint(center);
    sectorStartPoint = convertCoordsToPoint(sectorStartPoint);
    sectorEndPoint = convertCoordsToPoint(sectorEndPoint);
    
    var relPoint = {
        x: point.x - center.x,
        y: point.y - center.y
    };

    var sectorStartVector = normalizeVector({
        x: sectorStartPoint.x - center.x,
        y: sectorStartPoint.y - center.y
    });

    var sectorEndVector = normalizeVector({
        x: sectorEndPoint.x - center.x,
        y: sectorEndPoint.y - center.y
    });

    // console.log(point, areClockwise(sectorStartVector, relPoint), !areClockwise(sectorEndVector, relPoint));
    // console.log(center)

    return areClockwise(sectorStartVector, relPoint) &&
         !areClockwise(sectorEndVector, relPoint) &&
         exports.isWithinRadius(point, center, radiusSmall, radiusBig);
};

function normalizeVector(v){
    var module = Math.sqrt(v.x * v.x + v.y * v.y);
    return {
        x: v.x / module,
        y: v.y / module
    };
}

function convertCoordsToPoint(point){
    return {
        x: point.longitude || point.lon,
        y: point.latitude || point.lat
    };
}

function areClockwise(v1, v2) {
    return -v1.x*v2.y + v1.y*v2.x > 0;
}

exports.isWithinRadius = function(point, center, radiusSmall, radiusBig) {
    var pointFormat = {
        "x": point.hasOwnProperty("lon") ? "lon" : "longitude",
        "y": point.hasOwnProperty("lat") ? "lat" : "latitude",
    };
    var centerFormat = {
        "x": center.hasOwnProperty("lon") ? "lon" : "longitude",
        "y": center.hasOwnProperty("lat") ? "lat" : "latitude",
    };
    center = {
        latitude: center[centerFormat.y],
        longitude: center[centerFormat.x]
    };
    point = {
        latitude: point[pointFormat.y],
        longitude: point[pointFormat.x]
    };
    var distance = geolib.getDistance(point, center);

    return distance >= radiusSmall && distance <= radiusBig;
};