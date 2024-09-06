# (c) Copyright, Real-Time Innovations, 2024.  All rights reserved.
# RTI grants Licensee a license to use, modify, compile, and create derivative
# works of the software solely for use with RTI Connext DDS. Licensee may
# redistribute copies of the software provided that all such copies are subject
# to this license. The software is provided "as is", with no warranty of any
# type, including any warranty for fitness for any purpose. RTI is under no
# obligation to maintain or support the software. RTI shall not be liable for
# any incidental or consequential damages arising out of the use or inability
# to use the software.

import argparse
import queue
import sys
import threading
import time
import random

import rti.connextdds as dds

from maps_types import car_info, command, route, failure_assistance, user_info, request_type, request_control
from car import Car

# from car_app.car import Car
# from car_app.osmap import Map
# from types_support.maps_types import car_info, command, route, failure_assistance


class carParticipant:
    def __init__(self, created_car: Car):
        self.car = created_car
        self.next_positions = queue.Queue()
        self.stop_requested = False
        self.last_assistance_status = False

    def process_queue_car_commands(self, reader):
        # take_data() returns copies of all the data samples in the reader
        # and removes them. To also take the SampleInfo meta-data, use take().
        # To not remove the data from the reader, use read_data() or read().
        samples = reader.take_data()
        count = 0
        for sample in samples:
            if sample.id == self.car.getId():
                print(sample)
                self.next_positions.put(sample.destination)
                print(f"Received: {sample.destination}")
                count += 1

        return count
    
    def process_queue_failure_assistance(self, reader):
        samples = reader.take_data()
        for sample in samples:
            if sample.id_car == self.car.getId():
                print(sample)
                if not sample.need_asistance:
                    print(f"--------Car {self.car.getId()} being assisted")
                    self.car.need_asistance = False

    def process_queue_user_info(self, reader):
        print("------------------Processing user info----------------------")
        samples = reader.take_data()
        for sample in samples:
            if sample.id_car == self.car.getId():
                self.car.defUser(sample.username)
                print(f"-----------Car {self.car.getId()} has a new user {sample.username}-----------------")

            
    def run_car(self, domain_id: int, sample_count: int):
        # A DomainParticipant allows an application to begin communicating in
        # a DDS domain. Typically there is one DomainParticipant per application.
        # DomainParticipant QoS is configured in USER_QOS_PROFILES.xml
        participant = dds.DomainParticipant(domain_id)

        # A Topic has a name and a datatype.
        car_info_topic = dds.Topic(participant, "Car Info", car_info)

        # A Topic has a name and a datatype.
        command_topic = dds.Topic(participant, "Command", command)

        # A Topic has a name and a datatype.
        route_topic = dds.Topic(participant, "Route", route)

        # A Topic has a name and a datatype.
        failure_topic = dds.Topic(participant, "Failure Assistance", failure_assistance)

        # A Topic has a name and a datatype.
        user_topic = dds.Topic(participant, "User Info", user_info)

        # A Topic has a name and a datatype.
        request_car = dds.Topic(participant, "Request Control", request_control)

        # DataWriter QoS is configured in USER_QOS_PROFILES.xml
        commandReader = dds.DataReader(participant.implicit_subscriber, command_topic)
        failureReader = dds.DataReader(participant.implicit_subscriber, failure_topic)
        userReader = dds.DataReader(participant.implicit_subscriber, user_topic)

        routeWriter = dds.DataWriter(participant.implicit_publisher, route_topic)
        carPositionWriter = dds.DataWriter(participant.implicit_publisher, car_info_topic)
        failureWriter = dds.DataWriter(participant.implicit_publisher, failure_topic)
        requestWriter = dds.DataWriter(participant.implicit_publisher, request_car)

        sample = car_info()
        samples_read = 0

        def condition_handler(_):
            nonlocal samples_read
            nonlocal commandReader
            samples_read += self.process_queue_car_commands(commandReader)

        def failure_condition_handler(_):
            nonlocal failureReader
            self.process_queue_failure_assistance(failureReader)

        def user_info_handler(_):
            nonlocal userReader
            self.process_queue_user_info(userReader)

        # Obtain the DataReader's Status Condition
        status_condition = dds.StatusCondition(commandReader)

        # Enable the "data available" status and set the handler.
        status_condition.enabled_statuses = dds.StatusMask.DATA_AVAILABLE
        status_condition.set_handler(condition_handler)

        # Create a WaitSet and attach the StatusCondition
        waitset = dds.WaitSet()
        waitset += status_condition

        # Obtain the DataReader's Status Condition
        failure_status_condition = dds.StatusCondition(failureReader)

        # Enable the "data available" status and set the handler.
        failure_status_condition.enabled_statuses = dds.StatusMask.DATA_AVAILABLE
        failure_status_condition.set_handler(failure_condition_handler)

        waitset += failure_status_condition

        # Obtain the DataReader's Status Condition
        user_info_status_condition = dds.StatusCondition(userReader)

        # Enable the "data available" status and set the handler.
        user_info_status_condition.enabled_statuses = dds.StatusMask.DATA_AVAILABLE
        user_info_status_condition.set_handler(user_info_handler)

        waitset += user_info_status_condition

        while True:
            # Catch control-C interrupt
            try:
                if self.stop_requested:
                    print("Stop requested, shutting down car participant...")
                    participant.close_contained_entities()
                    dds.DomainParticipant.close(participant)
                    break

                if not self.next_positions.empty():
                    new_position = self.next_positions.get()
                    print(
                        f"\n ----------READER HAS RECIEVED A NEW POSITION ({new_position.lon},"
                        f" {new_position.lat})----------"
                    )
                    self.car.changePosition(new_position)

                time.sleep(0.1)

                sample = self.car.getCarPosition()

                # Write the sample
                carPositionWriter.write(sample)

                if self.car.route_available:
                    self.car.route_available = False
                    route_sample = self.car.getRoute()
                    print("------Sending route------")
                    routeWriter.write(route_sample)

                if self.car.need_asistance != self.last_assistance_status:
                    failure_assistance_sample = failure_assistance()
                    failure_assistance_sample.id_car = self.car.getId()
                    failure_assistance_sample.need_asistance = self.car.need_asistance
                    self.last_assistance_status = self.car.need_asistance
                    failureWriter.write(failure_assistance_sample)

                if self.car.release_car:
                    print(f"Car {self.car.getId()} is being released")
                    request_sample = request_control()
                    request_sample.id_user = self.car.getUser()
                    request_sample.id_car = self.car.getId()    
                    request_sample.request = request_type.RELEASE
                    print(request_sample)
                    requestWriter.write(request_sample)
                    self.car.release_car = False

                waitset.dispatch(dds.Duration(0.5))  # Wait up to 0.5s each time
            except KeyboardInterrupt:
                if self.car.getUser() != None:
                    request_sample = request_control()
                    request_sample.id_user = self.car.getUser()
                    request_sample.id_car = self.car.getId()    
                    request_sample.request = request_type.RELEASE
                    requestWriter.write(request_sample)
                    
                print("Stop requested, shutting down car participant...")
                participant.close_contained_entities()
                dds.DomainParticipant.close(participant)
                break

