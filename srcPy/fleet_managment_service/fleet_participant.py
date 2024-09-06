
# (c) Copyright, Real-Time Innovations, 2022.  All rights reserved.
# RTI grants Licensee a license to use, modify, compile, and create derivative
# works of the software solely for use with RTI Connext DDS. Licensee may
# redistribute copies of the software provided that all such copies are subject
# to this license. The software is provided "as is", with no warranty of any
# type, including any warranty for fitness for any purpose. RTI is under no
# obligation to maintain or support the software. RTI shall not be liable for
# any incidental or consequential damages arising out of the use or inability
# to use the software.

import time
import sys
import rti.connextdds as dds
import threading

from maps_types import request_control, replay_control, car_info, car_aviability, request_type, user_info

class fleetManagmentServiceParticipant:
    def __init__(self):
        self.lock = threading.Lock()
        self.registered_cars = {}
        self.cars_being_used = {}
        self.alive_cars = {}

    def process_car_info(self, reader):
        # take_data() returns copies of all the data samples in the reader
        # and removes them. To also take the SampleInfo meta-data, use take().
        # To not remove the data from the reader, use read_data() or read().
        # samples = reader.take_data()
        full_sample = reader.take()
        # samples = (s.data for s in full_sample)

        infos_and_datas = ((s.info, s.data) for s in full_sample)

        for info, data in infos_and_datas:
            with self.lock:
                if info.state.instance_state == dds.InstanceState.ALIVE:
                    if info.instance_handle not in self.alive_cars:
                        self.alive_cars[info.instance_handle] = data.id
                        self.registered_cars[data.id] = car_aviability.AVAILABLE
                else:
                    if info.instance_handle in self.alive_cars:
                        id_to_delete = self.alive_cars[info.instance_handle]
                        self.alive_cars.pop(info.instance_handle)
                        self.registered_cars.pop(id_to_delete)
                        user_to_delete = None
                        for user, car in self.cars_being_used.items():
                            if car == id_to_delete:
                                user_to_delete = user

                        if user_to_delete:
                            self.cars_being_used.pop(user_to_delete)

            
        print(info.instance_handle)

    def process_car_request(self, reader, writer, user_writer):
        samples = reader.take_data()
        for sample in samples:
            if sample.id_car in self.registered_cars:
                if sample.request == request_type.CONTROL:
                    with self.lock:
                        if self.registered_cars[sample.id_car] == car_aviability.AVAILABLE and sample.id_user not in self.cars_being_used:
                            fleetManagmentServiceParticipant.send_reply(writer, sample, car_aviability.AVAILABLE)
                            self.registered_cars[sample.id_car] = car_aviability.BUSY
                            self.cars_being_used[sample.id_user] = sample.id_car

                            user_info_sample = user_info()
                            user_info_sample.id_car = sample.id_car
                            user_info_sample.username = sample.id_user
                            print(user_info_sample)
                            user_writer.write(user_info_sample)

                            print(f"Car {sample.id_car} is now BUSY")

                        elif self.registered_cars[sample.id_car] == car_aviability.BUSY:
                            if sample.id_user in self.cars_being_used and self.cars_being_used[sample.id_user] == sample.id_car:
                                fleetManagmentServiceParticipant.send_reply(writer, sample, car_aviability.AVAILABLE)
                            else:
                                fleetManagmentServiceParticipant.send_reply(writer, sample, car_aviability.BUSY)
                        else:
                            fleetManagmentServiceParticipant.send_reply(writer, sample, car_aviability.FAIL)
                elif sample.request == request_type.RELEASE and sample.id_user in self.cars_being_used:
                    with self.lock:
                        self.cars_being_used.pop(sample.id_user)
                        self.registered_cars[sample.id_car] = car_aviability.AVAILABLE

                        user_info_sample = user_info()
                        user_info_sample.id_car = sample.id_car
                        user_info_sample.user_in_control = None
                        user_writer.write(user_info_sample)
                    
                    print(f"Car {sample.id_car} is now AVAILABLE")
            elif sample.id_car not in self.cars_being_used and sample.request == request_type.RELEASE:
                self.cars_being_used.pop(sample.id_user)
            else:
                fleetManagmentServiceParticipant.send_reply(writer, sample, car_aviability.FAIL)
    
    @staticmethod
    def send_reply(writer, data, replay):
        replay_sample = replay_control()
        replay_sample.id_user = data.id_user
        replay_sample.id_car = data.id_car
        replay_sample.replay = replay
        print(replay_sample)
        writer.write(replay_sample)

    def start(self, domain_id: int):
        # A DomainParticipant allows an application to begin communicating in
        # a DDS domain. Typically there is one DomainParticipant per application.
        # DomainParticipant QoS is configured in USER_QOS_PROFILES.xml
        participant = dds.DomainParticipant(domain_id)

        # A Topic has a name and a datatype.
        replay_control_topic = dds.Topic(participant, "Replay Control", replay_control)

        # A Topic has a name and a datatype.
        car_info_topic = dds.Topic(participant, "Car Info", car_info)

        # A Topic has a name and a datatype.
        request_control_topic = dds.Topic(participant, "Request Control", request_control)

        user_info_topic = dds.Topic(participant, "User Info", user_info)

        # DATAREADERS
        car_reader = dds.DataReader(participant.implicit_subscriber, car_info_topic)
        control_reader = dds.DataReader(participant.implicit_subscriber, request_control_topic)

        # DATAWRITERS
        control_writer = dds.DataWriter(participant.implicit_publisher, replay_control_topic)

        user_writer = dds.DataWriter(participant.implicit_publisher, user_info_topic)


        # Associate a handler with the status condition. This will run when the
        # condition is triggered, in the context of the dispatch call (see below)
        # condition argument is not used
        def car_condition_handler(_):
            nonlocal car_reader
            self.process_car_info(car_reader)

        def request_condition_handler(_):
            nonlocal control_reader
            self.process_car_request(control_reader, control_writer, user_writer)

        # Obtain the DataReader's Status Condition
        request_status_condition = dds.StatusCondition(control_reader)

        # Enable the "data available" status and set the handler.
        request_status_condition.enabled_statuses = dds.StatusMask.DATA_AVAILABLE
        request_status_condition.set_handler(request_condition_handler)

        # Obtain the DataReader's Status Condition
        car_status_condition = dds.StatusCondition(car_reader)

        # Enable the "data available" status and set the handler.
        car_status_condition.enabled_statuses = dds.StatusMask.DATA_AVAILABLE
        car_status_condition.set_handler(car_condition_handler)

        # Create a WaitSet and attach the StatusCondition
        waitset = dds.WaitSet()
        waitset += request_status_condition
        waitset += car_status_condition

        while True:
            # Catch control-C interrupt
            try:
                print(self.registered_cars)
                print(self.cars_being_used)
                waitset.dispatch(dds.Duration(1))  # Wait up to 1s each time
            except KeyboardInterrupt:
                break

        print("preparing to shut down...")

def main():
    fleet_managment_service = fleetManagmentServiceParticipant()
    fleet_managment_service.start(
            domain_id=0)

if __name__ == "__main__":
    main()
