import math
import random
import time
import sys

from collections import deque
from queue import Queue

# from car_app.gps import GPS
# from car_app.osmap import Map
# from types_support.maps_types import car_info, position


from maps_types import car_info, position
from gps import GPS
from osmap import Map

class Car:
    def __init__(self, id: int, lon: float, lat: float, coordinates_to_go):
        self.destination = None
        self.car_info = car_info()
        self.car_info.id = id
        self.car_info.angle = 0
        self.car_info.arrival = False
        self.car_info.user_in_control = None
        self.GPS = GPS(id, lon, lat)
        self.stop_requested = False
        self.route_available = False
        self.need_asistance = False
        self.new_destination = False
        self.default_coordinates = coordinates_to_go
        self.release_car = False

        self.car_info.kph = 0
        self.car_info.gear = 1
        self.acelerating = False


    def getId(self):
        return self.car_info.id

    def changePosition(self, coordinates: position):
        print(f"Car {self.car_info.id} new destiny to ({coordinates.lon}, {coordinates.lat})")
        self.destination = coordinates
        self.GPS.calculateRoute(coordinates)
        self.route_available = True
        self.new_destination = True

    def getRoute(self):
        return self.GPS.getRoute()

    def arrivalStatus(self):
        return self.car_info.arrival

    def getAngle(self):
        return self.car_info.angle

    def getCarPosition(self):
        self.car_info.current_position.lon = self.GPS.getLongitude()
        self.car_info.current_position.lat = self.GPS.getLatitude()
        return self.car_info
    
    def defUser(self, user: str):
        self.car_info.user_in_control = user

    def getUser(self):
        return self.car_info.user_in_control
    
    def changeGear(self):
        if self.acelerating:
            if self.car_info.kph < 19:
                self.gear = 1
            elif self.car_info.kph < 25:
                self.gear = 2
            elif self.car_info.kph < 34:
                self.gear = 3
            elif self.car_info.kph < 50:
                self.gear = 4
        else:
            if self.car_info.kph > 40:
                self.gear = 4
            elif self.car_info.kph > 30:
                self.gear = 3
            elif self.car_info.kph > 20:
                self.gear = 2
            else:
                self.gear = 1

    def drive(self):
        max_speed = 50
        min_speed = 10
        acceleration = 0.1
        braking_distance = 250

        while not self.stop_requested:
            if not self.new_destination:
                random_position = self.default_coordinates[(random.randint(0, 1000) % 5)]
                known_position = position()
                known_position.lon = random_position[1]
                known_position.lat = random_position[0]
                self.changePosition(known_position)


            self.new_destination = False
            self.car_info.arrival = False
            new_position = self.destination
            print(
                f"\n ----------Car {self.car_info.id} new destiny to ({new_position.lon},"
                f" {new_position.lat})----------"
            )

            total_distance = self.GPS.getDistance()

            while not self.GPS.emptyRoute() and not self.new_destination:
                next_position = self.GPS.goNextStep()
                distance = math.sqrt(
                    (next_position.lon - self.GPS.getLongitude()) ** 2
                    + (next_position.lat - self.GPS.getLatitude()) ** 2
                )

                # total_distance = math.sqrt((self.GPS.route[-1][0] - self.GPS.getLongitude())** 2 + 
                #                 (self.GPS.route[-1][1] - self.GPS.getLatitude()) ** 2)

                

                if distance != 0:
                    direction = (next_position.lon - self.GPS.getGPS().lon) / distance, (
                        next_position.lat - self.GPS.getGPS().lat
                    ) / distance

                    # Calculate angle to new position
                    dlon = next_position.lon - self.GPS.getLongitude()
                    dlat = next_position.lat - self.GPS.getLatitude()
                    # I have changed the order of the arguments, before it was dlat, dlon
                    angle = math.atan2(dlon, dlat)  
                    angle = math.degrees(angle)
                    self.car_info.angle = angle

                    # Move car in straight line at constant speed to the next position
                    while (
                        math.sqrt(
                            (next_position.lon - self.GPS.getLongitude()) ** 2
                            + (next_position.lat - self.GPS.getLatitude()) ** 2
                        )
                        > 0.15 * distance
                    ):
                        # If we need assitance for more than two minutes continue driving
                        start_time = time.time()
                        while (self.need_asistance and not self.stop_requested):
                            if time.time() - start_time > 60:
                                self.need_asistance = False
                                if (self.car_info.user_in_control != None and self.car_info.user_in_control != ''):
                                    self.release_car = True

                                break
                            time.sleep(1)

                        total_distance -= distance*1000

                        if self.car_info.kph < max_speed:
                            self.acelerating = True
                            self.car_info.kph += acceleration

                        if total_distance < braking_distance and self.car_info.kph > min_speed:
                            self.acelerating = False
                            self.car_info.kph -= acceleration*2

                        # Calculate direction to new position
                        self.GPS.setLongitude(self.GPS.getLongitude() + direction[0] * self.car_info.kph / 3600 * 0.001)
                        self.GPS.setLatitude(self.GPS.getLatitude() + direction[1] * self.car_info.kph / 3600 * 0.001)

                        if random.uniform(0, 10000) < 1:
                            self.need_asistance = True
                            self.car_info.kph = 5
                            print("CAR " + str(self.car_info.id) + " NEEDS ASSISTANCE")

                        time.sleep(0.05)

            if not self.new_destination:
                # Set the GPS position to the next position to avoid pecision errors
                self.GPS.setLongitude(next_position.lon)
                self.GPS.setLatitude(next_position.lat)
                print("ARRIVED TO DESTINATION------" + str(self.car_info.arrival))
            
            self.car_info.arrival = True
            time.sleep(1.2)

        print("Stop requested, shutting down car drive...")