def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("id", type=str, help="The car ID")
    parser.add_argument(
        "--lat", type=float, help="The longitude coordinate of the car"
    )
    parser.add_argument(
        "--lon", type=float, help="The latitude coordinate of the car"
    )
    args = parser.parse_args()

    # Numeric part from the car ID
    args.id = int(args.id.split("-")[-1])

    coordinates_to_go = [(37.17037156179903, -3.607571125030518), (37.167737676188, -3.598859310150147), (37.18331306728847, -3.6128711700439458), 
                        (37.188100724877565, -3.6001896858215336), (37.16657456100465, -3.590168952941895)]

    if args.lon is None or args.lat is None:
        random_position = coordinates_to_go[(random.randint(0, 1000) % 5)]
        args.lon = random_position[1]
        args.lat = random_position[0]

   
    car = Car(args.id, args.lon, args.lat, coordinates_to_go)
    drive_thread = threading.Thread(target=car.drive, args=())
    drive_thread.start()

    participant = carParticipant(car)

    participant_thread = threading.Thread(target=participant.run_car, args=(0, sys.maxsize))
    participant_thread.start()

    try:
        drive_thread.join()
        participant_thread.join()
    except KeyboardInterrupt:
        print("Received KeyboardInterrupt, shutting down threads...")
        car.stop_requested = True
        participant.stop_requested = True
        drive_thread.join()
        participant_thread.join()

    # participant.run_car( domain_id=0, sample_count=sys.maxsize)

if __name__ == "__main__":
    main()
