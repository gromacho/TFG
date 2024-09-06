import sys

# from types_support.maps_types import position, route
# import car_app.osmap as Map

from maps_types import position, route
from osmap import Map

class GPS:
    def __init__(self, id, lon, lat):
        self.car_id = id
        self.position = position()
        self.position.lon = lon
        self.position.lat = lat
        self.map = Map()
        self.route = None
        self.distance = 0
        self.original_route = None

    # Try to use the map and calculate the next step with some obstacules
    def goNextStep(self):
        next_step = position()
        if self.route:
            next_step.lon = self.route[0][0]
            next_step.lat = self.route[0][1]

            self.route.pop(0)

        return next_step

    def emptyRoute(self):
        if self.route:
            return False
        else:
            return True

    def calculateRoute(self, destination):
        osm_answer = self.map.getRoute(
            f"{self.position.lon},{self.position.lat}", f"{destination.lon},{destination.lat}"
        )
        self.route = osm_answer[0]
        self.distance = osm_answer[1]
        self.original_route = self.route
        return self.route

    def getLongitude(self):
        return self.position.lon

    def getLatitude(self):
        return self.position.lat

    def getGPS(self):
        return self.position
    
    def getDistance(self):
        return self.distance

    def setLongitude(self, lon):
        self.position.lon = lon

    def setLatitude(self, lat):
        self.position.lat = lat

    def deleteRoute(self):
        self.route = None

    def getRoute(self):
        routeSample = route()

        routeSample.id = self.car_id

        for step in self.original_route:
            positionSample = position()
            positionSample.lon = step[0]
            positionSample.lat = step[1]
            routeSample.path.append(positionSample)

        return routeSample
