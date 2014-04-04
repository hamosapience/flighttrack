exports.isInsideSector = function(point, center, sectorStartVector, sectorEndVector, radiusBig, radiusSmall) {
  var relPoint = {
    x: point.x - center.x,
    y: point.y - center.y
  };

  return !areClockwise(sectorStartVector, relPoint) &&
         areClockwise(sectorEndVector, relPoint) &&
         isWithinRadius(relPoint, radiusBig, radiusSmall);
};

function areClockwise(v1, v2) {
  return -v1.x*v2.y + v1.y*v2.x > 0;
}

function isWithinRadius(v, radiusBig, radiusSmall) {
  return v.x*v.x + v.y*v.y <= ( radiusBig * radiusBig );
}